import { describe, it, expect } from 'vitest';
import { LineageTracker } from '../lineage-tracker.js';
import type { PromotionResult } from '../types.js';

describe('LineageTracker', () => {
  it('exports LineageTracker class', () => {
    expect(LineageTracker).toBeDefined();
  });

  const mockResult: PromotionResult = {
    promotionId: 'promo-1',
    rule: {
      id: 'rule-1',
      name: 'Bronze to Silver',
      sourceLayer: 'bronze',
      targetLayer: 'silver',
      sourceTable: 'events_raw',
      targetTable: 'events_clean',
      transforms: [],
      qualityGates: [],
      enabled: true,
    },
    status: 'success',
    rowsProcessed: 100,
    rowsPromoted: 95,
    rowsQuarantined: 5,
    qualityResults: [],
    durationMs: 500,
    timestamp: Date.now(),
  };

  it('tracks a promotion and returns edge ID', () => {
    const tracker = new LineageTracker();
    const edgeId = tracker.trackPromotion(mockResult);
    expect(typeof edgeId).toBe('string');
    expect(edgeId.startsWith('lineage_')).toBe(true);
  });

  it('retrieves all edges', () => {
    const tracker = new LineageTracker();
    tracker.trackPromotion(mockResult);
    const edges = tracker.getEdges();
    expect(Array.isArray(edges)).toBe(true);
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceTable).toBe('events_raw');
  });
});
