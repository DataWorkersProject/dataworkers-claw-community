import { describe, it, expect } from 'vitest';
import { InMemoryVectorStore } from '../vector-store.js';

describe('InMemoryVectorStore', () => {
  it('upsert and query returns results', async () => {
    const store = new InMemoryVectorStore();
    const vector = await store.embed('orders data');
    await store.upsert('v1', vector, { name: 'orders' }, 'ns1');
    const results = await store.query(vector, 5, 'ns1');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('v1');
  });

  it('query respects namespace isolation', async () => {
    const store = new InMemoryVectorStore();
    const vector = await store.embed('test data');
    await store.upsert('v1', vector, { name: 'a' }, 'ns-a');
    await store.upsert('v2', vector, { name: 'b' }, 'ns-b');
    const results = await store.query(vector, 10, 'ns-a');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('v1');
  });

  it('query respects topK limit', async () => {
    const store = new InMemoryVectorStore();
    for (let i = 0; i < 10; i++) {
      const vector = await store.embed(`item ${i}`);
      await store.upsert(`v${i}`, vector, { idx: i }, 'ns');
    }
    const queryVec = await store.embed('item 0');
    const results = await store.query(queryVec, 3, 'ns');
    expect(results).toHaveLength(3);
  });

  it('query with filter excludes non-matching entries', async () => {
    const store = new InMemoryVectorStore();
    const vector = await store.embed('shared text');
    await store.upsert('v1', vector, { type: 'table' }, 'ns');
    await store.upsert('v2', vector, { type: 'pipeline' }, 'ns');
    const results = await store.query(vector, 10, 'ns', (meta) => meta.type === 'table');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('v1');
  });

  it('delete removes an entry', async () => {
    const store = new InMemoryVectorStore();
    const vector = await store.embed('delete me');
    await store.upsert('v1', vector, {}, 'ns');
    expect(await store.delete('v1', 'ns')).toBe(true);
    const results = await store.query(vector, 10, 'ns');
    expect(results).toHaveLength(0);
  });

  it('embed produces deterministic vectors (same input gives same output)', async () => {
    const store = new InMemoryVectorStore();
    const vec1 = await store.embed('hello world');
    const vec2 = await store.embed('hello world');
    expect(vec1).toEqual(vec2);
    expect(vec1).toHaveLength(384);
  });

  it('query on empty store returns empty array', async () => {
    const store = new InMemoryVectorStore();
    const vector = await store.embed('anything');
    const results = await store.query(vector, 10, 'ns');
    expect(results).toHaveLength(0);
  });

  it('upsert with same id overwrites (no duplicates)', async () => {
    const store = new InMemoryVectorStore();
    const vec = await store.embed('text');
    await store.upsert('v1', vec, { version: 1 }, 'ns');
    await store.upsert('v1', vec, { version: 2 }, 'ns');
    const results = await store.query(vec, 10, 'ns');
    expect(results).toHaveLength(1);
    expect(results[0].metadata.version).toBe(2);
  });

  it('seed populates entries (query after seed returns results)', async () => {
    const store = new InMemoryVectorStore();
    store.seed();
    const queryVec = await store.embed('orders');
    const results = await store.query(queryVec, 5, 'catalog');
    expect(results.length).toBeGreaterThan(0);
  });
});
