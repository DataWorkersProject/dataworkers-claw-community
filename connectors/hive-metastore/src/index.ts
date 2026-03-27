/**
 * Hive Metastore Connector.
 *
 * Implements ICatalogProvider for Hive Metastore (Thrift), backed by either
 * a stubbed in-memory client or a real client using hive-driver.
 */

import type {
  ICatalogProvider,
  CatalogCapability,
  NamespaceInfo,
  TableMetadata,
  ConnectorHealthStatus,
} from '../../shared/types.js';
import { HiveStubClient } from './stub-client.js';
import type {
  IHiveClient,
  HiveDatabase,
  HiveTable,
  HivePartition,
} from './types.js';

export class HiveMetastoreConnector implements ICatalogProvider {
  readonly connectorType = 'hive-metastore';
  readonly providerType = 'hive-metastore';
  readonly capabilities: CatalogCapability[] = ['discovery'];

  private client: IHiveClient;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: IHiveClient) {
    this.client = client ?? new HiveStubClient();
  }

  /** Create a HiveMetastoreConnector from environment variables. */
  static fromEnv(): HiveMetastoreConnector {
    const uri = process.env.HIVE_METASTORE_URI;
    const authMode = process.env.HIVE_AUTH_MODE;
    const kerberosPrincipal = process.env.HIVE_KERBEROS_PRINCIPAL;

    // Real client stripped in OSS edition — always use stub
    void uri; void authMode; void kerberosPrincipal;
    return new HiveMetastoreConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect and seed data for stub mode. */
  connect(): void {
    if (this.client instanceof HiveStubClient) {
      this.client.seed();
      this.mode = 'stub';
    } else {
      this.mode = 'real';
    }
    this.connected = true;
  }

  /** Disconnect and clear state. */
  disconnect(): void {
    this.connected = false;
    if (this.client instanceof HiveStubClient) {
      this.client = new HiveStubClient();
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
    const databases = this.client.listDatabases() as HiveDatabase[];
    return databases.map((db) => ({
      name: [db.name],
      properties: {
        description: db.description,
        locationUri: db.locationUri,
        ownerName: db.ownerName,
        ownerType: db.ownerType,
      },
    }));
  }

  /** List tables in a database namespace. */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const tables = this.client.listTables(namespace) as HiveTable[];
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
        format: t.format,
        owner: t.owner,
        storageDescriptor: t.storageDescriptor,
        partitionKeys: t.partitionKeys.map((p) => p.name).join(','),
      },
      createdAt: t.createTime,
    }));
  }

  /** Get detailed table metadata. */
  getTableMetadata(namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    const t = this.client.getTable(namespace, table) as HiveTable;
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
        format: t.format,
        owner: t.owner,
        storageDescriptor: t.storageDescriptor,
        partitionKeys: t.partitionKeys.map((p) => p.name).join(','),
      },
      createdAt: t.createTime,
    };
  }

  // --- Hive-specific operations ---

  /** List all databases. */
  listDatabases(): HiveDatabase[] {
    this.ensureConnected();
    return this.client.listDatabases() as HiveDatabase[];
  }

  /** Get a raw Hive table object. */
  getHiveTable(database: string, table: string): HiveTable {
    this.ensureConnected();
    return this.client.getTable(database, table) as HiveTable;
  }

  /** Get partitions for a table. */
  getPartitions(database: string, table: string): HivePartition[] {
    this.ensureConnected();
    return this.client.getPartitions(database, table) as HivePartition[];
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// Re-export everything
export { HiveStubClient } from './stub-client.js';
export type {
  IHiveClient,
  HiveConnectionConfig,
  HiveDatabase,
  HiveTable,
  HiveColumn,
  HivePartition,
} from './types.js';
