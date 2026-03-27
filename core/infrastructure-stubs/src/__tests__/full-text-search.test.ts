import { describe, it, expect } from 'vitest';
import { InMemoryFullTextSearch } from '../full-text-search.js';

describe('InMemoryFullTextSearch', () => {
  it('index and search finds the document', async () => {
    const fts = new InMemoryFullTextSearch();
    await fts.index('doc1', 'customer orders pipeline data', { name: 'orders' }, 'cust-1');
    const results = await fts.search('orders', 'cust-1', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('doc1');
  });

  it('search respects customerId isolation', async () => {
    const fts = new InMemoryFullTextSearch();
    await fts.index('doc1', 'shared content about orders', { name: 'a' }, 'cust-1');
    await fts.index('doc2', 'shared content about orders', { name: 'b' }, 'cust-2');
    const results = await fts.search('orders', 'cust-1', 10);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc1');
  });

  it('search respects limit', async () => {
    const fts = new InMemoryFullTextSearch();
    for (let i = 0; i < 10; i++) {
      await fts.index(`doc${i}`, `orders data item ${i}`, { idx: i }, 'cust-1');
    }
    const results = await fts.search('orders', 'cust-1', 3);
    expect(results).toHaveLength(3);
  });

  it('search ranks more relevant documents higher', async () => {
    const fts = new InMemoryFullTextSearch();
    await fts.index('doc-low', 'general data processing pipeline', { name: 'general' }, 'cust-1');
    await fts.index('doc-high', 'orders orders orders revenue', { name: 'orders' }, 'cust-1');
    const results = await fts.search('orders', 'cust-1', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('doc-high');
  });

  it('remove deletes a document from search', async () => {
    const fts = new InMemoryFullTextSearch();
    await fts.index('doc1', 'orders data pipeline', {}, 'cust-1');
    expect(await fts.remove('doc1')).toBe(true);
    const results = await fts.search('orders', 'cust-1', 10);
    expect(results).toHaveLength(0);
  });

  it('remove returns false for nonexistent document', async () => {
    const fts = new InMemoryFullTextSearch();
    expect(await fts.remove('nonexistent')).toBe(false);
  });

  it('search on empty index returns empty array', async () => {
    const fts = new InMemoryFullTextSearch();
    const results = await fts.search('anything', 'cust-1', 10);
    expect(results).toHaveLength(0);
  });

  it('seed populates searchable documents', async () => {
    const fts = new InMemoryFullTextSearch();
    fts.seed();
    const results = await fts.search('orders', 'cust-1', 10);
    expect(results.length).toBeGreaterThan(0);
  });
});
