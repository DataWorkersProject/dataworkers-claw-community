/**
 * Type definitions for the Google Cloud Dataplex connector.
 */

export interface DataplexLake {
  name: string;
  displayName: string;
  state: string;
  createTime: string;
  metastore: string;
}

export interface DataplexZone {
  name: string;
  displayName: string;
  type: 'RAW' | 'CURATED';
  lake: string;
}

export interface DataplexField {
  name: string;
  type: string;
  mode: string;
  description: string;
}

export interface DataplexSchema {
  fields: DataplexField[];
}

export interface DataplexEntity {
  name: string;
  displayName: string;
  type: 'TABLE' | 'FILESET';
  system: string;
  schema: DataplexSchema;
  dataPath: string;
  createTime: string;
}

export interface DataplexEntry {
  name: string;
  entryType: string;
  fullyQualifiedName: string;
}

/**
 * Interface that both stub and real Dataplex clients implement.
 */
export interface IDataplexClient {
  seed(): void;
  listLakes(): DataplexLake[] | Promise<DataplexLake[]>;
  listZones(lake: string): DataplexZone[] | Promise<DataplexZone[]>;
  listEntities(zone: string): DataplexEntity[] | Promise<DataplexEntity[]>;
  getEntity(name: string): DataplexEntity | Promise<DataplexEntity>;
  searchEntries(query: string): DataplexEntry[] | Promise<DataplexEntry[]>;
}
