/**
 * Google BigQuery Connector.
 *
 * Implements a DataConnector-like interface for interacting with
 * Google BigQuery, backed by either a stubbed in-memory client
 * or a real @google-cloud/bigquery client.
 */

import type { ICatalogProvider, CatalogCapability } from '../../shared/types.js';
import { BigQueryStubClient } from './stub-client.js';
import type {
  BQDataset,
  BQTable,
  BQColumn,
  BQTableSchema,
  BQJob,
  BQCostEstimate,
  IBigQueryClient,
  BigQueryConnectionConfig,
} from './types.js';

export class BigQueryConnector implements ICatalogProvider {
  readonly connectorType = 'bigquery';
  readonly providerType = 'bigquery';
  readonly capabilities: CatalogCapability[] = ['discovery'];

  private client: IBigQueryClient;
  private projectId: string | null = null;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: IBigQueryClient) {
    this.client = client ?? new BigQueryStubClient();
  }

  /**
   * Create a BigQueryConnector from environment variables.
   * Falls back to stub client (OSS edition).
   */
  static fromEnv(): BigQueryConnector {
    return new BigQueryConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Validate and store the project ID, seed data (stub) or validate access (real). */
  connect(projectId?: string): void {
    // Explicitly passed empty string is an error (backward compat)
    if (projectId !== undefined && (!projectId || typeof projectId !== 'string')) {
      throw new Error('A valid project ID is required');
    }
    const pid = projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
    if (!pid) {
      // Fallback to stub mode for development
      if (this.client instanceof BigQueryStubClient) {
        this.client.seed();
      }
      this.mode = 'stub';
      this.projectId = 'stub';
      this.connected = true;
      return;
    }
    this.projectId = pid;
    // Seed data when using the stub client (OSS edition)
    if (this.client instanceof BigQueryStubClient) {
      this.client.seed();
    }
    this.mode = 'stub';
    this.connected = true;
  }

  /** Disconnect and clear state. */
  disconnect(): void {
    this.projectId = null;
    this.connected = false;
    // Reset to a fresh stub only when using the stub client
    if (this.client instanceof BigQueryStubClient) {
      this.client = new BigQueryStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): { healthy: boolean; latencyMs: number } {
    const start = Date.now();
    const healthy = this.connected && this.projectId !== null;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- IDataPlatformConnector operations ---

  /** List all datasets as namespaces. */
  listNamespaces(): { name: string[]; properties: Record<string, string> }[] {
    this.ensureConnected();
    const datasets = this.client.listDatasets();
    // Handle both sync and async returns — stub is sync
    if (Array.isArray(datasets)) {
      return datasets.map(mapDatasetToNamespace);
    }
    // Should not reach here in stub mode; kept for type safety
    throw new Error('Use listNamespacesAsync() for the real client');
  }

  /** Async version of listNamespaces for the real client. */
  async listNamespacesAsync(): Promise<{ name: string[]; properties: Record<string, string> }[]> {
    this.ensureConnected();
    const datasets = await this.client.listDatasets();
    return datasets.map(mapDatasetToNamespace);
  }

  /** List tables within a dataset (namespace). */
  listTables(namespace: string): { name: string; namespace: string[]; schema: { name: string; type: string; nullable: boolean; comment?: string }[]; properties: Record<string, string>; createdAt?: number }[] {
    this.ensureConnected();
    const tables = this.client.listTables(namespace);
    if (Array.isArray(tables)) {
      return tables.map(mapTableToMetadata);
    }
    throw new Error('Use listTablesAsync() for the real client');
  }

  /** Async version of listTables for the real client. */
  async listTablesAsync(namespace: string): Promise<{ name: string; namespace: string[]; schema: { name: string; type: string; nullable: boolean; comment?: string }[]; properties: Record<string, string>; createdAt?: number }[]> {
    this.ensureConnected();
    const tables = await this.client.listTables(namespace);
    return tables.map(mapTableToMetadata);
  }

  /** Get detailed metadata for a specific table. */
  getTableMetadata(namespace: string, table: string): { name: string; namespace: string[]; schema: { name: string; type: string; nullable: boolean; comment?: string }[]; properties: Record<string, string>; createdAt?: number } {
    this.ensureConnected();
    const tableSchema = this.client.getTableSchema(namespace, table);
    const tablesResult = this.client.listTables(namespace);
    // Stub client returns synchronously (plain objects); real client returns Promises
    if (isPromise(tableSchema) || isPromise(tablesResult)) {
      throw new Error('Use getTableMetadataAsync() for the real client');
    }
    const schema = tableSchema as BQTableSchema;
    const tables = tablesResult as BQTable[];
    const tableInfo = tables.find((t) => t.tableId === table);
    if (!tableInfo) {
      throw new Error(`Table not found: ${namespace}.${table}`);
    }
    return buildTableMetadata(tableInfo, schema);
  }

  /** Async version of getTableMetadata for the real client. */
  async getTableMetadataAsync(namespace: string, table: string): Promise<{ name: string; namespace: string[]; schema: { name: string; type: string; nullable: boolean; comment?: string }[]; properties: Record<string, string>; createdAt?: number }> {
    this.ensureConnected();
    const [schema, tables] = await Promise.all([
      this.client.getTableSchema(namespace, table),
      this.client.listTables(namespace),
    ]);
    const tableInfo = tables.find((t) => t.tableId === table);
    if (!tableInfo) {
      throw new Error(`Table not found: ${namespace}.${table}`);
    }
    return buildTableMetadata(tableInfo, schema);
  }

  // --- BigQuery-specific operations ---

  /** List all datasets in the project. */
  listDatasets(): BQDataset[] {
    this.ensureConnected();
    const result = this.client.listDatasets();
    if (Array.isArray(result)) return result;
    throw new Error('Use listDatasetsAsync() for the real client');
  }

  /** Async version of listDatasets for the real client. */
  async listDatasetsAsync(): Promise<BQDataset[]> {
    this.ensureConnected();
    return this.client.listDatasets();
  }

  /** Get the schema for a specific table. */
  getTableSchema(dataset: string, table: string): BQTableSchema {
    this.ensureConnected();
    const result = this.client.getTableSchema(dataset, table);
    if (isPromise(result)) throw new Error('Use getTableSchemaAsync() for the real client');
    return result;
  }

  /** Async version of getTableSchema for the real client. */
  async getTableSchemaAsync(dataset: string, table: string): Promise<BQTableSchema> {
    this.ensureConnected();
    return this.client.getTableSchema(dataset, table);
  }

  /** Get job history, optionally limited. */
  getJobHistory(limit?: number): BQJob[] {
    this.ensureConnected();
    const result = this.client.getJobHistory(limit);
    if (Array.isArray(result)) return result;
    throw new Error('Use getJobHistoryAsync() for the real client');
  }

  /** Async version of getJobHistory for the real client. */
  async getJobHistoryAsync(limit?: number): Promise<BQJob[]> {
    this.ensureConnected();
    return this.client.getJobHistory(limit);
  }

  /** Estimate cost for a query. */
  estimateQueryCost(queryText: string): BQCostEstimate {
    this.ensureConnected();
    const result = this.client.estimateQueryCost(queryText);
    if (isPromise(result)) throw new Error('Use estimateQueryCostAsync() for the real client');
    return result;
  }

  /** Async version of estimateQueryCost for the real client. */
  async estimateQueryCostAsync(queryText: string): Promise<BQCostEstimate> {
    this.ensureConnected();
    return this.client.estimateQueryCost(queryText);
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// --- Type guards ---

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return value != null && typeof (value as Promise<T>).then === 'function';
}

// --- Mapping helpers ---

function mapDatasetToNamespace(ds: BQDataset): { name: string[]; properties: Record<string, string> } {
  return {
    name: [ds.datasetId],
    properties: {
      projectId: ds.projectId,
      location: ds.location,
      description: ds.description,
    },
  };
}

function mapTableToMetadata(t: BQTable): { name: string; namespace: string[]; schema: { name: string; type: string; nullable: boolean; comment?: string }[]; properties: Record<string, string>; createdAt?: number } {
  return {
    name: t.tableId,
    namespace: [t.datasetId],
    schema: [],
    properties: {
      type: t.type,
      numRows: String(t.numRows),
      numBytes: String(t.numBytes),
    },
    createdAt: t.createdAt,
  };
}

function buildTableMetadata(tableInfo: BQTable, schema: BQTableSchema): { name: string; namespace: string[]; schema: { name: string; type: string; nullable: boolean; comment?: string }[]; properties: Record<string, string>; createdAt?: number } {
  return {
    name: tableInfo.tableId,
    namespace: [tableInfo.datasetId],
    schema: schema.columns.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.mode === 'NULLABLE',
      comment: col.description,
    })),
    properties: {
      type: tableInfo.type,
      numRows: String(tableInfo.numRows),
      numBytes: String(tableInfo.numBytes),
    },
    createdAt: tableInfo.createdAt,
  };
}

// Re-export everything
export { BigQueryStubClient } from './stub-client.js';
export type {
  BQDataset,
  BQTable,
  BQColumn,
  BQTableSchema,
  BQJob,
  BQCostEstimate,
  IBigQueryClient,
  BigQueryConnectionConfig,
} from './types.js';
