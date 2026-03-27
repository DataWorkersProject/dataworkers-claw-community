/**
 * Apache Nessie Catalog Versioning Connector.
 *
 * Implements ICatalogProvider for Nessie, backed by either a stubbed
 * in-memory client or a real client using REST API v2 via fetch.
 */

import type {
  ICatalogProvider,
  CatalogCapability,
  NamespaceInfo,
  TableMetadata,
  ConnectorHealthStatus,
  TableInfo,
} from '../../shared/types.js';
import { NessieStubClient } from './stub-client.js';
import type {
  INessieClient,
  NessieBranch,
  NessieEntry,
  NessieContentKey,
  NessieIcebergTable,
  NessieDiff,
  NessieCommit,
} from './types.js';

export class NessieConnector implements ICatalogProvider {
  readonly connectorType = 'nessie';
  readonly providerType = 'nessie';
  readonly capabilities: CatalogCapability[] = ['discovery', 'versioning'];

  private client: INessieClient;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(client?: INessieClient) {
    this.client = client ?? new NessieStubClient();
  }

  /** Create a NessieConnector from environment variables. */
  static fromEnv(): NessieConnector {
    const url = process.env.NESSIE_URL;
    const token = process.env.NESSIE_AUTH_TOKEN;

    // Real client stripped in OSS edition — always use stub
    void url; void token;
    return new NessieConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Connect and seed data for stub mode. */
  connect(): void {
    if (this.client instanceof NessieStubClient) {
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
    if (this.client instanceof NessieStubClient) {
      this.client = new NessieStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): ConnectorHealthStatus {
    const start = Date.now();
    const healthy = this.connected;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- ICatalogProvider methods ---

  /** List branches as namespaces. */
  listNamespaces(): NamespaceInfo[] {
    this.ensureConnected();
    const refs = this.client.listReferences() as NessieBranch[];
    return refs.filter((r) => r.type === 'BRANCH').map((r) => ({
      name: [r.name],
      properties: {
        hash: r.hash,
        type: r.type,
      },
    }));
  }

  /** List tables on a branch. */
  listTables(namespace: string): TableMetadata[] {
    this.ensureConnected();
    const entries = this.client.listContent(namespace) as NessieEntry[];
    return entries
      .filter((e) => e.type !== 'NAMESPACE')
      .map((e) => ({
        name: e.key.elements[e.key.elements.length - 1],
        namespace: e.key.elements.slice(0, -1),
        schema: [],
        properties: {
          contentId: e.contentId,
          type: e.type,
          key: e.key.elements.join('.'),
        },
      }));
  }

  /** Get table metadata by key on a branch. */
  getTableMetadata(namespace: string, table: string): TableMetadata {
    this.ensureConnected();
    const entries = this.client.listContent(namespace) as NessieEntry[];
    const entry = entries.find((e) =>
      e.key.elements[e.key.elements.length - 1] === table && e.type !== 'NAMESPACE',
    );
    if (!entry) {
      throw new Error(`Table not found: ${table} on ${namespace}`);
    }
    const tableData = this.client.getContent(namespace, entry.key) as NessieIcebergTable;
    return {
      name: table,
      namespace: entry.key.elements.slice(0, -1),
      schema: [],
      properties: {
        contentId: entry.contentId,
        type: entry.type,
        metadataLocation: tableData.metadataLocation,
        snapshotId: String(tableData.snapshotId),
        schemaId: String(tableData.schemaId),
      },
    };
  }

  /** Search tables across the main branch. */
  searchTables(query: string): TableInfo[] {
    this.ensureConnected();
    const entries = this.client.listContent('main') as NessieEntry[];
    const q = query.toLowerCase();
    return entries
      .filter((e) => e.type !== 'NAMESPACE' && e.key.elements.some((el) => el.toLowerCase().includes(q)))
      .map((e) => ({
        name: e.key.elements[e.key.elements.length - 1],
        namespace: e.key.elements.slice(0, -1),
        tableType: e.type,
        properties: { contentId: e.contentId },
      }));
  }

  // --- Nessie-specific versioning operations ---

  /** List all references (branches and tags). */
  listReferences(): NessieBranch[] {
    this.ensureConnected();
    return this.client.listReferences() as NessieBranch[];
  }

  /** List content on a reference. */
  listContent(ref: string): NessieEntry[] {
    this.ensureConnected();
    return this.client.listContent(ref) as NessieEntry[];
  }

  /** Get content (table metadata) at a reference for a key. */
  getContent(ref: string, key: NessieContentKey): NessieIcebergTable {
    this.ensureConnected();
    return this.client.getContent(ref, key) as NessieIcebergTable;
  }

  /** Create a new branch from an existing reference. */
  createBranch(name: string, from: string): NessieBranch {
    this.ensureConnected();
    return this.client.createBranch(name, from) as NessieBranch;
  }

  /** Merge a branch into another. */
  mergeBranch(from: string, to: string): { hash: string } {
    this.ensureConnected();
    return this.client.mergeBranch(from, to) as { hash: string };
  }

  /** Get diff between two references. */
  diffRefs(from: string, to: string): NessieDiff[] {
    this.ensureConnected();
    return this.client.diffRefs(from, to) as NessieDiff[];
  }

  /** Get commit log for a reference. */
  commitLog(ref: string): NessieCommit[] {
    this.ensureConnected();
    return this.client.commitLog(ref) as NessieCommit[];
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// Re-export everything
export { NessieStubClient } from './stub-client.js';
export type {
  INessieClient,
  NessieBranch,
  NessieEntry,
  NessieContentKey,
  NessieIcebergTable,
  NessieDiff,
  NessieCommit,
} from './types.js';
