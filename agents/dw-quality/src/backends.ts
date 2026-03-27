/**
 * Shared backend instances for the dw-quality agent.
 *
 * Initializes and seeds the infrastructure stubs so all tools
 * share the same in-memory state. Provides:
 * - InMemoryWarehouseConnector: table schemas for profiling
 * - InMemoryKeyValueStore: caching computed scores
 * - InMemoryRelationalStore: historical quality metrics for anomaly detection
 */

import {
  createWarehouseConnector,
  InMemoryWarehouseConnector,
  createKeyValueStore,
  createRelationalStore,
  InMemoryRelationalStore,
  createMessageBus,
} from '@data-workers/infrastructure-stubs';

/** Warehouse connector with seeded table schemas. */
export const warehouseConnector = await createWarehouseConnector();
if (warehouseConnector instanceof InMemoryWarehouseConnector) {
  warehouseConnector.seed();
}

/** Key-value store for caching quality scores. */
export const kvStore = await createKeyValueStore();

/** Relational store with 14 days of historical quality metrics. */
export const relationalStore = await createRelationalStore();

/** Message bus for cross-agent event subscriptions. */
export const messageBus = await createMessageBus();
if (relationalStore instanceof InMemoryRelationalStore) {
  relationalStore.seed();
}

/**
 * Add a test table with a configurable null rate for testing purposes.
 * Inserts a table into the warehouse connector with columns that have
 * the specified nullable settings.
 *
 * @param tableName - Table name to create.
 * @param nullableColumns - If true, all non-ID columns are nullable (simulating high nulls).
 */
export function addTestTable(tableName: string, nullableColumns: boolean): void {
  if (!(warehouseConnector instanceof InMemoryWarehouseConnector)) return;

  const customerId = 'cust-1';
  const source = 'snowflake';
  const database = 'analytics';
  const schema = 'public';

  // Build a key for direct access — we use alterTable to add columns to a new table
  // First, we need to register the table via the connector
  // The warehouse connector doesn't have a direct createTable, so we use internal knowledge
  // Instead, we'll use a separate approach: modify the connector to add the table
  // For now, we leverage the fact that the connector's seed method sets tables via internal Map

  // Since InMemoryWarehouseConnector only exposes getTableSchema/alterTable/listTables/seed,
  // we need to create the table by seeding it. We'll use the connector's internal structure.
  // The simplest approach: re-instantiate or use a workaround.

  // Actually, the connector doesn't have a public createTable. We'll add the table data
  // by accessing it via the warehouse connector's seed pattern. Since we can't modify
  // the infrastructure-stubs here, we'll create a helper that works around this.

  // Workaround: We'll extend the connector or use Object to access privates for testing.
  // This is acceptable in a stub/testing context.
  const connector = warehouseConnector as unknown as {
    tables: Map<string, { columns: Array<{ name: string; type: string; nullable: boolean }>; updatedAt: number }>;
  };
  const key = `${customerId}:${source}:${database}.${schema}.${tableName}`;
  connector.tables.set(key, {
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false },
      { name: 'name', type: 'VARCHAR(255)', nullable: nullableColumns },
      { name: 'email', type: 'VARCHAR(255)', nullable: nullableColumns },
      { name: 'phone', type: 'VARCHAR(50)', nullable: nullableColumns },
      { name: 'address', type: 'VARCHAR(500)', nullable: nullableColumns },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
    updatedAt: Date.now(),
  });
}
