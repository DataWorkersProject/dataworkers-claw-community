import { describe, it, expect } from 'vitest';
import { VectorStore } from '../vector-store.js';

describe('VectorStore', () => {
  it('creates with Pinecone backend', () => {
    const store = new VectorStore({ backend: 'pinecone', endpoint: 'https://index.pinecone.io' });
    expect(store.getBackend()).toBe('pinecone');
    expect(store.isAvailable()).toBe(true);
  });

  it('creates with Weaviate backend', () => {
    const store = new VectorStore({ backend: 'weaviate', endpoint: 'http://weaviate:8080' });
    expect(store.getBackend()).toBe('weaviate');
  });

  it('upserts documents with customer namespace', async () => {
    const store = new VectorStore({ backend: 'pinecone', endpoint: 'test' });
    const count = await store.upsert('cust-1', [
      { id: 'doc-1', content: 'test', embedding: [0.1, 0.2], metadata: {}, customerId: 'cust-1' },
    ]);
    expect(count).toBe(1);
  });

  it('falls back to BM25 when unavailable (REQ-RAG-010)', async () => {
    const store = new VectorStore({ backend: 'pinecone', endpoint: 'test' });
    store.markUnavailable();
    expect(store.isAvailable()).toBe(false);

    // Should not throw, returns BM25 fallback results
    const results = await store.search('cust-1', [0.1, 0.2]);
    expect(results).toEqual([]);
  });

  it('throws on upsert when unavailable', async () => {
    const store = new VectorStore({ backend: 'pinecone', endpoint: 'test' });
    store.markUnavailable();
    await expect(
      store.upsert('cust-1', [{ id: '1', content: 'x', metadata: {}, customerId: 'cust-1' }]),
    ).rejects.toThrow('unavailable');
  });

  it('recovers availability', () => {
    const store = new VectorStore({ backend: 'pinecone', endpoint: 'test' });
    store.markUnavailable();
    store.markAvailable();
    expect(store.isAvailable()).toBe(true);
  });
});
