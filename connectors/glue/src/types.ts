/**
 * Type definitions for the AWS Glue Data Catalog connector.
 */

export interface GlueDatabase {
  name: string;
  description: string;
  locationUri: string;
  createTime: number;
}

export interface GlueColumn {
  name: string;
  type: string;
  comment: string;
}

export interface GlueTable {
  name: string;
  databaseName: string;
  columns: GlueColumn[];
  storageDescriptor: string;
  partitionKeys: GlueColumn[];
  tableType: string;
  createTime: number;
}

export interface GluePartition {
  values: string[];
  storageDescriptor: string;
  createTime: number;
}

/**
 * Configuration for a real AWS Glue client.
 */
export interface GlueConnectionConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Interface that both stub and real Glue clients implement.
 */
export interface IGlueClient {
  seed(): void;
  listDatabases(): GlueDatabase[] | Promise<GlueDatabase[]>;
  listTables(database: string): GlueTable[] | Promise<GlueTable[]>;
  getTable(database: string, table: string): GlueTable | Promise<GlueTable>;
  searchTables(query: string): GlueTable[] | Promise<GlueTable[]>;
  getPartitions(database: string, table: string): GluePartition[] | Promise<GluePartition[]>;
}
