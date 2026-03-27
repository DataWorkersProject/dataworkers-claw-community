/**
 * Infrastructure factory functions (OSS edition).
 * Always returns InMemory stubs — real infrastructure adapters are
 * available in the enterprise edition.
 */

import type {
  IKeyValueStore,
  IMessageBus,
  IRelationalStore,
  IGraphDB,
  IVectorStore,
  IFullTextSearch,
  ILLMClient,
  IWarehouseConnector,
  IOrchestratorAPI,
} from '../interfaces/index.js';

import { InMemoryKeyValueStore } from '../key-value-store.js';
import { InMemoryMessageBus } from '../message-bus.js';
import { InMemoryRelationalStore } from '../relational-store.js';
import { InMemoryGraphDB } from '../graph-db.js';
import { InMemoryVectorStore } from '../vector-store.js';
import { InMemoryFullTextSearch } from '../full-text-search.js';
import { InMemoryLLMClient } from '../llm-client-stub.js';
import { InMemoryWarehouseConnector } from '../warehouse-connector.js';
import { InMemoryOrchestratorAPI } from '../orchestrator-api.js';

/* ------------------------------------------------------------------ */
/*  Factory Functions (OSS — always InMemory)                          */
/* ------------------------------------------------------------------ */

export async function createKeyValueStore(): Promise<IKeyValueStore> {
  return new InMemoryKeyValueStore();
}

export async function createMessageBus(): Promise<IMessageBus> {
  return new InMemoryMessageBus();
}

export async function createRelationalStore(): Promise<IRelationalStore> {
  return new InMemoryRelationalStore();
}

export async function createGraphDB(): Promise<IGraphDB> {
  return new InMemoryGraphDB();
}

export async function createVectorStore(): Promise<IVectorStore> {
  return new InMemoryVectorStore();
}

export async function createFullTextSearch(): Promise<IFullTextSearch> {
  return new InMemoryFullTextSearch();
}

export async function createLLMClient(): Promise<ILLMClient> {
  return new InMemoryLLMClient();
}

export async function createWarehouseConnector(): Promise<IWarehouseConnector> {
  return new InMemoryWarehouseConnector();
}

export async function createOrchestratorAPI(): Promise<IOrchestratorAPI> {
  return new InMemoryOrchestratorAPI();
}

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                          */
/* ------------------------------------------------------------------ */

export async function disconnectAll(...stores: unknown[]): Promise<void> {
  for (const store of stores) {
    if (store && typeof (store as { disconnect?: () => Promise<void> }).disconnect === 'function') {
      await (store as { disconnect: () => Promise<void> }).disconnect();
    }
  }
}
