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

describe('Factory functions always return InMemory stubs', () => {
  it('createKeyValueStore returns InMemoryKeyValueStore', async () => {
    const store = await createKeyValueStore();
    expect(store.constructor.name).toBe('InMemoryKeyValueStore');
  });

  it('createMessageBus returns InMemoryMessageBus', async () => {
    const bus = await createMessageBus();
    expect(bus.constructor.name).toBe('InMemoryMessageBus');
  });

  it('createRelationalStore returns InMemoryRelationalStore', async () => {
    const store = await createRelationalStore();
    expect(store.constructor.name).toBe('InMemoryRelationalStore');
  });

  it('createGraphDB returns InMemoryGraphDB', async () => {
    const db = await createGraphDB();
    expect(db.constructor.name).toBe('InMemoryGraphDB');
  });

  it('createVectorStore returns InMemoryVectorStore', async () => {
    const store = await createVectorStore();
    expect(store.constructor.name).toBe('InMemoryVectorStore');
  });

  it('createFullTextSearch returns InMemoryFullTextSearch', async () => {
    const search = await createFullTextSearch();
    expect(search.constructor.name).toBe('InMemoryFullTextSearch');
  });

  it('createLLMClient returns InMemoryLLMClient', async () => {
    const client = await createLLMClient();
    expect(client.constructor.name).toBe('InMemoryLLMClient');
  });

  it('createWarehouseConnector returns InMemoryWarehouseConnector', async () => {
    const connector = await createWarehouseConnector();
    expect(connector.constructor.name).toBe('InMemoryWarehouseConnector');
  });

  it('createOrchestratorAPI returns InMemoryOrchestratorAPI', async () => {
    const api = await createOrchestratorAPI();
    expect(api.constructor.name).toBe('InMemoryOrchestratorAPI');
  });
});
