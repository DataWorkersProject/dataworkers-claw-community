/**
 * Type definitions for the Hive Metastore connector.
 */

export interface HiveDatabase {
  name: string;
  description: string;
  locationUri: string;
  ownerName: string;
  ownerType: string;
}

export interface HiveColumn {
  name: string;
  type: string;
  comment: string;
}

export interface HiveTable {
  name: string;
  databaseName: string;
  owner: string;
  tableType: 'MANAGED_TABLE' | 'EXTERNAL_TABLE' | 'VIRTUAL_VIEW';
  columns: HiveColumn[];
  partitionKeys: HiveColumn[];
  storageDescriptor: string;
  createTime: number;
  format: 'hive' | 'iceberg' | 'delta' | 'hudi';
}

export interface HivePartition {
  values: string[];
  location: string;
  createTime: number;
}

/**
 * Connection configuration for a real Hive Metastore client.
 */
export interface HiveConnectionConfig {
  uri: string;
  authMode?: string;
  kerberosPrincipal?: string;
}

/**
 * Interface that both stub and real Hive Metastore clients implement.
 */
export interface IHiveClient {
  seed(): void;
  listDatabases(): HiveDatabase[] | Promise<HiveDatabase[]>;
  listTables(database: string): HiveTable[] | Promise<HiveTable[]>;
  getTable(database: string, table: string): HiveTable | Promise<HiveTable>;
  getPartitions(database: string, table: string): HivePartition[] | Promise<HivePartition[]>;
}
