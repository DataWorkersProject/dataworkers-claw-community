/**
 * Type definitions for the DataHub metadata platform connector.
 */

export interface DataHubField {
  fieldPath: string;
  type: string;
  description: string;
  nullable: boolean;
}

export interface DataHubDataset {
  urn: string;
  name: string;
  platform: string;
  description: string;
  schema: DataHubField[];
  tags: string[];
  domain: string;
}

export interface DataHubDomain {
  urn: string;
  name: string;
  description: string;
}

export interface DataHubLineageEntity {
  urn: string;
  type: string;
  name: string;
  degree: number;
}

export interface DataHubLineageResult {
  urn: string;
  direction: 'upstream' | 'downstream';
  entities: DataHubLineageEntity[];
}

/**
 * Interface that both stub and real DataHub clients implement.
 */
export interface IDataHubClient {
  seed(): void;
  searchDatasets(query: string): DataHubDataset[] | Promise<DataHubDataset[]>;
  getDataset(urn: string): DataHubDataset | Promise<DataHubDataset>;
  getLineage(urn: string, direction: 'upstream' | 'downstream'): DataHubLineageResult | Promise<DataHubLineageResult>;
  listDomains(): DataHubDomain[] | Promise<DataHubDomain[]>;
}
