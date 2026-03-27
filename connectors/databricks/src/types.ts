/**
 * Type definitions for the Databricks Unity Catalog connector.
 * Follows the Unity Catalog 3-level namespace: catalog.schema.table
 */

export interface DatabricksCatalog {
  name: string;
  owner: string;
  comment: string;
  createdAt: number;
}

export interface DatabricksSchema {
  name: string;
  catalogName: string;
  owner: string;
  comment: string;
  createdAt: number;
}

export interface DatabricksColumn {
  name: string;
  type: string;
  nullable: boolean;
  comment?: string;
}

export interface DatabricksTable {
  name: string;
  catalogName: string;
  schemaName: string;
  tableType: 'MANAGED' | 'EXTERNAL' | 'VIEW';
  dataSourceFormat: 'DELTA' | 'PARQUET' | 'CSV' | 'JSON';
  columns: DatabricksColumn[];
  storageLocation?: string;
  owner: string;
}

export interface DatabricksQueryHistoryEntry {
  queryId: string;
  queryText: string;
  status: 'FINISHED' | 'FAILED' | 'CANCELED';
  durationMs: number;
  rowsProduced: number;
  bytesRead: number;
  user: string;
  warehouse: string;
  startTime: number;
}

/**
 * Connection configuration for the real Databricks client.
 */
export interface DatabricksConnectionConfig {
  /** Databricks workspace host, e.g. "https://my-workspace.cloud.databricks.com" */
  host: string;
  /** Personal access token or OAuth token */
  token: string;
  /** Optional SQL warehouse HTTP path for SQL queries */
  httpPath?: string;
  /** Optional default catalog name */
  catalogName?: string;
}

/**
 * Common interface implemented by both the stub and real Databricks clients.
 */
export interface IDatabricksClient {
  listCatalogs(): DatabricksCatalog[] | Promise<DatabricksCatalog[]>;
  listSchemas(catalog: string): DatabricksSchema[] | Promise<DatabricksSchema[]>;
  listTables(catalog: string, schema: string): DatabricksTable[] | Promise<DatabricksTable[]>;
  getTable(catalog: string, schema: string, table: string): DatabricksTable | Promise<DatabricksTable>;
  getQueryHistory(limit?: number): DatabricksQueryHistoryEntry[] | Promise<DatabricksQueryHistoryEntry[]>;
}
