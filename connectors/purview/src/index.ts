/**
 * Azure Purview Data Governance Connector.
 *
 * Implements ICatalogProvider for Azure Purview, backed by either a stubbed
 * in-memory client or a real client using REST API via fetch.
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
import { PurviewStubClient } from './stub-client.js';
import type {
  IPurviewClient,
  PurviewEntity,
  PurviewSearchResult,
  PurviewLineageResult,
  PurviewGlossaryTerm,
  PurviewCollection,
} from './types.js';

export class PurviewConnector implements ICatalogProvider {
  readonly connectorType = 'purview';
  readonly providerType = 'purview';
  readonly capabilities: CatalogCapability[] = ['discovery', 'lineage', 'governance', 'search'];

  private client: IPurviewClient;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: IPurviewClient) {
    this.client = client ?? new PurviewStubClient();
  }

  /** Create a PurviewConnector from environment variables. */
  static fromEnv(): PurviewConnector {
    const endpoint = process.env.AZURE_PURVIEW_ENDPOINT;
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (endpoint && tenantId && clientId && clientSecret) {
      const realClient = new PurviewRealClient({ endpoint, tenantId, clientId, clientSecret });
      const connector = new PurviewConnector(realClient);
      connector.mode = 'real';
      return connector;
    }
    return new PurviewConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect and seed data for stub mode. */
  connect(): void {
    if (this.client instanceof PurviewStubClient) {
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
    if (this.client instanceof PurviewStubClient) {
      this.client = new PurviewStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- ICatalogProvider methods ---

  /** List collections as namespaces. */
  listNamespaces(): NamespaceInfo[] {
    this.ensureConnected();
    const collections = this.client.listCollections() as PurviewCollection[];
    return collections.map((c) => ({
      name: [c.name],
      properties: {
        friendlyName: c.friendlyName,
        parentCollection: c.parentCollection,
      },
    }));
  }

  /** List entities matching namespace as search query. */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const result = this.client.searchEntities(namespace) as PurviewSearchResult;
    return result.entities.map((e) => this.entityToTableMetadata(e));
  }

  /** Get detailed entity metadata by GUID. */
  getTableMetadata(_namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    const entity = this.client.getEntity(table) as PurviewEntity;
    return this.entityToTableMetadata(entity);
  }

  /** Search entities across Purview. */
  searchTables(query: string): TableInfo[] {
    this.ensureConnected();
    const result = this.client.searchEntities(query) as PurviewSearchResult;
    return result.entities.map((e) => ({
      name: String(e.attributes['name'] ?? ''),
      namespace: [e.typeName],
      tableType: e.typeName,
      properties: {
        guid: e.guid,
        status: e.status,
        classifications: e.classifications.join(','),
      },
    }));
  }

  /** Get lineage for an entity. */
  getLineage(entityId: string): LineageGraph {
    this.ensureConnected();
    const result = this.client.getLineage(entityId) as PurviewLineageResult;
    const nodes = Object.entries(result.guidEntityMap).map(([guid, entity]) => ({
      entityId: guid,
      entityType: entity.typeName,
      name: String(entity.attributes['name'] ?? guid),
    }));
    const edges = result.relations.map((r) => ({
      source: r.fromEntityId,
      target: r.toEntityId,
      transformationType: r.relationshipType,
    }));
    return { nodes, edges };
  }

  // --- Purview-specific operations ---

  /** Search entities by query. */
  searchEntities(query: string): PurviewSearchResult {
    this.ensureConnected();
    return this.client.searchEntities(query) as PurviewSearchResult;
  }

  /** Get a specific entity by GUID. */
  getEntity(guid: string): PurviewEntity {
    this.ensureConnected();
    return this.client.getEntity(guid) as PurviewEntity;
  }

  /** Get lineage result for an entity. */
  getPurviewLineage(guid: string): PurviewLineageResult {
    this.ensureConnected();
    return this.client.getLineage(guid) as PurviewLineageResult;
  }

  /** List all glossary terms. */
  listGlossaryTerms(): PurviewGlossaryTerm[] {
    this.ensureConnected();
    return this.client.listGlossaryTerms() as PurviewGlossaryTerm[];
  }

  /** List all collections. */
  listCollections(): PurviewCollection[] {
    this.ensureConnected();
    return this.client.listCollections() as PurviewCollection[];
  }

  // --- Private helpers ---

  private entityToTableMetadata(e: PurviewEntity): TableMetadata {
    return {
      name: String(e.attributes['name'] ?? ''),
      namespace: [e.typeName],
      schema: [],
      properties: {
        guid: e.guid,
        qualifiedName: String(e.attributes['qualifiedName'] ?? ''),
        status: e.status,
        classifications: e.classifications.join(','),
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
export { PurviewStubClient } from './stub-client.js';
export type {
  IPurviewClient,
  PurviewEntity,
  PurviewSearchResult,
  PurviewLineageResult,
  PurviewLineageRelation,
  PurviewGlossaryTerm,
  PurviewCollection,
} from './types.js';
