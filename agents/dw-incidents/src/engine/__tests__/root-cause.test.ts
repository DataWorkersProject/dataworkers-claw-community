import { describe, it, expect } from 'vitest';
import { RootCauseEngine } from '../root-cause.js';

describe('RootCauseEngine', () => {
  it('builds initial causal chain link', () => {
    const engine = new RootCauseEngine();
    const link = engine.buildInitialLink('orders_table', 'schema_change');
    expect(link.entity).toBe('orders_table');
    expect(link.confidence).toBe(0.95);
    expect(link.issue).toContain('schema change');
  });

  it('builds upstream links with confidence decay', () => {
    const engine = new RootCauseEngine();
    const upstream = [
      { node: { id: '1', name: 'src_a', type: 'source' }, depth: 1, relationship: 'derives_from' },
      { node: { id: '2', name: 'src_b', type: 'pipeline' }, depth: 2, relationship: 'transforms' },
    ];
    const links = engine.buildUpstreamLinks('source_delay', upstream);
    expect(links).toHaveLength(2);
    expect(links[0].confidence).toBeGreaterThan(links[1].confidence);
  });

  it('identifies root cause from chain', () => {
    const engine = new RootCauseEngine();
    const chain = [
      { entity: 'tbl', entityType: 'table' as const, issue: 'issue', confidence: 0.9, timestamp: Date.now() },
    ];
    const cause = engine.identifyRootCause('schema_change', chain, []);
    expect(cause).toContain('schema change');
  });

  it('calculates confidence from chain', () => {
    const engine = new RootCauseEngine();
    const chain = [
      { entity: 'a', entityType: 'table' as const, issue: 'x', confidence: 0.9, timestamp: Date.now() },
      { entity: 'b', entityType: 'table' as const, issue: 'y', confidence: 0.8, timestamp: Date.now() },
    ];
    expect(engine.calculateConfidence(chain)).toBeCloseTo(0.72);
  });
});
