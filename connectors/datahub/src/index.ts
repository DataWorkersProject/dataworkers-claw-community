/**
 * DataHub Metadata Platform Connector.
 *
 * Implements ICatalogProvider for DataHub, backed by either a stubbed
 * in-memory client or a real client using GraphQL via fetch.
 */

import type {
  ICatalogProvider,
  CatalogCapability,
  NamespaceInfo,
  TableMetadata,
  ConnectorHealthStatus,
  TableInfo,
  LineageGraph,
} from '../../shared/types.js';
import { DataHubStubClient } from './stub-client.js';
import type {
  IDataHubClient,
  DataHubDataset,
  DataHubDomain,
  DataHubLineageResult,
} from './types.js';

export class DataHubConnector implements ICatalogProvider {
  readonly connectorType = 'datahub';
  readonly providerType = 'datahub';
  readonly capabilities: CatalogCapability[] = ['discovery', 'lineage', 'search', 'governance'];

  private client: IDataHubClient;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: IDataHubClient) {
    this.client = client ?? new DataHubStubClient();
  }

  /** Create a DataHubConnector from environment variables. */
  static fromEnv(): DataHubConnector {
    const url = process.env.DATAHUB_URL;
    const token = process.env.DATAHUB_TOKEN;

    // Real client stripped in OSS edition — always use stub
    void url; void token;
    return new DataHubConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect and seed data for stub mode. */
  connect(): void {
    if (this.client instanceof DataHubStubClient) {
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
    if (this.client instanceof DataHubStubClient) {
      this.client = new DataHubStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- ICatalogProvider methods ---

  /** List domains as namespaces. */
  listNamespaces(): NamespaceInfo[] {
    this.ensureConnected();
    const domains = this.client.listDomains() as DataHubDomain[];
    return domains.map((d) => ({
      name: [d.name],
      properties: {
        urn: d.urn,
        description: d.description,
      },
    }));
  }

  /** List tables (datasets) by searching with namespace as query. */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const datasets = this.client.searchDatasets(namespace) as DataHubDataset[];
    return datasets.map((d) => this.datasetToTableMetadata(d));
  }

  /** Get detailed table metadata by URN. */
  getTableMetadata(namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    const urn = table.startsWith('urn:') ? table : `urn:li:dataset:(urn:li:dataPlatform:${namespace},${table},PROD)`;
    const dataset = this.client.getDataset(urn) as DataHubDataset;
    return this.datasetToTableMetadata(dataset);
  }

  /** Search datasets across DataHub. */
  searchTables(query: string): TableInfo[] {
    this.ensureConnected();
    const datasets = this.client.searchDatasets(query) as DataHubDataset[];
    return datasets.map((d) => ({
      name: d.name,
      namespace: [d.platform],
      tableType: 'DATASET',
      properties: {
        urn: d.urn,
        domain: d.domain,
        tags: d.tags.join(','),
      },
    }));
  }

  /** Get lineage for a dataset. */
  getLineage(entityId: string, direction: 'upstream' | 'downstream'): LineageGraph {
    this.ensureConnected();
    const result = this.client.getLineage(entityId, direction) as DataHubLineageResult;
    return {
      nodes: [
        { entityId: result.urn, entityType: 'DATASET', name: result.urn },
        ...result.entities.map((e) => ({
          entityId: e.urn,
          entityType: e.type,
          name: e.name,
        })),
      ],
      edges: result.entities.map((e) => direction === 'upstream'
        ? { source: e.urn, target: result.urn }
        : { source: result.urn, target: e.urn },
      ),
    };
  }

  // --- DataHub-specific operations ---

  /** Search datasets by query. */
  searchDatasets(query: string): DataHubDataset[] {
    this.ensureConnected();
    return this.client.searchDatasets(query) as DataHubDataset[];
  }

  /** Get a specific dataset by URN. */
  getDataset(urn: string): DataHubDataset {
    this.ensureConnected();
    return this.client.getDataset(urn) as DataHubDataset;
  }

  /** Get lineage for a dataset URN. */
  getDataHubLineage(urn: string, direction: 'upstream' | 'downstream'): DataHubLineageResult {
    this.ensureConnected();
    return this.client.getLineage(urn, direction) as DataHubLineageResult;
  }

  /** List all domains. */
  listDomains(): DataHubDomain[] {
    this.ensureConnected();
    return this.client.listDomains() as DataHubDomain[];
  }

  // --- Private helpers ---

  private datasetToTableMetadata(d: DataHubDataset): TableMetadata {
    return {
      name: d.name,
      namespace: [d.platform],
      schema: d.schema.map((f) => ({
        name: f.fieldPath,
        type: f.type,
        nullable: f.nullable,
        comment: f.description || undefined,
      })),
      properties: {
        urn: d.urn,
        domain: d.domain,
        tags: d.tags.join(','),
      },
    };
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// Re-export everything
export { DataHubStubClient } from './stub-client.js';
export type {
  IDataHubClient,
  DataHubDataset,
  DataHubField,
  DataHubDomain,
  DataHubLineageResult,
  DataHubLineageEntity,
} from './types.js';
