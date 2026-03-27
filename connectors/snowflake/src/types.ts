/**
 * Type definitions for the Snowflake data warehouse connector.
 */

export interface SnowflakeDatabase {
  name: string;
  owner: string;
  createdAt: number;
  comment: string;
}

export interface SnowflakeSchema {
  name: string;
  database: string;
  owner: string;
  createdAt: number;
}

export interface SnowflakeTable {
  name: string;
  database: string;
  schema: string;
  kind: 'TABLE' | 'VIEW';
  rowCount: number;
  bytes: number;
  owner: string;
  createdAt: number;
}

export interface SnowflakeColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  comment: string;
}

export interface SnowflakeTableDDL {
  database: string;
  schema: string;
  table: string;
  columns: SnowflakeColumn[];
  clusteringKeys: string[];
}

export interface SnowflakeWarehouseUsage {
  warehouseName: string;
  creditsUsed: number;
  queriesExecuted: number;
  avgExecutionTimeMs: number;
  period: {
    start: number;
    end: number;
  };
}

export interface SnowflakeQueryHistoryEntry {
  queryId: string;
  queryText: string;
  status: string;
  durationMs: number;
  bytesScanned: number;
  rowsProduced: number;
  user: string;
  warehouse: string;
  startTime: number;
}

/**
 * Connection configuration for a real Snowflake client.
 */
export interface SnowflakeConnectionConfig {
  account: string;
  username: string;
  password: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  role?: string;
}

/**
 * Interface that both stub and real Snowflake clients implement.
 */
export interface ISnowflakeClient {
  listDatabases(): SnowflakeDatabase[] | Promise<SnowflakeDatabase[]>;
  listSchemas(database: string): SnowflakeSchema[] | Promise<SnowflakeSchema[]>;
  listTables(database: string, schema: string): SnowflakeTable[] | Promise<SnowflakeTable[]>;
  getTableDDL(database: string, schema: string, table: string): SnowflakeTableDDL | Promise<SnowflakeTableDDL>;
  queryWarehouseUsage(): SnowflakeWarehouseUsage[] | Promise<SnowflakeWarehouseUsage[]>;
  getQueryHistory(limit?: number): SnowflakeQueryHistoryEntry[] | Promise<SnowflakeQueryHistoryEntry[]>;
  seed(): void;
}
