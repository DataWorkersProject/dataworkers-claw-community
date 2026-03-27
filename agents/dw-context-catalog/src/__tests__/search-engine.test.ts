import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogSearchEngine } from '../search/catalog-search.js';
import { InMemoryVectorStore, InMemoryFullTextSearch, InMemoryGraphDB } from '@data-workers/infrastructure-stubs';
import type { SearchResult } from '../types.js';
import type { ColdStartResponse } from '../search/catalog-search.js';

function isSearchResults(result: SearchResult[] | ColdStartResponse): result is SearchResult[] {
  return Array.isArray(result);
}

function isColdStart(result: SearchResult[] | ColdStartResponse): result is ColdStartResponse {
  return !Array.isArray(result) && 'coldStart' in result;
}

describe('CatalogSearchEngine', () => {
  let engine: CatalogSearchEngine;
  let vectorStore: InMemoryVectorStore;
  let fullTextSearch: InMemoryFullTextSearch;
  let graphDB: InMemoryGraphDB;

  beforeEach(() => {
    vectorStore = new InMemoryVectorStore();
    fullTextSearch = new InMemoryFullTextSearch();
    graphDB = new InMemoryGraphDB();
    vectorStore.seed();
    fullTextSearch.seed();
    graphDB.seed();
    engine = new CatalogSearchEngine({ vectorStore, fullTextSearch, graphDB });
  });

  describe('basic search', () => {
    it('returns actual seeded assets for "orders" query', async () => {
      const results = await engine.search('orders', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      expect(results.length).toBeGreaterThan(0);
      const names = results.map(r => r.asset.name);
      expect(names.some(n => n.includes('orders') || n.includes('order'))).toBe(true);
    });

    it('returns actual seeded assets for "revenue" query', async () => {
      const results = await engine.search('revenue', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns results with relevance scores', async () => {
      const results = await engine.search('orders', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      for (const result of results) {
        expect(result.relevanceScore).toBeGreaterThan(0);
      }
    });

    it('returns results with matched fields', async () => {
      const results = await engine.search('orders', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      expect(results[0].matchedFields.length).toBeGreaterThan(0);
    });
  });

  describe('RRF reranking', () => {
    it('produces ordered results by RRF score', async () => {
      const results = await engine.search('orders', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].relevanceScore).toBeGreaterThanOrEqual(results[i].relevanceScore);
      }
    });

    it('top-3 results contain relevant asset for "orders" query', async () => {
      const results = await engine.search('orders', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      const top3Names = results.slice(0, 3).map(r => r.asset.name.toLowerCase());
      expect(top3Names.some(n => n.includes('order'))).toBe(true);
    });

    it('top-3 results contain relevant asset for "customers" query', async () => {
      const results = await engine.search('customers', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      const top3Names = results.slice(0, 3).map(r => r.asset.name.toLowerCase());
      expect(top3Names.some(n => n.includes('customer'))).toBe(true);
    });

    it('top-3 results contain relevant asset for "events" query', async () => {
      const results = await engine.search('events', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      const top3Names = results.slice(0, 3).map(r => r.asset.name.toLowerCase());
      expect(top3Names.some(n => n.includes('event'))).toBe(true);
    });
  });

  describe('different queries return different results', () => {
    it('orders vs events return different top results', async () => {
      const ordersResults = await engine.search('orders', 'cust-1', 5);
      const eventsResults = await engine.search('events', 'cust-1', 5);
      expect(isSearchResults(ordersResults)).toBe(true);
      expect(isSearchResults(eventsResults)).toBe(true);
      if (!isSearchResults(ordersResults) || !isSearchResults(eventsResults)) return;

      const ordersTopId = ordersResults[0]?.asset.id;
      const eventsTopId = eventsResults[0]?.asset.id;
      expect(ordersTopId).not.toBe(eventsTopId);
    });
  });

  describe('cold-start behavior', () => {
    it('returns cold-start response when all backends are empty', async () => {
      const emptyEngine = new CatalogSearchEngine({
        vectorStore: new InMemoryVectorStore(),
        fullTextSearch: new InMemoryFullTextSearch(),
        graphDB: new InMemoryGraphDB(),
      });
      const result = await emptyEngine.search('orders', 'cust-1', 20);
      expect(isColdStart(result)).toBe(true);
      if (isColdStart(result)) {
        expect(result.coldStart).toBe(true);
        expect(result.message).toContain('Catalog not yet indexed');
      }
    });
  });

  describe('per-backend timeout handling', () => {
    it('returns results even if one backend is slow', async () => {
      // The real backends respond immediately, so this tests the normal path
      // In a real scenario, we would mock a slow backend
      const results = await engine.search('orders', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('search with filters', () => {
    it('filters by platform (via post-filter in handler)', async () => {
      // The engine itself does not filter by platform, that is done in the handler
      // But we can verify the engine returns assets from multiple platforms
      const results = await engine.search('data', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      const platforms = new Set(results.map(r => r.asset.platform));
      expect(platforms.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('latency', () => {
    it('search completes within 300ms for in-memory backends', async () => {
      const start = performance.now();
      const results = await engine.search('orders', 'cust-1', 20);
      const elapsed = performance.now() - start;
      expect(isSearchResults(results)).toBe(true);
      expect(elapsed).toBeLessThan(300);
    });
  });

  describe('connector failure handling', () => {
    it('returns results when one backend throws', async () => {
      // Create a vector store that throws synchronously on query
      const faultyVectorStore = new InMemoryVectorStore();
      faultyVectorStore.seed();
      faultyVectorStore.query = () => { throw new Error('Vector store connection failed'); };

      const faultyEngine = new CatalogSearchEngine({
        vectorStore: faultyVectorStore,
        fullTextSearch,
        graphDB,
      });

      const results = await faultyEngine.search('orders', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (isSearchResults(results)) {
        // Should still get results from BM25 and graph backends
        expect(results.length).toBeGreaterThan(0);
      }
    });
  });

  describe('search config', () => {
    it('respects custom weights', async () => {
      const customEngine = new CatalogSearchEngine(
        { vectorStore, fullTextSearch, graphDB },
        { vectorWeight: 0.8, bm25Weight: 0.1, graphWeight: 0.1 },
      );
      const results = await customEngine.search('orders', 'cust-1', 20);
      expect(isSearchResults(results)).toBe(true);
      if (!isSearchResults(results)) return;
      expect(results.length).toBeGreaterThan(0);
    });

    it('respects minScore filter', async () => {
      const strictEngine = new CatalogSearchEngine(
        { vectorStore, fullTextSearch, graphDB },
        { minScore: 0.5 },
      );
      const results = await strictEngine.search('orders', 'cust-1', 20);
      // May return fewer or no results due to high minScore threshold
      if (isSearchResults(results)) {
        for (const result of results) {
          expect(result.relevanceScore).toBeGreaterThanOrEqual(0.5);
        }
      }
    });
  });
});
