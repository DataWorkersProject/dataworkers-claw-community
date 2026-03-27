/**
 * OpenLineage/Marquez Connector.
 *
 * Implements ICatalogProvider for Marquez REST API (lineage consumer)
 * and OpenLineage event protocol (lineage producer).
 */

import type {
  ICatalogProvider,
  CatalogCapability,
  NamespaceInfo,
  TableMetadata,
  ConnectorHealthStatus,
  LineageGraph,
} from '../../shared/types.js';
import { MarquezStubClient } from './stub-client.js';
import type {
  IMarquezClient,
  MarquezNamespace,
  MarquezDataset,
  MarquezJob,
  MarquezLineageGraph,
  OpenLineageRunEvent,
} from './types.js';

export class OpenLineageConnector implements ICatalogProvider {
  readonly connectorType = 'openlineage';
  readonly providerType = 'openlineage';
  readonly capabilities: CatalogCapability[] = ['discovery', 'lineage'];

  private client: IMarquezClient;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: IMarquezClient) {
    this.client = client ?? new MarquezStubClient();
  }

  /** Create an OpenLineageConnector from environment variables. */
  static fromEnv(): OpenLineageConnector {
    const marquezUrl = process.env.MARQUEZ_URL;
    // Future: process.env.OPENLINEAGE_URL and process.env.OPENLINEAGE_API_KEY
    // will be used when real OpenLineage event producer is wired up.

    if (marquezUrl) {
      // For real mode, we'd use MarquezRestClient + OpenLineageEventProducer
      // but dynamic import keeps SDK optional
      return new OpenLineageConnector();
    }
    return new OpenLineageConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect and seed data for stub mode. */
  connect(): void {
    if (this.client instanceof MarquezStubClient) {
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
    if (this.client instanceof MarquezStubClient) {
      this.client = new MarquezStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- ICatalogProvider methods ---

  /** List namespaces. */
  listNamespaces(): NamespaceInfo[] {
    this.ensureConnected();
    const namespaces = this.client.listNamespaces() as MarquezNamespace[];
    return namespaces.map((ns) => ({
      name: [ns.name],
      properties: {
        ownerName: ns.ownerName,
        createdAt: String(ns.createdAt),
      },
    }));
  }

  /** List datasets in a namespace as table metadata. */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const datasets = this.client.listDatasets(namespace) as MarquezDataset[];
    return datasets.map((ds) => ({
      name: ds.name,
      namespace: [ds.namespace],
      schema: ds.fields.map((f) => ({
        name: f.name,
        type: f.type,
        nullable: true,
        comment: f.description || undefined,
      })),
      properties: {
        sourceName: ds.sourceName,
      },
      createdAt: ds.createdAt,
    }));
  }

  /** Get detailed dataset metadata. */
  getTableMetadata(namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    const datasets = this.client.listDatasets(namespace) as MarquezDataset[];
    const found = datasets.find((ds) => ds.name === table);
    if (!found) {
      throw new Error(`Dataset not found: ${namespace}.${table}`);
    }
    return {
      name: found.name,
      namespace: [found.namespace],
      schema: found.fields.map((f) => ({
        name: f.name,
        type: f.type,
        nullable: true,
        comment: f.description || undefined,
      })),
      properties: {
        sourceName: found.sourceName,
      },
      createdAt: found.createdAt,
    };
  }

  // --- Optional ICatalogProvider methods ---

  /** Get lineage for an entity. */
  getLineage(entityId: string, direction: 'upstream' | 'downstream', depth?: number): LineageGraph {
    this.ensureConnected();
    const graph = this.client.getLineage(entityId, depth) as MarquezLineageGraph;
    const nodes = graph.graph.map((node) => ({
      entityId: node.id,
      entityType: node.type.toLowerCase(),
      name: node.id,
    }));
    const edges: Array<{ source: string; target: string }> = [];
    for (const node of graph.graph) {
      for (const outEdge of node.outEdges) {
        edges.push({ source: node.id, target: outEdge.destination });
      }
    }
    return { nodes, edges };
  }

  // --- OpenLineage-specific operations ---

  /** List all Marquez namespaces. */
  listMarquezNamespaces(): MarquezNamespace[] {
    this.ensureConnected();
    return this.client.listNamespaces() as MarquezNamespace[];
  }

  /** List datasets in a namespace. */
  listDatasets(namespace: string): MarquezDataset[] {
    this.ensureConnected();
    return this.client.listDatasets(namespace) as MarquezDataset[];
  }

  /** List jobs in a namespace. */
  listJobs(namespace: string): MarquezJob[] {
    this.ensureConnected();
    return this.client.listJobs(namespace) as MarquezJob[];
  }

  /** Get a Marquez lineage graph. */
  getMarquezLineage(nodeId: string, depth?: number): MarquezLineageGraph {
    this.ensureConnected();
    return this.client.getLineage(nodeId, depth) as MarquezLineageGraph;
  }

  /** Emit a run event. */
  emitRunEvent(event: OpenLineageRunEvent): void {
    this.ensureConnected();
    this.client.emitRunEvent(event);
  }

  /** Emit a dataset event (alias for emitRunEvent). */
  emitDatasetEvent(event: OpenLineageRunEvent): void {
    this.emitRunEvent(event);
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// Re-export everything
export { MarquezStubClient } from './stub-client.js';
export { MarquezRestClient } from './marquez-client.js';
export { OpenLineageEventProducer } from './event-producer.js';
export type {
  IMarquezClient,
  MarquezConnectionConfig,
  MarquezNamespace,
  MarquezDataset,
  DatasetField,
  MarquezJob,
  MarquezLineageGraph,
  MarquezLineageNode,
  OpenLineageRunEvent,
} from './types.js';
