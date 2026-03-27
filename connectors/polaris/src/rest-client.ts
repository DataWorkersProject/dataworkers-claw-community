/**
 * PolarisRESTClient — stubbed HTTP client for Apache Polaris REST API.
 *
 * Implements OAuth2 authentication, catalog browsing, and permission
 * operations against a Polaris-compatible catalog service.
 */

import type {
  PolarisAuthToken,
  PolarisCatalog,
  PolarisPermission,
  PolarisPrincipal,
  PolarisPrivilege,
} from './types.js';

import type {
  IcebergTableMetadata,
  IcebergNamespace,
} from '../../../connectors/iceberg/src/types.js';

/** In-memory seed data for the stubbed client. */
interface SeedData {
  catalogs: PolarisCatalog[];
  namespaces: Map<string, string[][]>;
  tables: Map<string, string[]>;
  tableMetadata: Map<string, IcebergTableMetadata>;
  principals: PolarisPrincipal[];
  permissions: PolarisPermission[];
}

export class PolarisRESTClient {
  private baseUrl = '';
  private token: PolarisAuthToken | null = null;
  private data: SeedData | null = null;

  // ── OAuth2 ──────────────────────────────────────────────────────────

  /**
   * Authenticate via OAuth2 client-credentials flow (stubbed).
   * Stores the resulting token for subsequent requests.
   */
  async authenticate(
    clientId: string,
    clientSecret: string,
  ): Promise<PolarisAuthToken> {
    // Stubbed — any non-empty credentials succeed
    if (!clientId || !clientSecret) {
      throw new Error('Polaris OAuth2: clientId and clientSecret are required');
    }

    const token: PolarisAuthToken = {
      accessToken: `polaris_${clientId}_${Date.now()}`,
      tokenType: 'bearer',
      expiresIn: 3600,
      issuedAt: Date.now(),
    };

    this.token = token;
    return token;
  }

  /** Check whether the current token is still valid. */
  isTokenValid(): boolean {
    if (!this.token) return false;
    const elapsed = Date.now() - this.token.issuedAt;
    return elapsed < this.token.expiresIn * 1000;
  }

  /** Refresh the token if expired (stubbed — just issues a new one). */
  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.token) throw new Error('Not authenticated');
    if (!this.isTokenValid()) {
      this.token = {
        accessToken: `polaris_refreshed_${Date.now()}`,
        tokenType: 'bearer',
        expiresIn: 3600,
        issuedAt: Date.now(),
      };
    }
  }

  /** Clear authentication state. */
  clearAuth(): void {
    this.token = null;
  }

  // ── Auth guard ──────────────────────────────────────────────────────

  private assertAuthenticated(): void {
    if (!this.token) {
      throw new Error('Polaris: not authenticated — call authenticate() first');
    }
  }

  // ── Catalog operations ──────────────────────────────────────────────

  async listCatalogs(): Promise<PolarisCatalog[]> {
    this.assertAuthenticated();
    await this.refreshTokenIfNeeded();
    return this.data?.catalogs ?? [];
  }

  async getCatalog(name: string): Promise<PolarisCatalog> {
    this.assertAuthenticated();
    await this.refreshTokenIfNeeded();
    const catalog = this.data?.catalogs.find((c) => c.name === name);
    if (!catalog) throw new Error(`Catalog not found: ${name}`);
    return catalog;
  }

  async listNamespaces(catalog: string): Promise<string[][]> {
    this.assertAuthenticated();
    await this.refreshTokenIfNeeded();
    return this.data?.namespaces.get(catalog) ?? [];
  }

  async listTables(catalog: string, namespace: string[]): Promise<string[]> {
    this.assertAuthenticated();
    await this.refreshTokenIfNeeded();
    const key = `${catalog}.${namespace.join('.')}`;
    return this.data?.tables.get(key) ?? [];
  }

  async loadTable(
    catalog: string,
    namespace: string[],
    table: string,
  ): Promise<IcebergTableMetadata> {
    this.assertAuthenticated();
    await this.refreshTokenIfNeeded();
    const key = `${catalog}.${namespace.join('.')}.${table}`;
    const meta = this.data?.tableMetadata.get(key);
    if (!meta) throw new Error(`Table not found: ${key}`);
    return meta;
  }

  // ── Permission operations ───────────────────────────────────────────

  async listPermissions(catalog: string): Promise<PolarisPermission[]> {
    this.assertAuthenticated();
    await this.refreshTokenIfNeeded();
    return (
      this.data?.permissions.filter((p) =>
        p.privileges.some((priv) => priv.catalogName === catalog),
      ) ?? []
    );
  }

  async getPrincipalPrivileges(
    principalName: string,
  ): Promise<PolarisPrivilege[]> {
    this.assertAuthenticated();
    await this.refreshTokenIfNeeded();
    const perm = this.data?.permissions.find(
      (p) => p.principal === principalName,
    );
    return perm?.privileges ?? [];
  }

  // ── Seed ────────────────────────────────────────────────────────────

  /** Pre-load the stubbed client with representative data. */
  seed(): void {
    const catalogs: PolarisCatalog[] = [
      {
        name: 'production',
        type: 'INTERNAL',
        properties: { 'warehouse': 's3://prod-warehouse/' },
        storageConfigInfo: {
          storageType: 'S3',
          allowedLocations: ['s3://prod-warehouse/'],
        },
      },
      {
        name: 'staging',
        type: 'EXTERNAL',
        properties: { 'warehouse': 's3://staging-warehouse/' },
        storageConfigInfo: {
          storageType: 'S3',
          allowedLocations: ['s3://staging-warehouse/'],
        },
      },
    ];

    const namespaces = new Map<string, string[][]>();
    namespaces.set('production', [['analytics'], ['raw']]);
    namespaces.set('staging', [['analytics'], ['raw']]);

    const tables = new Map<string, string[]>();
    tables.set('production.analytics', ['page_views', 'user_sessions']);
    tables.set('production.raw', ['events', 'clicks']);
    tables.set('staging.analytics', ['page_views', 'user_sessions']);
    tables.set('staging.raw', ['events', 'clicks']);

    const makeTableMeta = (
      tableId: string,
      name: string,
    ): IcebergTableMetadata => ({
      tableId,
      schema: {
        schemaId: 0,
        fields: [
          { id: 1, name: 'id', type: 'long', required: true },
          { id: 2, name: 'timestamp', type: 'timestamptz', required: true },
          { id: 3, name: 'data', type: 'string', required: false },
        ],
      },
      partitionSpec: {
        specId: 0,
        fields: [
          {
            sourceId: 2,
            fieldId: 1000,
            name: 'ts_day',
            transform: 'day',
          },
        ],
      },
      sortOrder: {
        orderId: 0,
        fields: [{ sourceId: 2, direction: 'desc', nullOrder: 'last' }],
      },
      currentSnapshotId: 1,
      snapshots: [
        {
          snapshotId: 1,
          timestamp: Date.now(),
          summary: {
            operation: 'append',
            totalRecords: 50000,
            totalDataFiles: 10,
            totalSizeBytes: 1024 * 1024 * 50,
          },
        },
      ],
      properties: { 'format-version': '2', 'table-name': name },
    });

    const tableMetadata = new Map<string, IcebergTableMetadata>();
    for (const cat of ['production', 'staging']) {
      for (const ns of ['analytics', 'raw']) {
        const tablesForNs = tables.get(`${cat}.${ns}`) ?? [];
        for (const t of tablesForNs) {
          tableMetadata.set(
            `${cat}.${ns}.${t}`,
            makeTableMeta(`${cat}-${ns}-${t}`, t),
          );
        }
      }
    }

    const principals: PolarisPrincipal[] = [
      {
        name: 'data-team',
        type: 'USER',
        clientId: 'data-team-client',
        properties: { department: 'engineering' },
      },
      {
        name: 'dw-service',
        type: 'SERVICE',
        clientId: 'dw-service-client',
        properties: { managed: 'true' },
      },
    ];

    const permissions: PolarisPermission[] = [
      {
        principal: 'data-team',
        privileges: [
          { type: 'TABLE_READ', catalogName: 'production' },
        ],
      },
      {
        principal: 'dw-service',
        privileges: [
          { type: 'TABLE_WRITE', catalogName: 'production' },
        ],
      },
    ];

    this.data = {
      catalogs,
      namespaces,
      tables,
      tableMetadata,
      principals,
      permissions,
    };
  }

  /** Configure the base URL for the Polaris REST endpoint. */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}
