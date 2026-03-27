/**
 * Google Cloud Dataplex Connector.
 *
 * Implements ICatalogProvider for Dataplex, backed by either a stubbed
 * in-memory client or a real client using @google-cloud/dataplex.
 */

import type {
  ICatalogProvider,
  CatalogCapability,
  NamespaceInfo,
  TableMetadata,
  ConnectorHealthStatus,
  TableInfo,
} from '../../shared/types.js';
import { DataplexStubClient } from './stub-client.js';
import type {
  IDataplexClient,
  DataplexLake,
  DataplexZone,
  DataplexEntity,
  DataplexEntry,
} from './types.js';

export class DataplexConnector implements ICatalogProvider {
  readonly connectorType = 'dataplex';
  readonly providerType = 'dataplex';
  readonly capabilities: CatalogCapability[] = ['discovery', 'search'];

  private client: IDataplexClient;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: IDataplexClient) {
    this.client = client ?? new DataplexStubClient();
  }

  /** Create a DataplexConnector from environment variables. */
  static fromEnv(): DataplexConnector {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.DATAPLEX_LOCATION;

    // Real client stripped in OSS edition — always use stub
    void project; void location;
    return new DataplexConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect and seed data for stub mode. */
  connect(): void {
    if (this.client instanceof DataplexStubClient) {
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
    if (this.client instanceof DataplexStubClient) {
      this.client = new DataplexStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- ICatalogProvider methods ---

  /** List lakes as namespaces. */
  listNamespaces(): NamespaceInfo[] {
    this.ensureConnected();
    const lakes = this.client.listLakes() as DataplexLake[];
    return lakes.map((l) => ({
      name: [l.displayName],
      properties: {
        resourceName: l.name,
        state: l.state,
        metastore: l.metastore,
      },
    }));
  }

  /** List entities in a zone as tables. */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const entities = this.client.listEntities(namespace) as DataplexEntity[];
    return entities.map((e) => this.entityToTableMetadata(e));
  }

  /** Get detailed entity metadata. */
  getTableMetadata(_namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    const entity = this.client.getEntity(table) as DataplexEntity;
    return this.entityToTableMetadata(entity);
  }

  /** Search entries across Dataplex. */
  searchTables(query: string): TableInfo[] {
    this.ensureConnected();
    const entries = this.client.searchEntries(query) as DataplexEntry[];
    return entries.map((e) => ({
      name: e.fullyQualifiedName,
      namespace: [e.entryType],
      tableType: e.entryType,
      properties: {
        resourceName: e.name,
      },
    }));
  }

  // --- Dataplex-specific operations ---

  /** List all lakes. */
  listLakes(): DataplexLake[] {
    this.ensureConnected();
    return this.client.listLakes() as DataplexLake[];
  }

  /** List zones in a lake. */
  listZones(lake: string): DataplexZone[] {
    this.ensureConnected();
    return this.client.listZones(lake) as DataplexZone[];
  }

  /** List entities in a zone. */
  listEntities(zone: string): DataplexEntity[] {
    this.ensureConnected();
    return this.client.listEntities(zone) as DataplexEntity[];
  }

  /** Get a specific entity by name. */
  getEntity(name: string): DataplexEntity {
    this.ensureConnected();
    return this.client.getEntity(name) as DataplexEntity;
  }

  /** Search entries by query. */
  searchEntries(query: string): DataplexEntry[] {
    this.ensureConnected();
    return this.client.searchEntries(query) as DataplexEntry[];
  }

  // --- Private helpers ---

  private entityToTableMetadata(e: DataplexEntity): TableMetadata {
    return {
      name: e.displayName,
      namespace: [e.system],
      schema: e.schema.fields.map((f) => ({
        name: f.name,
        type: f.type,
        nullable: f.mode !== 'REQUIRED',
        comment: f.description || undefined,
      })),
      properties: {
        resourceName: e.name,
        type: e.type,
        system: e.system,
        dataPath: e.dataPath,
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
export { DataplexStubClient } from './stub-client.js';
export type {
  IDataplexClient,
  DataplexLake,
  DataplexZone,
  DataplexEntity,
  DataplexSchema,
  DataplexField,
  DataplexEntry,
} from './types.js';
