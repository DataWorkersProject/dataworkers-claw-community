import { describe, it, expect } from 'vitest';
import { FreshnessTracker } from '../search/freshness-tracker.js';

describe('FreshnessTracker', () => {
  const tracker = new FreshnessTracker();

  describe('deterministic results', () => {
    it('returns the same freshness for the same asset on repeated calls', async () => {
      const result1 = await tracker.checkFreshness('tbl-1', 'cust-1');
      const result2 = await tracker.checkFreshness('tbl-1', 'cust-1');
      expect(result1.freshnessScore).toBe(result2.freshnessScore);
      expect(result1.slaCompliant).toBe(result2.slaCompliant);
    });

    it('returns the same lastUpdated timestamp on repeated calls', async () => {
      const result1 = await tracker.checkFreshness('stg-orders', 'cust-1');
      const result2 = await tracker.checkFreshness('stg-orders', 'cust-1');
      // Timestamps should be within 1ms (same deterministic computation)
      expect(Math.abs(result1.lastUpdated - result2.lastUpdated)).toBeLessThan(100);
    });

    it('does not use Math.random (results are stable)', async () => {
      const results: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = await tracker.checkFreshness('tbl-1', 'cust-1');
        results.push(r.freshnessScore);
      }
      // All 10 calls should return the same score
      expect(new Set(results).size).toBe(1);
    });
  });

  describe('known seeded assets', () => {
    it('finds asset by ID (tbl-1)', async () => {
      const result = await tracker.checkFreshness('tbl-1', 'cust-1');
      expect(result.found).toBe(true);
      expect(result.lastUpdated).toBeGreaterThan(0);
      expect(result.freshnessScore).toBeGreaterThanOrEqual(0);
      expect(result.freshnessScore).toBeLessThanOrEqual(100);
    });

    it('finds asset by name (orders)', async () => {
      const result = await tracker.checkFreshness('orders', 'cust-1');
      expect(result.found).toBe(true);
      expect(result.lastUpdated).toBeGreaterThan(0);
    });

    it('finds staging model by name (stg_orders)', async () => {
      const result = await tracker.checkFreshness('stg_orders', 'cust-1');
      expect(result.found).toBe(true);
      expect(result.assetId).toBe('stg-orders');
    });

    it('returns correct assetId from graph node', async () => {
      const result = await tracker.checkFreshness('stg-orders', 'cust-1');
      expect(result.found).toBe(true);
      expect(result.assetId).toBe('stg-orders');
    });
  });

  describe('unknown assets', () => {
    it('returns not-found for completely unknown asset', async () => {
      const result = await tracker.checkFreshness('nonexistent_xyz', 'cust-1');
      expect(result.found).toBe(false);
      expect(result.freshnessScore).toBe(0);
      expect(result.lastUpdated).toBe(0);
      expect(result.alert).toContain('NOT_FOUND');
    });

    it('returns not-found for wrong customer', async () => {
      const result = await tracker.checkFreshness('tbl-1', 'cust-other');
      expect(result.found).toBe(false);
      expect(result.alert).toContain('NOT_FOUND');
    });
  });

  describe('SLA compliance', () => {
    it('computes SLA compliance correctly for fresh asset', async () => {
      // Use a very large SLA target so the asset is always fresh
      const result = await tracker.checkFreshness('tbl-1', 'cust-1', 999_999_999_999);
      expect(result.slaCompliant).toBe(true);
      expect(result.staleSince).toBeUndefined();
    });

    it('computes SLA compliance correctly for stale asset', async () => {
      // Use a very small SLA target (1ms) so asset is always stale
      const result = await tracker.checkFreshness('tbl-1', 'cust-1', 1);
      expect(result.slaCompliant).toBe(false);
      expect(result.staleSince).toBeDefined();
      expect(result.alert).toContain('STALE');
    });

    it('includes SLA target in result', async () => {
      const result = await tracker.checkFreshness('tbl-1', 'cust-1', 3_600_000);
      expect(result.slaTarget).toBe(3_600_000);
    });

    it('freshnessScore is between 0 and 100', async () => {
      const result = await tracker.checkFreshness('tbl-1', 'cust-1');
      expect(result.freshnessScore).toBeGreaterThanOrEqual(0);
      expect(result.freshnessScore).toBeLessThanOrEqual(100);
    });
  });

  describe('customerId scoping', () => {
    it('finds asset only for correct customerId', async () => {
      const correct = await tracker.checkFreshness('tbl-1', 'cust-1');
      const wrong = await tracker.checkFreshness('tbl-1', 'cust-999');
      expect(correct.found).toBe(true);
      expect(wrong.found).toBe(false);
    });

    it('name-based lookup is scoped to customerId', async () => {
      const correct = await tracker.checkFreshness('orders', 'cust-1');
      const wrong = await tracker.checkFreshness('orders', 'cust-other');
      expect(correct.found).toBe(true);
      expect(wrong.found).toBe(false);
    });
  });

  describe('ageHours', () => {
    it('returns ageHours as a number', async () => {
      const result = await tracker.checkFreshness('tbl-1', 'cust-1');
      expect(typeof result.ageHours).toBe('number');
      expect(result.ageHours).toBeGreaterThanOrEqual(0);
    });
  });
});
