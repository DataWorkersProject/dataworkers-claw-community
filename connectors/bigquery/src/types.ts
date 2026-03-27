/**
 * Type definitions for the Google BigQuery connector.
 */

export interface BQDataset {
  datasetId: string;
  projectId: string;
  location: string;
  createdAt: number;
  description: string;
}

export interface BQTable {
  tableId: string;
  datasetId: string;
  projectId: string;
  type: 'TABLE' | 'VIEW' | 'EXTERNAL';
  numRows: number;
  numBytes: number;
  createdAt: number;
}

export interface BQColumn {
  name: string;
  type: string;
  mode: 'NULLABLE' | 'REQUIRED' | 'REPEATED';
  description: string;
}

export interface BQTableSchema {
  datasetId: string;
  tableId: string;
  columns: BQColumn[];
  lastModified: number;
}

export interface BQJob {
  jobId: string;
  queryText: string;
  status: 'DONE' | 'RUNNING' | 'PENDING';
  totalBytesProcessed: number;
  totalSlotMs: number;
  createdAt: number;
  user: string;
}

export interface BQCostEstimate {
  queryText: string;
  estimatedBytesProcessed: number;
  estimatedCostUSD: number;
  tier: 'on-demand' | 'flat-rate';
}

/**
 * Common interface that both BigQueryStubClient and BigQueryRealClient implement.
 */
export interface IBigQueryClient {
  /** List all datasets in the project. */
  listDatasets(): BQDataset[] | Promise<BQDataset[]>;
  /** List tables within a dataset. */
  listTables(datasetId: string): BQTable[] | Promise<BQTable[]>;
  /** Get schema for a specific table. */
  getTableSchema(datasetId: string, tableId: string): BQTableSchema | Promise<BQTableSchema>;
  /** Get job history, optionally limited. */
  getJobHistory(limit?: number): BQJob[] | Promise<BQJob[]>;
  /** Estimate cost for a query. */
  estimateQueryCost(queryText: string): BQCostEstimate | Promise<BQCostEstimate>;
}

/**
 * Configuration for connecting the real BigQuery client.
 */
export interface BigQueryConnectionConfig {
  projectId: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
    [key: string]: unknown;
  };
}
