/**
 * AWS Glue Data Catalog Connector.
 *
 * Implements ICatalogProvider for AWS Glue, backed by either a stubbed
 * in-memory client or a real client using @aws-sdk/client-glue.
 */

import type {
  ICatalogProvider,
  CatalogCapability,
  NamespaceInfo,
  TableMetadata,
  ConnectorHealthStatus,
  TableInfo,
  Permission,
  Tag,
} from '../../shared/types.js';
import { GlueStubClient } from './stub-client.js';
import { LakeFormationStubClient } from './lakeformation-client.js';
import type {
  IGlueClient,
  GlueTable,
  GluePartition,
  GlueDatabase,
  GlueConnectionConfig,
} from './types.js';
import type {
  ILakeFormationClient,
  LFPermission,
  LFTag,
  LFDataLakeSettings,
} from './lakeformation-types.js';

export class GlueConnector implements ICatalogProvider {
  readonly connectorType = 'glue';
  readonly providerType = 'glue';
  readonly capabilities: CatalogCapability[] = ['discovery', 'search', 'governance'];

  private client: IGlueClient;
  private lfClient: ILakeFormationClient;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: IGlueClient, lfClient?: ILakeFormationClient) {
    this.client = client ?? new GlueStubClient();
    this.lfClient = lfClient ?? new LakeFormationStubClient();
  }

  /** Create a GlueConnector from environment variables. */
  static fromEnv(): GlueConnector {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (region && accessKeyId && secretAccessKey) {
      const realClient = new GlueRealClient({ region, accessKeyId, secretAccessKey });
      const lfClient = new LakeFormationRealClient({ region, accessKeyId, secretAccessKey });
      const connector = new GlueConnector(realClient, lfClient);
      connector.mode = 'real';
      return connector;
    }
    return new GlueConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect and seed data for stub mode. */
  connect(): void {
    if (this.client instanceof GlueStubClient) {
      this.client.seed();
      this.mode = 'stub';
    } else {
      this.mode = 'real';
    }
    if (this.lfClient instanceof LakeFormationStubClient) {
      this.lfClient.seed();
    }
    this.connected = true;
  }

  /** Disconnect and clear state. */
  disconnect(): void {
    this.connected = false;
    if (this.client instanceof GlueStubClient) {
      this.client = new GlueStubClient();
    }
    if (this.lfClient instanceof LakeFormationStubClient) {
      this.lfClient = new LakeFormationStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- ICatalogProvider methods ---

  /** List databases as namespaces. */
  listNamespaces(): NamespaceInfo[] {
    this.ensureConnected();
    const databases = this.client.listDatabases() as GlueDatabase[];
    return databases.map((db) => ({
      name: [db.name],
      properties: {
        description: db.description,
        locationUri: db.locationUri,
      },
    }));
  }

  /** List tables in a database namespace. */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const tables = this.client.listTables(namespace) as GlueTable[];
    return tables.map((t) => ({
      name: t.name,
      namespace: [t.databaseName],
      schema: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: true,
        comment: c.comment || undefined,
      })),
      properties: {
        tableType: t.tableType,
        storageDescriptor: t.storageDescriptor,
        partitionKeys: t.partitionKeys.map((p) => p.name).join(','),
      },
      createdAt: t.createTime,
    }));
  }

  /** Get detailed table metadata. */
  getTableMetadata(namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    const t = this.client.getTable(namespace, table) as GlueTable;
    return {
      name: t.name,
      namespace: [t.databaseName],
      schema: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: true,
        comment: c.comment || undefined,
      })),
      properties: {
        tableType: t.tableType,
        storageDescriptor: t.storageDescriptor,
        partitionKeys: t.partitionKeys.map((p) => p.name).join(','),
      },
      createdAt: t.createTime,
    };
  }

  // --- Glue-specific operations ---

  /** List all databases. */
  listDatabases(): GlueDatabase[] {
    this.ensureConnected();
    return this.client.listDatabases() as GlueDatabase[];
  }

  /** Get partitions for a table. */
  getPartitions(database: string, table: string): GluePartition[] {
    this.ensureConnected();
    return this.client.getPartitions(database, table) as GluePartition[];
  }

  /** Search tables by query string. */
  searchTables(query: string): TableInfo[] {
    this.ensureConnected();
    const tables = this.client.searchTables(query) as GlueTable[];
    return tables.map((t) => ({
      name: t.name,
      namespace: [t.databaseName],
      tableType: t.tableType,
      properties: {
        storageDescriptor: t.storageDescriptor,
      },
    }));
  }

  /** Get a raw Glue table object. */
  getGlueTable(database: string, table: string): GlueTable {
    this.ensureConnected();
    return this.client.getTable(database, table) as GlueTable;
  }

  // --- Lake Formation operations ---

  /** Get Lake Formation permissions for a resource. */
  getPermissions(resource: string): Permission[] {
    this.ensureConnected();
    const lfPerms = this.lfClient.getPermissions(resource) as LFPermission[];
    return lfPerms.flatMap((p) =>
      p.permissions.map((perm) => ({
        principal: p.principal,
        resource: p.resource,
        privilege: perm,
        granted: true,
      })),
    );
  }

  /** Get Lake Formation tags for a resource. */
  getTags(resource: string): Tag[] {
    this.ensureConnected();
    const lfTags = this.lfClient.getTags(resource) as LFTag[];
    return lfTags.flatMap((t) =>
      t.tagValues.map((v) => ({
        key: t.tagKey,
        value: v,
        resource,
      })),
    );
  }

  /** Get raw LF permissions for a resource. */
  getLFPermissions(resource: string): LFPermission[] {
    this.ensureConnected();
    return this.lfClient.getPermissions(resource) as LFPermission[];
  }

  /** Get raw LF tags for a resource. */
  getLFTags(resource: string): LFTag[] {
    this.ensureConnected();
    return this.lfClient.getTags(resource) as LFTag[];
  }

  /** Get Lake Formation data lake settings. */
  getLakeFormationSettings(): LFDataLakeSettings {
    this.ensureConnected();
    return this.lfClient.getLakeFormationSettings() as LFDataLakeSettings;
  }

  /** Search for resources by Lake Formation tag values. */
  searchByTags(tags: string[]): string[] {
    this.ensureConnected();
    return this.lfClient.searchByTags(tags) as string[];
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// Re-export everything
export { GlueStubClient } from './stub-client.js';
export { LakeFormationStubClient } from './lakeformation-client.js';
export type {
  IGlueClient,
  GlueConnectionConfig,
  GlueDatabase,
  GlueTable,
  GlueColumn,
  GluePartition,
} from './types.js';
export type {
  ILakeFormationClient,
  LFPermission,
  LFTag,
  LFDataLakeSettings,
} from './lakeformation-types.js';
