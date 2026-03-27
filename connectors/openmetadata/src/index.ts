/**
 * OpenMetadata Connector.
 *
 * Implements ICatalogProvider for OpenMetadata REST API, backed by either
 * a stubbed in-memory client or a real REST client.
 */

import type {
  ICatalogProvider,
  CatalogCapability,
  NamespaceInfo,
  TableMetadata,
  ConnectorHealthStatus,
  TableInfo,
  LineageGraph,
  Permission,
  Tag,
} from '../../shared/types.js';
import { OpenMetadataStubClient } from './stub-client.js';
import type {
  IOpenMetadataClient,
  OMDatabase,
  OMTable,
  OMLineageGraph,
  OMQualityTestResult,
  OpenMetadataConnectionConfig,
} from './types.js';

export class OpenMetadataConnector implements ICatalogProvider {
  readonly connectorType = 'openmetadata';
  readonly providerType = 'openmetadata';
  readonly capabilities: CatalogCapability[] = ['discovery', 'lineage', 'governance', 'quality', 'search'];

  private client: IOpenMetadataClient;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: IOpenMetadataClient) {
    this.client = client ?? new OpenMetadataStubClient();
  }

  /** Create an OpenMetadataConnector from environment variables. */
  static fromEnv(): OpenMetadataConnector {
    const url = process.env.OPENMETADATA_URL;
    const token = process.env.OPENMETADATA_TOKEN;

    if (url && token) {
      const realClient = new OpenMetadataRealClient({ url, token });
      const connector = new OpenMetadataConnector(realClient);
      connector.mode = 'real';
      return connector;
    }
    return new OpenMetadataConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect and seed data for stub mode. */
  connect(): void {
    if (this.client instanceof OpenMetadataStubClient) {
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
    if (this.client instanceof OpenMetadataStubClient) {
      this.client = new OpenMetadataStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- ICatalogProvider methods ---

  /** List databases as namespaces. */
  listNamespaces(): NamespaceInfo[] {
    this.ensureConnected();
    const databases = this.client.listDatabases() as OMDatabase[];
    return databases.map((db) => ({
      name: [db.name],
      properties: {
        id: db.id,
        fullyQualifiedName: db.fullyQualifiedName,
        service: db.service,
      },
    }));
  }

  /** List tables in a database namespace. */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const tables = this.client.listTables(namespace) as OMTable[];
    return tables.map((t) => this.mapToTableMetadata(t));
  }

  /** Get detailed table metadata. */
  getTableMetadata(namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    // First find the table by listing, then get by ID for full details
    const tables = this.client.listTables(namespace) as OMTable[];
    const found = tables.find((t) => t.name === table);
    if (!found) {
      throw new Error(`Table not found: ${namespace}.${table}`);
    }
    return this.mapToTableMetadata(found);
  }

  // --- Optional ICatalogProvider methods ---

  /** Search tables by query string. */
  searchTables(query: string): TableInfo[] {
    this.ensureConnected();
    const tables = this.client.searchTables(query) as OMTable[];
    return tables.map((t) => ({
      name: t.name,
      namespace: [t.database],
      tableType: 'TABLE',
      properties: {
        id: t.id,
        fullyQualifiedName: t.fullyQualifiedName,
      },
    }));
  }

  /** Get lineage for a table. */
  getLineage(entityId: string, direction: 'upstream' | 'downstream', depth?: number): LineageGraph {
    this.ensureConnected();
    const graph = this.client.getLineage(entityId, direction, depth) as OMLineageGraph;
    const edges = direction === 'upstream' ? graph.upstreamEdges : graph.downstreamEdges;
    return {
      nodes: graph.nodes.map((nodeId) => ({
        entityId: nodeId,
        entityType: 'table',
        name: nodeId,
      })),
      edges: edges.map((e) => ({
        source: e.fromEntity,
        target: e.toEntity,
      })),
    };
  }

  /** Get tags as governance permissions. */
  getPermissions(resource: string): Permission[] {
    this.ensureConnected();
    // Use tags to represent governance info
    const tags = this.getTags(resource);
    return tags.map((t) => ({
      principal: 'system',
      resource: t.resource,
      privilege: t.key,
      granted: true,
    }));
  }

  /** Get tags for a table. */
  getTags(resource: string): Tag[] {
    this.ensureConnected();
    // Find table by ID or name
    try {
      const table = this.client.getTable(resource) as OMTable;
      return table.tags.map((t) => ({
        key: t.tagFQN,
        value: t.source,
        resource: table.fullyQualifiedName,
      }));
    } catch {
      return [];
    }
  }

  // --- OpenMetadata-specific operations ---

  /** List all databases. */
  listDatabases(): OMDatabase[] {
    this.ensureConnected();
    return this.client.listDatabases() as OMDatabase[];
  }

  /** Get a table by ID. */
  getOMTable(tableId: string): OMTable {
    this.ensureConnected();
    return this.client.getTable(tableId) as OMTable;
  }

  /** Get lineage graph for a table. */
  getOMLineage(tableId: string, direction: 'upstream' | 'downstream', depth?: number): OMLineageGraph {
    this.ensureConnected();
    return this.client.getLineage(tableId, direction, depth) as OMLineageGraph;
  }

  /** Get quality test results for a table. */
  getQualityTests(tableId: string): OMQualityTestResult[] {
    this.ensureConnected();
    return this.client.getQualityTests(tableId) as OMQualityTestResult[];
  }

  // --- Private helpers ---

  private mapToTableMetadata(t: OMTable): TableMetadata {
    return {
      name: t.name,
      namespace: [t.database],
      schema: t.columns.map((c) => ({
        name: c.name,
        type: c.dataType,
        nullable: true,
        comment: c.description || undefined,
      })),
      properties: {
        id: t.id,
        fullyQualifiedName: t.fullyQualifiedName,
        tags: t.tags.map((tag) => tag.tagFQN).join(','),
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
export { OpenMetadataStubClient } from './stub-client.js';
export type {
  IOpenMetadataClient,
  OpenMetadataConnectionConfig,
  OMDatabase,
  OMTable,
  OMColumn,
  OMTag,
  OMLineageEdge,
  OMLineageGraph,
  OMQualityTestResult,
} from './types.js';
