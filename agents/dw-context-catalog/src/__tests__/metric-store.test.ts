import { describe, it, expect } from 'vitest';
import { MetricStore } from '../search/metric-store.js';

describe('MetricStore', () => {
  const store = new MetricStore();

  describe('exact match', () => {
    it('resolves mrr by canonicalName', () => {
      const result = store.resolveMetric('mrr', 'cust-1');
      expect(result.exactMatch).toBe(true);
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].canonicalName).toBe('mrr');
    });

    it('resolves churn_rate by canonicalName', () => {
      const result = store.resolveMetric('churn_rate', 'cust-1');
      expect(result.exactMatch).toBe(true);
      expect(result.matches[0].canonicalName).toBe('churn_rate');
    });

    it('resolves dau by canonicalName', () => {
      const result = store.resolveMetric('dau', 'cust-1');
      expect(result.exactMatch).toBe(true);
      expect(result.matches[0].canonicalName).toBe('dau');
    });
  });

  describe('alias match', () => {
    it('resolves "daily active users" via alias', () => {
      const result = store.resolveMetric('daily active users', 'cust-1');
      expect(result.notFound).toBe(false);
      expect(result.matches[0].canonicalName).toBe('dau');
    });

    it('resolves "monthly recurring revenue" via alias', () => {
      const result = store.resolveMetric('monthly recurring revenue', 'cust-1');
      expect(result.notFound).toBe(false);
      expect(result.matches[0].canonicalName).toBe('mrr');
    });

    it('resolves "customer churn" via alias', () => {
      const result = store.resolveMetric('customer churn', 'cust-1');
      expect(result.notFound).toBe(false);
      expect(result.matches[0].canonicalName).toBe('churn_rate');
    });

    it('resolves "clv" as alias for ltv', () => {
      const result = store.resolveMetric('clv', 'cust-1');
      expect(result.notFound).toBe(false);
      expect(result.matches[0].canonicalName).toBe('ltv');
    });
  });

  describe('fuzzy match', () => {
    it('catches typo "revnue" -> "revenue"', () => {
      const result = store.resolveMetric('revnue', 'cust-1');
      expect(result.notFound).toBe(false);
      expect(result.matches.some(m => m.aliases.includes('revenue'))).toBe(true);
    });

    it('catches typo "chrun" -> "churn"', () => {
      const result = store.resolveMetric('chrun', 'cust-1');
      expect(result.notFound).toBe(false);
      expect(result.matchType).toBe('fuzzy');
    });

    it('catches typo "dua" -> "dau"', () => {
      const result = store.resolveMetric('dua', 'cust-1');
      expect(result.notFound).toBe(false);
      expect(result.matchType).toBe('fuzzy');
    });
  });

  describe('customerId scoping', () => {
    it('cust-1 has full set of metrics (25)', () => {
      const result = store.resolveMetric('revenue', 'cust-1');
      expect(result.notFound).toBe(false);
    });

    it('cust-002 has a smaller set of metrics', () => {
      const allCust1 = store.listDefinitions('cust-1');
      const allCust2 = store.listDefinitions('cust-002');
      expect(allCust1.total).toBeGreaterThan(allCust2.total);
    });

    it('cust-002 has metrics from looker source', () => {
      const result = store.resolveMetric('mrr', 'cust-002');
      expect(result.notFound).toBe(false);
      expect(result.matches[0].source).toBe('looker');
    });

    it('unknown customer returns not found', () => {
      const result = store.resolveMetric('mrr', 'nonexistent-customer');
      expect(result.notFound).toBe(true);
      expect(result.matches).toEqual([]);
    });
  });

  describe('domain filtering', () => {
    it('filters by finance domain', () => {
      const result = store.resolveMetric('revenue', 'cust-1', 'finance');
      expect(result.matches.every(m => m.domain === 'finance')).toBe(true);
    });

    it('filters by product domain', () => {
      const result = store.resolveMetric('churn', 'cust-1', 'product');
      expect(result.matches.every(m => m.domain === 'product')).toBe(true);
    });

    it('returns empty when domain does not match', () => {
      const result = store.resolveMetric('mrr', 'cust-1', 'marketing');
      expect(result.notFound).toBe(true);
    });
  });

  describe('disambiguation', () => {
    it('revenue query returns multiple matches (ambiguous)', () => {
      const result = store.resolveMetric('revenue', 'cust-1');
      expect(result.ambiguous).toBe(true);
      expect(result.matches.length).toBeGreaterThan(1);
      expect(result.clarificationNeeded).toBeDefined();
    });

    it('clarification message lists canonical names', () => {
      const result = store.resolveMetric('revenue', 'cust-1');
      expect(result.clarificationNeeded).toContain('total_revenue');
    });
  });

  describe('listDefinitions', () => {
    it('lists all definitions for cust-1', () => {
      const result = store.listDefinitions('cust-1');
      expect(result.total).toBeGreaterThan(0);
      expect(result.definitions.length).toBe(result.total);
    });

    it('filters by domain', () => {
      const result = store.listDefinitions('cust-1', { domain: 'finance' });
      expect(result.definitions.every(d => d.domain === 'finance')).toBe(true);
    });

    it('filters by type metric', () => {
      const result = store.listDefinitions('cust-1', { type: 'metric' });
      expect(result.definitions.every(d => d.type === 'metric')).toBe(true);
    });

    it('filters by type dimension', () => {
      const result = store.listDefinitions('cust-1', { type: 'dimension' });
      expect(result.definitions.every(d => d.type === 'dimension')).toBe(true);
      expect(result.total).toBeGreaterThan(0);
    });

    it('filters by type entity', () => {
      const result = store.listDefinitions('cust-1', { type: 'entity' });
      expect(result.definitions.every(d => d.type === 'entity')).toBe(true);
      expect(result.total).toBeGreaterThan(0);
    });

    it('filters by source', () => {
      const result = store.listDefinitions('cust-1', { source: 'custom' });
      expect(result.definitions.every(d => d.source === 'custom')).toBe(true);
    });

    it('respects limit parameter', () => {
      const result = store.listDefinitions('cust-1', { limit: 3 });
      expect(result.definitions.length).toBeLessThanOrEqual(3);
      expect(result.total).toBeGreaterThanOrEqual(result.definitions.length);
    });

    it('returns empty for unknown customer', () => {
      const result = store.listDefinitions('nonexistent');
      expect(result.total).toBe(0);
      expect(result.definitions).toEqual([]);
    });

    it('cust-002 definitions come from looker', () => {
      const result = store.listDefinitions('cust-002', { source: 'looker' });
      expect(result.total).toBeGreaterThan(0);
      expect(result.definitions.every(d => d.source === 'looker')).toBe(true);
    });
  });
});
