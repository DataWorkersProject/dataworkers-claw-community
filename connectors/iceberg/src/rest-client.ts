/**
 * Stubbed Iceberg REST Catalog API client.
 * Uses an in-memory store to simulate the Iceberg REST Catalog API.
 */

import type {
  IcebergNamespace,
  IcebergTable,
  IcebergTableMetadata,
  IcebergSnapshot,
  IcebergSchema,
  IcebergField,
  IcebergPartitionSpec,
  IcebergSortOrder,
} from './types.js';

export class IcebergRESTClient {
  private namespaces: Map<string, IcebergNamespace> = new Map();
  private tables: Map<string, IcebergTableMetadata> = new Map();
  private seeded = false;

  /** Pre-load with realistic data simulating an Iceberg REST Catalog. */
  seed(): void {
    if (this.seeded) return;

    // --- Namespace ---
    this.namespaces.set('analytics', {
      name: ['analytics'],
      properties: {
        owner: 'data-engineering',
        location: 's3://warehouse/analytics',
      },
    });

    const now = Date.now();
    const DAY = 86_400_000;

    // --- Helper: generate snapshots spanning 30 days ---
    const makeSnapshots = (
      count: number,
      totalRecords: number,
      totalDataFiles: number,
      totalSizeBytes: number,
    ): IcebergSnapshot[] => {
      const snapshots: IcebergSnapshot[] = [];
      for (let i = 0; i < count; i++) {
        const fraction = (i + 1) / count;
        snapshots.push({
          snapshotId: 1000 + i,
          timestamp: now - DAY * 30 + DAY * (30 * fraction),
          summary: {
            operation: i === 0 ? 'append' : i % 2 === 0 ? 'overwrite' : 'append',
            totalRecords: Math.round(totalRecords * fraction),
            totalDataFiles: Math.round(totalDataFiles * fraction),
            totalSizeBytes: Math.round(totalSizeBytes * fraction),
          },
        });
      }
      return snapshots;
    };

    // --- Helper: build table metadata ---
    const buildTable = (
      tableId: string,
      schema: IcebergSchema,
      partitionSpec: IcebergPartitionSpec,
      sortOrder: IcebergSortOrder,
      snapshots: IcebergSnapshot[],
      props: Record<string, string> = {},
    ): IcebergTableMetadata => ({
      tableId,
      schema,
      partitionSpec,
      sortOrder,
      currentSnapshotId: snapshots[snapshots.length - 1].snapshotId,
      snapshots,
      properties: { 'write.format.default': 'parquet', ...props },
    });

    // --- orders ---
    const ordersSchema: IcebergSchema = {
      schemaId: 1,
      fields: [
        { id: 1, name: 'order_id', type: 'long', required: true, doc: 'Primary key' },
        { id: 2, name: 'customer_id', type: 'long', required: true },
        { id: 3, name: 'order_date', type: 'date', required: true },
        { id: 4, name: 'total_amount', type: 'decimal(12,2)', required: true },
        { id: 5, name: 'status', type: 'string', required: true },
        { id: 6, name: 'created_at', type: 'timestamptz', required: true },
      ],
    };
    this.tables.set('analytics.orders', buildTable(
      'analytics.orders',
      ordersSchema,
      { specId: 1, fields: [{ sourceId: 3, fieldId: 100, name: 'order_date_day', transform: 'day' }] },
      { orderId: 1, fields: [{ sourceId: 3, direction: 'desc', nullOrder: 'last' }] },
      makeSnapshots(5, 1_000_000, 500, 2_500_000_000),
    ));

    // --- customers ---
    const customersSchema: IcebergSchema = {
      schemaId: 1,
      fields: [
        { id: 1, name: 'customer_id', type: 'long', required: true, doc: 'Primary key' },
        { id: 2, name: 'email', type: 'string', required: true },
        { id: 3, name: 'name', type: 'string', required: true },
        { id: 4, name: 'signup_date', type: 'date', required: true },
        { id: 5, name: 'tier', type: 'string', required: false },
      ],
    };
    this.tables.set('analytics.customers', buildTable(
      'analytics.customers',
      customersSchema,
      { specId: 1, fields: [{ sourceId: 4, fieldId: 200, name: 'signup_date_month', transform: 'month' }] },
      { orderId: 1, fields: [{ sourceId: 1, direction: 'asc', nullOrder: 'last' }] },
      makeSnapshots(4, 100_000, 50, 250_000_000),
    ));

    // --- events ---
    const eventsSchema: IcebergSchema = {
      schemaId: 1,
      fields: [
        { id: 1, name: 'event_id', type: 'string', required: true, doc: 'UUID' },
        { id: 2, name: 'event_type', type: 'string', required: true },
        { id: 3, name: 'user_id', type: 'long', required: true },
        { id: 4, name: 'event_ts', type: 'timestamptz', required: true },
        { id: 5, name: 'payload', type: 'string', required: false, doc: 'JSON payload' },
      ],
    };
    this.tables.set('analytics.events', buildTable(
      'analytics.events',
      eventsSchema,
      { specId: 1, fields: [{ sourceId: 4, fieldId: 300, name: 'event_ts_hour', transform: 'hour' }] },
      { orderId: 1, fields: [{ sourceId: 4, direction: 'desc', nullOrder: 'last' }] },
      makeSnapshots(5, 10_000_000, 2000, 15_000_000_000),
    ));

    // --- products ---
    const productsSchema: IcebergSchema = {
      schemaId: 1,
      fields: [
        { id: 1, name: 'product_id', type: 'long', required: true, doc: 'Primary key' },
        { id: 2, name: 'sku', type: 'string', required: true },
        { id: 3, name: 'name', type: 'string', required: true },
        { id: 4, name: 'category', type: 'string', required: true },
        { id: 5, name: 'price', type: 'decimal(10,2)', required: true },
        { id: 6, name: 'updated_at', type: 'timestamptz', required: true },
      ],
    };
    this.tables.set('analytics.products', buildTable(
      'analytics.products',
      productsSchema,
      { specId: 1, fields: [{ sourceId: 4, fieldId: 400, name: 'category_identity', transform: 'identity' }] },
      { orderId: 1, fields: [{ sourceId: 1, direction: 'asc', nullOrder: 'last' }] },
      makeSnapshots(3, 50_000, 25, 100_000_000),
    ));

    this.seeded = true;
  }

  /** List all namespaces. */
  listNamespaces(): IcebergNamespace[] {
    return Array.from(this.namespaces.values());
  }

  /** List tables in a namespace. */
  listTables(namespace: string): IcebergTable[] {
    const prefix = `${namespace}.`;
    const results: IcebergTable[] = [];
    for (const key of this.tables.keys()) {
      if (key.startsWith(prefix)) {
        const tableName = key.slice(prefix.length);
        results.push({ namespace: [namespace], name: tableName });
      }
    }
    return results;
  }

  /** Load full table metadata. */
  loadTable(namespace: string, table: string): IcebergTableMetadata {
    const key = `${namespace}.${table}`;
    const meta = this.tables.get(key);
    if (!meta) {
      throw new Error(`Table not found: ${key}`);
    }
    return meta;
  }

  /** Get a specific snapshot for a table. */
  getSnapshot(namespace: string, table: string, snapshotId: number): IcebergSnapshot {
    const meta = this.loadTable(namespace, table);
    const snap = meta.snapshots.find((s) => s.snapshotId === snapshotId);
    if (!snap) {
      throw new Error(`Snapshot ${snapshotId} not found for ${namespace}.${table}`);
    }
    return snap;
  }
}
