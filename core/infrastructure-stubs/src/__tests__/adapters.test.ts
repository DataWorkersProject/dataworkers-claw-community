import { describe, it, expect } from 'vitest';
import {
  createKeyValueStore,
  createMessageBus,
  createRelationalStore,
  createGraphDB,
  createVectorStore,
  createFullTextSearch,
  createLLMClient,
  createWarehouseConnector,
  createOrchestratorAPI,
} from '../adapters/factory.js';
import { InMemoryKeyValueStore } from '../key-value-store.js';
import { InMemoryMessageBus } from '../message-bus.js';
import { InMemoryRelationalStore } from '../relational-store.js';
import { InMemoryGraphDB } from '../graph-db.js';
import { InMemoryVectorStore } from '../vector-store.js';
import { InMemoryFullTextSearch } from '../full-text-search.js';
import { InMemoryLLMClient } from '../llm-client-stub.js';
import { InMemoryWarehouseConnector } from '../warehouse-connector.js';
import { InMemoryOrchestratorAPI } from '../orchestrator-api.js';

describe('Factory functions always return InMemory stubs', () => {
  it('createKeyValueStore returns InMemoryKeyValueStore', async () => {
    const store = await createKeyValueStore();
    expect(store).toBeInstanceOf(InMemoryKeyValueStore);
  });

  it('createMessageBus returns InMemoryMessageBus', async () => {
    const bus = await createMessageBus();
    expect(bus).toBeInstanceOf(InMemoryMessageBus);
  });

  it('createRelationalStore returns InMemoryRelationalStore', async () => {
    const store = await createRelationalStore();
    expect(store).toBeInstanceOf(InMemoryRelationalStore);
  });

  it('createGraphDB returns InMemoryGraphDB', async () => {
    const db = await createGraphDB();
    expect(db).toBeInstanceOf(InMemoryGraphDB);
  });

  it('createVectorStore returns InMemoryVectorStore', async () => {
    const store = await createVectorStore();
    expect(store).toBeInstanceOf(InMemoryVectorStore);
  });

  it('createFullTextSearch returns InMemoryFullTextSearch', async () => {
    const search = await createFullTextSearch();
    expect(search).toBeInstanceOf(InMemoryFullTextSearch);
  });

  it('createLLMClient returns InMemoryLLMClient', async () => {
    const client = await createLLMClient();
    expect(client).toBeInstanceOf(InMemoryLLMClient);
  });

  it('createWarehouseConnector returns InMemoryWarehouseConnector', async () => {
    const connector = await createWarehouseConnector();
    expect(connector).toBeInstanceOf(InMemoryWarehouseConnector);
  });

  it('createOrchestratorAPI returns InMemoryOrchestratorAPI', async () => {
    const api = await createOrchestratorAPI();
    expect(api).toBeInstanceOf(InMemoryOrchestratorAPI);
  });
});
