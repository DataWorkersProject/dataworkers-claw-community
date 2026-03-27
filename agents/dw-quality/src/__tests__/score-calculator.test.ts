import { describe, it, expect } from 'vitest';
import { calculateQualityScore } from '../score-calculator.js';
import type { ProfileResult } from '../profiler.js';

describe('calculateQualityScore', () => {
  it('is exported as a function', () => {
    expect(typeof calculateQualityScore).toBe('function');
  });

  it('returns perfect score for ideal profile', () => {
    const profile: ProfileResult = {
      totalRows: 1000,
      columns: [
        { name: 'id', type: 'int', nullable: false, totalRows: 1000, nullCount: 0, nullRate: 0, distinctCount: 1000, distinctRatio: 1.0 },
        { name: 'name', type: 'string', nullable: true, totalRows: 1000, nullCount: 0, nullRate: 0, distinctCount: 800, distinctRatio: 0.8 },
      ],
      freshnessHours: 1,
      profiledAt: Date.now(),
    };
    const score = calculateQualityScore('test-dataset', profile);
    expect(score).toBeDefined();
    expect(typeof score.score).toBe('number');
    expect(score.score).toBeGreaterThan(80);
  });

  it('penalizes stale data', () => {
    const fresh: ProfileResult = {
      totalRows: 100,
      columns: [{ name: 'id', type: 'int', nullable: false, totalRows: 100, nullCount: 0, nullRate: 0, distinctCount: 100, distinctRatio: 1 }],
      freshnessHours: 1,
      profiledAt: Date.now(),
    };
    const stale: ProfileResult = { ...fresh, freshnessHours: 40 };
    const freshScore = calculateQualityScore('ds', fresh);
    const staleScore = calculateQualityScore('ds', stale);
    expect(freshScore.score).toBeGreaterThan(staleScore.score);
  });
});
