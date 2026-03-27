/**
 * PolarisConnector — high-level connector for Apache Polaris catalog service.
 *
 * Wraps PolarisRESTClient with a friendly API for catalog browsing,
 * table metadata retrieval, and access-control checks.
 */

import type { ICatalogProvider, CatalogCapability, Permission, TableMetadata } from '../../shared/types.js';

export type {
  PolarisCatalog,
  PolarisPrincipal,
  PolarisPrivilege,
  PolarisPermission,
  PolarisAuthToken,
} from './types.js';

export { PolarisRESTClient } from './rest-client.js';

import type {
  PolarisCatalog,
  PolarisPermission,
  PolarisAuthToken,
} from './types.js';

import type { IcebergTableMetadata } from '../../../connectors/iceberg/src/types.js';

import { PolarisRESTClient } from './rest-client.js';

export interface PolarisHealthStatus {
  healthy: boolean;
  latencyMs: number;
  authenticated: boolean;
}

export class PolarisConnector implements ICatalogProvider {
  readonly connectorType = 'polaris';
  readonly providerType = 'polaris';
  readonly capabilities: CatalogCapability[] = ['discovery', 'governance'];

  private client: PolarisRESTClient;
  private authenticated = false;

  constructor() {
    this.client = new PolarisRESTClient();
    this.client.seed();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Connect to a Polaris endpoint with OAuth2 credentials.
   */
  async connect(
    endpoint: string,
    clientId: string,
    clientSecret: string,
  ): Promise<PolarisAuthToken> {
    this.client.setBaseUrl(endpoint);
    const token = await this.client.authenticate(clientId, clientSecret);
    this.authenticated = true;
    return token;
  }

  /** Disconnect and clear authentication state. */
  disconnect(): void {
    this.client.clearAuth();
    this.authenticated = false;
  }

  /** Health check — returns connectivity + auth status. */
  async healthCheck(): Promise<PolarisHealthStatus> {
    const start = Date.now();
    try {
      if (!this.authenticated) {
        return { healthy: false, latencyMs: 0, authenticated: false };
      }
      // Probe the catalog list as a liveness check
      await this.client.listCatalogs();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        authenticated: true,
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        authenticated: this.authenticated,
      };
    }
  }

  // ── Catalog browsing ────────────────────────────────────────────────

  /** List all catalogs registered in Polaris. */
  async listCatalogs(): Promise<PolarisCatalog[]> {
    return this.client.listCatalogs();
  }

  /**
   * Browse a single catalog: return all namespaces and the tables within
   * each namespace.
   */
  async browseCatalog(
    catalogName: string,
  ): Promise<{
    namespaces: string[][];
    tables: { namespace: string[]; name: string }[];
  }> {
    const namespaces = await this.client.listNamespaces(catalogName);
    const tables: { namespace: string[]; name: string }[] = [];

    for (const ns of namespaces) {
      const tableNames = await this.client.listTables(catalogName, ns);
      for (const t of tableNames) {
        tables.push({ namespace: ns, name: t });
      }
    }

    return { namespaces, tables };
  }

  /** Conforming implementation for ICatalogProvider.
   *  Overloaded: (namespace, table) for ICatalogProvider or (catalog, namespace[], table) for Polaris-specific. */
  async getTableMetadata(namespace: string, table: string): Promise<TableMetadata>;
  async getTableMetadata(catalog: string, namespaceArr: string[], table: string): Promise<TableMetadata & { tableId: string }>;
  async getTableMetadata(namespaceOrCatalog: string, tableOrNamespace: string | string[], maybeTable?: string): Promise<TableMetadata & { tableId?: string }> {
    if (Array.isArray(tableOrNamespace) && maybeTable) {
      // 3-arg Polaris-specific: (catalog, namespace[], table)
      const icebergMeta = await this.client.loadTable(namespaceOrCatalog, tableOrNamespace, maybeTable);
      return {
        name: maybeTable,
        namespace: tableOrNamespace,
        schema: icebergMeta.schema ?? { schemaId: 0, fields: [] },
        tableId: icebergMeta.tableId ?? `${namespaceOrCatalog}.${tableOrNamespace.join('.')}.${maybeTable}`,
        properties: icebergMeta.properties ?? {},
        partitionSpec: icebergMeta.partitionSpec,
        snapshots: icebergMeta.snapshots,
      };
    }
    // 2-arg ICatalogProvider: (namespace, table)
    return { name: tableOrNamespace as string, namespace: [namespaceOrCatalog], schema: [], properties: {} };
  }

  /** Load full Iceberg-compatible table metadata via Polaris REST API. */
  async getIcebergTableMetadata(
    catalog: string,
    namespace: string[],
    table: string,
  ): Promise<IcebergTableMetadata> {
    return this.client.loadTable(catalog, namespace, table);
  }

  // ── Access control ──────────────────────────────────────────────────

  /** List all permission policies for a catalog. */
  async getPermissions(catalog: string): Promise<PolarisPermission[]> {
    return this.client.listPermissions(catalog);
  }

  /**
   * Evaluate whether a principal is allowed to perform a specific
   * privilege on a given resource.
   */
  async checkAccess(
    principal: string,
    catalog: string,
    namespace: string | undefined,
    table: string | undefined,
    privilege: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    const privileges = await this.client.getPrincipalPrivileges(principal);

    if (privileges.length === 0) {
      return {
        allowed: false,
        reason: `Principal '${principal}' has no privileges`,
      };
    }

    const match = privileges.find((p) => {
      if (p.type !== privilege) return false;
      if (p.catalogName !== catalog) return false;
      // If the privilege is scoped to a namespace, check it
      if (p.namespaceName && namespace && p.namespaceName !== namespace)
        return false;
      // If the privilege is scoped to a table, check it
      if (p.tableName && table && p.tableName !== table) return false;
      return true;
    });

    if (match) {
      return {
        allowed: true,
        reason: `Principal '${principal}' has ${privilege} on ${catalog}${namespace ? '.' + namespace : ''}${table ? '.' + table : ''}`,
      };
    }

    return {
      allowed: false,
      reason: `Principal '${principal}' lacks ${privilege} on ${catalog}${namespace ? '.' + namespace : ''}${table ? '.' + table : ''}`,
    };
  }
}
