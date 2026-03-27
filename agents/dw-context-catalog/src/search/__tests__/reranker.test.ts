import { describe, it, expect } from 'vitest';
import { Reranker } from '../reranker.js';

describe('Reranker', () => {
  it('exports Reranker class', () => {
    expect(Reranker).toBeDefined();
  });

  it('creates instance with default weights', () => {
    const reranker = new Reranker();
    expect(reranker).toBeDefined();
  });

  it('creates instance with custom weights', () => {
    const reranker = new Reranker({ textRelevance: 0.5, popularity: 0.5 });
    expect(reranker).toBeDefined();
  });

  it('returns empty array for empty results', async () => {
    const reranker = new Reranker();
    const mockGraphDB = { traverseDownstream: async () => [], traverseUpstream: async () => [] } as any;
    const results = await reranker.rerank('query', [], mockGraphDB);
    expect(results).toEqual([]);
  });
});
