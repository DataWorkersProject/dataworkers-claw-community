/**
 * Apache Iceberg REST Catalog Connector.
 *
 * Implements a DataConnector-like interface for interacting with
 * an Iceberg REST Catalog, backed by a stubbed in-memory client.
 */

import type { ICatalogProvider, CatalogCapability } from '../../shared/types.js';
import { IcebergRESTClient } from './rest-client.js';
import type {
  IcebergNamespace,
  IcebergSnapshot,
  IcebergSchema,
} from './types.js';

export interface TableStatistics {
  totalRecords: number;
  totalDataFiles: number;
  totalSizeBytes: number;
}

export class IcebergConnector implements ICatalogProvider {
  readonly connectorType = 'iceberg';
  readonly providerType = 'iceberg';
  readonly capabilities: CatalogCapability[] = ['discovery'];

  private client: IcebergRESTClient;
  private endpoint: string | null = null;
  private connected = false;

  constructor() {
    this.client = new IcebergRESTClient();
  }

  /** Validate and store the catalog endpoint, seed data. */
  connect(endpoint: string): void {
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error('A valid endpoint URL is required');
    }
    this.endpoint = endpoint;
    this.client.seed();
    this.connected = true;
  }

  /** Disconnect and clear state. */
  disconnect(): void {
    this.endpoint = null;
    this.connected = false;
    this.client = new IcebergRESTClient();
  }

  /** Check connectivity. */
  healthCheck(): { healthy: boolean; latencyMs: number } {
    const start = Date.now();
    const healthy = this.connected && this.endpoint !== null;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- Catalog operations ---

  listNamespaces(): IcebergNamespace[] {
    this.ensureConnected();
    return this.client.listNamespaces();
  }

  listTables(namespace: string): any[] {
    this.ensureConnected();
    this.validateNamespace(namespace);
    return this.client.listTables(namespace);
  }

  getTableMetadata(namespace: string, table: string): any {
    this.ensureConnected();
    return this.client.loadTable(namespace, table);
  }

  getSnapshots(namespace: string, table: string): IcebergSnapshot[] {
    this.ensureConnected();
    const meta = this.client.loadTable(namespace, table);
    return meta.snapshots;
  }

  /**
   * Return the schema associated with a specific snapshot.
   * In a real implementation this would fetch the schema version
   * that was current at the time of the snapshot. Here we derive
   * a schema-evolution simulation: earlier snapshots may have fewer fields.
   */
  getSchemaAtSnapshot(namespace: string, table: string, snapshotId: number): IcebergSchema {
    this.ensureConnected();
    const meta = this.client.loadTable(namespace, table);
    const snapIndex = meta.snapshots.findIndex((s) => s.snapshotId === snapshotId);
    if (snapIndex === -1) {
      throw new Error(`Snapshot ${snapshotId} not found for ${namespace}.${table}`);
    }

    // Simulate schema evolution: the earliest snapshot sees a subset of fields.
    // Each subsequent snapshot may add one more field until the full schema.
    const totalFields = meta.schema.fields.length;
    const totalSnapshots = meta.snapshots.length;
    const fieldsVisible = Math.max(
      2,
      Math.min(totalFields, Math.ceil(totalFields * ((snapIndex + 1) / totalSnapshots))),
    );

    return {
      schemaId: meta.schema.schemaId,
      fields: meta.schema.fields.slice(0, fieldsVisible),
    };
  }

  /** Return table statistics from the current (latest) snapshot. */
  getTableStatistics(namespace: string, table: string): TableStatistics {
    this.ensureConnected();
    const meta = this.client.loadTable(namespace, table);
    const current = meta.snapshots.find((s) => s.snapshotId === meta.currentSnapshotId);
    if (!current) {
      throw new Error(`Current snapshot not found for ${namespace}.${table}`);
    }
    return {
      totalRecords: current.summary.totalRecords ?? 0,
      totalDataFiles: current.summary.totalDataFiles ?? 0,
      totalSizeBytes: current.summary.totalSizeBytes ?? 0,
    };
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }

  private validateNamespace(namespace: string): void {
    const namespaces = this.client.listNamespaces();
    const exists = namespaces.some((ns) => ns.name.join('.') === namespace);
    if (!exists) {
      throw new Error(`Namespace not found: ${namespace}`);
    }
  }
}

// Re-export everything
export { IcebergRESTClient } from './rest-client.js';
export type {
  IcebergNamespace,
  IcebergTable,
  IcebergTableMetadata,
  IcebergSnapshot,
  IcebergSchema,
  IcebergField,
  IcebergPartitionSpec,
  IcebergSortOrder,
} from './types.js';
