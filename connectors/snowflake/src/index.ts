/**
 * Snowflake Data Warehouse Connector.
 *
 * Implements IDataPlatformConnector for Snowflake, backed by either a stubbed
 * in-memory client for offline development and testing, or a real client
 * using the snowflake-sdk npm package.
 */

import type {
  IDataPlatformConnector,
  ICatalogProvider,
  CatalogCapability,
  NamespaceInfo,
  TableMetadata,
  ConnectorHealthStatus,
} from '../../shared/types.js';
import { SnowflakeStubClient } from './stub-client.js';
import type {
  ISnowflakeClient,
  SnowflakeConnectionConfig,
  SnowflakeDatabase,
  SnowflakeSchema,
  SnowflakeTableDDL,
  SnowflakeWarehouseUsage,
  SnowflakeQueryHistoryEntry,
} from './types.js';

export class SnowflakeConnector implements ICatalogProvider {
  readonly connectorType = 'snowflake';
  readonly providerType = 'snowflake';
  readonly capabilities: CatalogCapability[] = ['discovery'];

  private client: ISnowflakeClient;
  private connected = false;
  private account: string | null = null;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: ISnowflakeClient) {
    this.client = client ?? new SnowflakeStubClient();
  }

  /**
   * Create a SnowflakeConnector from environment variables.
   * Falls back to stub client (OSS edition).
   */
  static fromEnv(): SnowflakeConnector {
    return new SnowflakeConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect to a Snowflake account and seed data. */
  connect(account?: string): void {
    // Explicitly passed empty string is an error (backward compat)
    if (account !== undefined && (!account || typeof account !== 'string')) {
      throw new Error('A valid Snowflake account identifier is required');
    }
    const acct = account || process.env.SNOWFLAKE_ACCOUNT;
    if (!acct) {
      // Fallback to stub mode for development
      if (this.client instanceof SnowflakeStubClient) {
        this.client.seed();
      }
      this.mode = 'stub';
    } else {
      // Has account but using stub in OSS edition
      (this.client as any).seed?.();
      this.mode = 'stub';
    }
    this.connected = true;
    this.account = acct || 'stub';
  }

  /** Disconnect and clear state. */
  disconnect(): void {
    this.account = null;
    this.connected = false;
    if (this.client instanceof SnowflakeStubClient) {
      this.client = new SnowflakeStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected && this.account !== null;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- IDataPlatformConnector methods ---

  /** List databases as namespaces. */
  listNamespaces(): NamespaceInfo[] {
    this.ensureConnected();
    const databases = this.client.listDatabases() as SnowflakeDatabase[];
    return databases.map((db) => ({
      name: [db.name],
      properties: {
        owner: db.owner,
        comment: db.comment,
      },
    }));
  }

  /** List tables in a namespace (database.schema format, e.g. "ANALYTICS.PUBLIC"). */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const [database, schema] = namespace.split('.');
    if (!database || !schema) {
      throw new Error(
        `Namespace must be in "DATABASE.SCHEMA" format, got: ${namespace}`,
      );
    }
    const tables = this.client.listTables(database, schema) as ReturnType<SnowflakeStubClient['listTables']>;
    return (tables as Array<{ name: string; database: string; schema: string; kind: string; rowCount: number; bytes: number; owner: string; createdAt: number }>).map((t) => ({
      name: t.name,
      namespace: [t.database, t.schema],
      schema: [],
      properties: {
        kind: t.kind,
        rowCount: String(t.rowCount),
        bytes: String(t.bytes),
        owner: t.owner,
      },
      createdAt: t.createdAt,
    }));
  }

  /** Get detailed table metadata including column schema. */
  getTableMetadata(namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    const [database, schema] = namespace.split('.');
    if (!database || !schema) {
      throw new Error(
        `Namespace must be in "DATABASE.SCHEMA" format, got: ${namespace}`,
      );
    }
    const ddl = this.client.getTableDDL(database, schema, table) as SnowflakeTableDDL;
    const tables = this.client.listTables(database, schema) as Array<{ name: string; kind: string; rowCount: number; bytes: number; createdAt: number }>;
    const tableInfo = tables.find((t) => t.name === table);

    return {
      name: table,
      namespace: [database, schema],
      schema: ddl.columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        comment: c.comment || undefined,
      })),
      properties: {
        clusteringKeys: ddl.clusteringKeys.join(','),
        kind: tableInfo?.kind ?? 'TABLE',
        rowCount: String(tableInfo?.rowCount ?? 0),
        bytes: String(tableInfo?.bytes ?? 0),
      },
      createdAt: tableInfo?.createdAt,
    };
  }

  // --- Snowflake-specific operations ---

  /** List all databases. */
  listDatabases(): SnowflakeDatabase[] {
    this.ensureConnected();
    return this.client.listDatabases() as SnowflakeDatabase[];
  }

  /** List schemas in a database. */
  listSchemas(database: string): SnowflakeSchema[] {
    this.ensureConnected();
    return this.client.listSchemas(database) as SnowflakeSchema[];
  }

  /** Get table DDL with columns and clustering keys. */
  getTableDDL(database: string, schema: string, table: string): SnowflakeTableDDL {
    this.ensureConnected();
    return this.client.getTableDDL(database, schema, table) as SnowflakeTableDDL;
  }

  /** Query warehouse usage metrics. */
  queryWarehouseUsage(): SnowflakeWarehouseUsage[] {
    this.ensureConnected();
    return this.client.queryWarehouseUsage() as SnowflakeWarehouseUsage[];
  }

  /** Get query history entries. */
  getQueryHistory(limit?: number): SnowflakeQueryHistoryEntry[] {
    this.ensureConnected();
    return this.client.getQueryHistory(limit) as SnowflakeQueryHistoryEntry[];
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// Re-export everything
export { SnowflakeStubClient } from './stub-client.js';
export type {
  ISnowflakeClient,
  SnowflakeConnectionConfig,
  SnowflakeDatabase,
  SnowflakeSchema,
  SnowflakeTable,
  SnowflakeColumn,
  SnowflakeTableDDL,
  SnowflakeWarehouseUsage,
  SnowflakeQueryHistoryEntry,
} from './types.js';
