import { describe, it, expect } from 'vitest';
import { LineageTraverser } from '../lineage-traverser.js';

/**
 * @deprecated LineageTraverser is deprecated — use graphDB.traverseUpstream() via backends.ts.
 * These tests cover the legacy simulated traversal and will be removed in Phase 5.
 */
describe('LineageTraverser', () => {
  it('traverses upstream with confidence decay', async () => {
    const traverser = new LineageTraverser();
    const result = await traverser.traverseUpstream('cust-1', 'tbl-a', 3);
    expect(result.path.length).toBe(4); // entity + 3 hops
    expect(result.depth).toBe(3);
    expect(result.confidenceAtDepth[0]).toBe(1);
    expect(result.confidenceAtDepth[1]).toBeCloseTo(0.9);
  });

  it('traverses downstream', async () => {
    const traverser = new LineageTraverser();
    const result = await traverser.traverseDownstream('cust-1', 'tbl-a', 2);
    expect(result.path.length).toBe(3);
    expect(result.edges.length).toBe(2);
  });

  it('performs full impact analysis', async () => {
    const traverser = new LineageTraverser();
    const result = await traverser.getImpactAnalysis('cust-1', 'tbl-a', 3);
    expect(result.upstream).toBeDefined();
    expect(result.downstream).toBeDefined();
    expect(result.totalImpact).toBeGreaterThan(0);
  });

  it('respects max depth limit', async () => {
    const traverser = new LineageTraverser(5);
    const result = await traverser.traverseUpstream('cust-1', 'tbl-a', 10);
    expect(result.path.length).toBeLessThanOrEqual(6);
  });
});
