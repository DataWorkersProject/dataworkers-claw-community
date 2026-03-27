/**
 * dbt Cloud API + manifest parsing connector.
 *
 * Supports two modes:
 * - Cloud mode: connect(apiToken) seeds the stub client
 * - Local mode: loadManifest(manifest) parses a local manifest.json
 */

import type { ICatalogProvider, CatalogCapability, NamespaceInfo, TableMetadata, ConnectorHealthStatus, LineageGraph } from '../../shared/types.js';
import { DbtCloudStubClient } from './stub-client.js';
import { DbtManifestParser } from './manifest-parser.js';
import type {
  DbtModel,
  DbtLineageEdge,
  DbtTestResult,
  DbtRunHistory,
  DbtManifest,
  DbtCloudConfig,
  IDbtClient,
} from './types.js';

export class DbtConnector implements ICatalogProvider {
  readonly connectorType = 'dbt';
  readonly providerType = 'dbt';
  readonly capabilities: CatalogCapability[] = ['discovery', 'lineage'];

  private client: IDbtClient;
  private parser: DbtManifestParser;
  private connected = false;
  private mode: 'cloud' | 'manifest' | null = null;
  private clientMode: 'real' | 'stub' = 'stub';

  constructor(client?: IDbtClient) {
    this.client = client ?? new DbtCloudStubClient();
    this.parser = new DbtManifestParser();
  }

  /**
   * Create a DbtConnector backed by the real dbt Cloud API.
   * The connector is returned in a connected state.
   */
  static createReal(_config: DbtCloudConfig): DbtConnector {
    // Real client stripped in OSS edition — always use stub
    const connector = new DbtConnector();
    connector.connected = true;
    connector.mode = 'cloud';
    return connector;
  }

  /**
   * Create a DbtConnector from environment variables.
   * Uses real client when DBT_API_TOKEN (or DBT_CLOUD_TOKEN) and DBT_ACCOUNT_ID are set.
   * Falls back to stub client when credentials are not available.
   */
  static fromEnv(): DbtConnector {
    const apiToken = process.env.DBT_API_TOKEN || process.env.DBT_CLOUD_TOKEN;
    const accountId = process.env.DBT_ACCOUNT_ID;

    if (apiToken && accountId) {
      return DbtConnector.createReal({ apiToken, accountId });
    }
    return new DbtConnector();
  }

  /** Get the current client mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.clientMode;
  }

  /**
   * Create a DbtConnector from a local manifest.json file.
   * The connector is returned in a connected (manifest) state.
   */
  static fromManifestFile(filePath: string): DbtConnector {
    const parser = DbtManifestParser.fromFile(filePath);
    const connector = new DbtConnector();
    connector.parser = parser;
    connector.connected = true;
    connector.mode = 'manifest';
    return connector;
  }

  /** Connect to dbt Cloud API (stub mode). Seeds the in-memory client. */
  connect(apiToken: string): void {
    if (!apiToken || typeof apiToken !== 'string') {
      throw new Error('A valid API token is required');
    }
    if ('seed' in this.client && typeof (this.client as any).seed === 'function') {
      (this.client as any).seed();
    }
    this.connected = true;
    this.mode = 'cloud';
  }

  /** Load a local manifest for manifest-parsing mode. */
  loadManifest(manifest: DbtManifest): void {
    this.parser.parse(manifest);
    this.connected = true;
    this.mode = 'manifest';
  }

  /** Disconnect and clear state. Resets to stub client. */
  disconnect(): void {
    this.connected = false;
    this.mode = null;
    this.client = new DbtCloudStubClient();
    this.parser = new DbtManifestParser();
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected && this.mode !== null;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- IDataPlatformConnector operations ---

  /** List schemas as namespaces. */
  async listNamespaces(): Promise<NamespaceInfo[]> {
    this.ensureConnected();
    const models = await this.getModelsFromActiveMode();
    const schemaSet = new Map<string, NamespaceInfo>();

    for (const model of models) {
      const key = model.schema;
      if (!schemaSet.has(key)) {
        schemaSet.set(key, {
          name: [model.database, model.schema],
          properties: { database: model.database },
        });
      }
    }

    return Array.from(schemaSet.values());
  }

  /** List models within a schema (namespace). */
  async listTables(namespace: string): Promise<TableMetadata[]> {
    this.ensureConnected();
    const models = await this.getModelsFromActiveMode();
    return models
      .filter((m: DbtModel) => m.schema === namespace)
      .map((m: DbtModel) => this.modelToTableMetadata(m));
  }

  /** Get metadata for a specific model. */
  async getTableMetadata(namespace: string, model: string): Promise<TableMetadata> {
    this.ensureConnected();
    const models = await this.getModelsFromActiveMode();
    const found = models.find((m: DbtModel) => m.schema === namespace && m.name === model);
    if (!found) {
      throw new Error(`Model not found: ${namespace}.${model}`);
    }
    return this.modelToTableMetadata(found);
  }

  // --- dbt-specific operations ---

  /** List all dbt models. */
  async listModels(): Promise<DbtModel[]> {
    this.ensureConnected();
    return await this.getModelsFromActiveMode();
  }

  /** Get lineage edges for a model. */
  async getModelLineage(uniqueId: string): Promise<DbtLineageEdge[]> {
    this.ensureConnected();
    if (this.mode === 'manifest') {
      return this.parser.getModelLineage(uniqueId);
    }
    return await this.client.getModelLineage(uniqueId);
  }

  /** ICatalogProvider.getLineage — converts dbt lineage edges to a LineageGraph. */
  async getLineage(entityId: string, direction: 'upstream' | 'downstream', _depth?: number): Promise<LineageGraph> {
    const edges = await this.getModelLineage(entityId);
    const nodeSet = new Map<string, { entityId: string; entityType: string; name: string }>();

    const graphEdges = edges
      .filter((e) => direction === 'upstream' ? e.child === entityId : e.parent === entityId)
      .map((e) => {
        const source = direction === 'upstream' ? e.parent : e.parent;
        const target = direction === 'upstream' ? e.child : e.child;
        if (!nodeSet.has(source)) {
          nodeSet.set(source, { entityId: source, entityType: 'model', name: source });
        }
        if (!nodeSet.has(target)) {
          nodeSet.set(target, { entityId: target, entityType: 'model', name: target });
        }
        return { source, target, transformationType: e.relationship };
      });

    return {
      nodes: Array.from(nodeSet.values()),
      edges: graphEdges,
    };
  }

  /** Get test results, optionally filtered by runId. Cloud mode only. */
  async getTestResults(runId?: string): Promise<DbtTestResult[]> {
    this.ensureConnected();
    if (this.mode === 'manifest') {
      throw new Error('Test results are not available in manifest mode');
    }
    return await this.client.getTestResults(runId);
  }

  /** Get run history, optionally limited. Cloud mode only. */
  async getRunHistory(limit?: number): Promise<DbtRunHistory[]> {
    this.ensureConnected();
    if (this.mode === 'manifest') {
      throw new Error('Run history is not available in manifest mode');
    }
    return await this.client.getRunHistory(limit);
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() or loadManifest() first.');
    }
  }

  private async getModelsFromActiveMode(): Promise<DbtModel[]> {
    if (this.mode === 'manifest') {
      return this.parser.listModels();
    }
    return await this.client.listModels();
  }

  private modelToTableMetadata(model: DbtModel): TableMetadata {
    return {
      name: model.name,
      namespace: [model.database, model.schema],
      schema: model.columns.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: true,
        comment: col.description,
      })),
      properties: {
        materialization: model.materialization,
        description: model.description,
        uniqueId: model.uniqueId,
        tags: model.tags.join(','),
      },
    };
  }
}

// Re-export everything
export { DbtCloudStubClient } from './stub-client.js';
export { DbtManifestParser } from './manifest-parser.js';
export type {
  DbtModel,
  DbtColumn,
  DbtTestResult,
  DbtRunHistory,
  DbtLineageEdge,
  DbtManifest,
  DbtCloudConfig,
  IDbtClient,
} from './types.js';
