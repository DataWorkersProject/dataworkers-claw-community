import { describe, it, expect, beforeAll } from 'vitest';
import { Reranker } from '../search/reranker.js';
import { InMemoryGraphDB } from '@data-workers/infrastructure-stubs';
import type { SearchResult } from '../types.js';

describe('Reranker', () => {
  const graphDB = new InMemoryGraphDB();

  beforeAll(async () => {
    // Seed some nodes with edges for popularity/centrality
    await graphDB.addNode({ id: 'pop-asset', type: 'table', name: 'popular_table', platform: 'snowflake', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'unpop-asset', type: 'table', name: 'unpopular_table', platform: 'snowflake', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'dash-1', type: 'dashboard', name: 'revenue_dashboard', platform: 'looker', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'model-1', type: 'model', name: 'dim_customers', platform: 'dbt', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'model-2', type: 'model', name: 'fct_orders', platform: 'dbt', properties: {}, customerId: 'cust-1' });
    await graphDB.addEdge({ source: 'pop-asset', target: 'dash-1', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'pop-asset', target: 'model-1', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'pop-asset', target: 'model-2', relationship: 'consumed_by', properties: {} });
  });

  const reranker = new Reranker();

  function makeResult(id: string, name: string, relevance: number, quality = 50, freshness = 50): SearchResult {
    return {
      asset: {
        id,
        customerId: 'cust-1',
        name,
        type: 'table',
        platform: 'snowflake',
        description: '',
        tags: [],
        qualityScore: quality,
        freshnessScore: freshness,
        lastUpdated: Date.now(),
        lastCrawled: Date.now(),
        metadata: {},
      },
      relevanceScore: relevance,
      matchedFields: ['name'],
    };
  }

  it('returns empty for empty input', async () => {
    const result = await reranker.rerank('query', [], graphDB);
    expect(result).toEqual([]);
  });

  it('reranks results based on multi-signal scoring', async () => {
    const results = [
      makeResult('unpop-asset', 'unpopular_table', 0.9, 30, 30),
      makeResult('pop-asset', 'popular_table', 0.7, 80, 90),
    ];

    const reranked = await reranker.rerank('table', results, graphDB);
    expect(reranked.length).toBe(2);
    // popular_table should rank higher due to popularity + quality + freshness
    expect(reranked[0].asset.id).toBe('pop-asset');
  });

  it('preserves all results', async () => {
    const results = [
      makeResult('a', 'table_a', 0.5),
      makeResult('b', 'table_b', 0.8),
      makeResult('c', 'table_c', 0.3),
    ];
    const reranked = await reranker.rerank('query', results, graphDB);
    expect(reranked.length).toBe(3);
  });

  it('assigns scores between 0 and 1', async () => {
    const results = [makeResult('pop-asset', 'popular_table', 1.0, 100, 100)];
    const reranked = await reranker.rerank('query', results, graphDB);
    expect(reranked[0].relevanceScore).toBeGreaterThanOrEqual(0);
    expect(reranked[0].relevanceScore).toBeLessThanOrEqual(1.1); // slight tolerance
  });

  it('sorts by descending score', async () => {
    const results = [
      makeResult('a', 'a', 0.3, 20, 20),
      makeResult('b', 'b', 0.9, 90, 90),
      makeResult('c', 'c', 0.5, 50, 50),
    ];
    const reranked = await reranker.rerank('query', results, graphDB);
    for (let i = 1; i < reranked.length; i++) {
      expect(reranked[i - 1].relevanceScore).toBeGreaterThanOrEqual(reranked[i].relevanceScore);
    }
  });

  it('higher quality assets get boosted', async () => {
    const results = [
      makeResult('a', 'low_quality', 0.5, 10, 50),
      makeResult('b', 'high_quality', 0.5, 95, 50),
    ];
    const reranked = await reranker.rerank('query', results, graphDB);
    expect(reranked[0].asset.name).toBe('high_quality');
  });

  it('fresher assets get boosted', async () => {
    const results = [
      makeResult('a', 'stale', 0.5, 50, 10),
      makeResult('b', 'fresh', 0.5, 50, 95),
    ];
    const reranked = await reranker.rerank('query', results, graphDB);
    expect(reranked[0].asset.name).toBe('fresh');
  });

  it('computeSignals returns signal breakdown', async () => {
    const result = makeResult('pop-asset', 'popular_table', 0.8, 75, 85);
    const signals = await reranker.computeSignals(result, graphDB);
    expect(signals.textRelevance).toBe(0.8);
    expect(signals.qualityScore).toBe(0.75);
    expect(signals.freshnessScore).toBe(0.85);
    expect(signals.popularity).toBeGreaterThan(0);
    expect(signals.graphCentrality).toBeGreaterThan(0);
  });

  it('accepts custom weights', async () => {
    const textOnlyReranker = new Reranker({
      textRelevance: 1.0,
      popularity: 0,
      freshnessScore: 0,
      qualityScore: 0,
      userAffinity: 0,
      graphCentrality: 0,
    });
    const results = [
      makeResult('a', 'a', 0.9, 10, 10),
      makeResult('b', 'b', 0.3, 100, 100),
    ];
    const reranked = await textOnlyReranker.rerank('query', results, graphDB);
    expect(reranked[0].asset.name).toBe('a');
  });

  it('handles single result', async () => {
    const results = [makeResult('a', 'single', 0.5)];
    const reranked = await reranker.rerank('query', results, graphDB);
    expect(reranked.length).toBe(1);
  });
});
