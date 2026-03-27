/**
 * Shared backend instances for the dw-schema agent.
 * Instantiates and seeds all infrastructure stubs used by tool handlers.
 *
 * Uses interface types (IKeyValueStore, IWarehouseConnector, IGraphDB, IMessageBus)
 * so production adapters can be swapped in via factory auto-detection.
 */

import {
  createKeyValueStore,
  createWarehouseConnector,
  createGraphDB,
  createMessageBus,
  InMemoryWarehouseConnector,
  InMemoryGraphDB,
  InMemoryMessageBus,
} from '@data-workers/infrastructure-stubs';

/** Redis-like key-value cache for schema snapshots. */
export const kvStore = await createKeyValueStore();

/** Simulated data warehouse with INFORMATION_SCHEMA queries. */
export const warehouseConnector = await createWarehouseConnector();
if (warehouseConnector instanceof InMemoryWarehouseConnector) {
  warehouseConnector.seed();
}

/** Lineage graph database for impact analysis. */
export const graphDB = await createGraphDB();
if (graphDB instanceof InMemoryGraphDB) {
  graphDB.seed();
}

/** Message bus for cross-agent event publishing. */
export const messageBus = await createMessageBus();
if (messageBus instanceof InMemoryMessageBus) {
  messageBus.seed();
}
