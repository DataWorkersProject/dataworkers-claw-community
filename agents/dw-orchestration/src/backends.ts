/**
 * Backend infrastructure instances for dw-orchestration.
 * Uses KV store for priority queue and heartbeats,
 * relational store for agent registry and task history,
 * and message bus for event routing.
 */

import {
  createKeyValueStore,
  InMemoryKeyValueStore,
  createRelationalStore,
  InMemoryRelationalStore,
  createMessageBus,
  InMemoryMessageBus,
} from '@data-workers/infrastructure-stubs';

/** KV store for priority queue (sorted set emulation) and heartbeat tracking. */
export const kvStore = await createKeyValueStore();

/** Relational store for agent registry and task history. */
export const relationalStore = await createRelationalStore();

/** Message bus for cross-agent event routing. */
export const messageBus = await createMessageBus();

// Initialize tables
if (relationalStore instanceof InMemoryRelationalStore) {
  await relationalStore.createTable('agents');
  await relationalStore.createTable('task_history');
}
