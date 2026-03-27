import { describe, it, expect } from 'vitest';
import { IntentClassifier } from '../search/intent-classifier.js';
import { QueryExpander } from '../search/query-expander.js';

describe('IntentClassifier', () => {
  const classifier = new IntentClassifier();

  describe('lineage intent', () => {
    it('detects "lineage of orders"', () => {
      const result = classifier.classify('lineage of orders');
      expect(result.intent).toBe('get_lineage');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.extractedEntities.assetName).toBe('orders');
    });

    it('detects "what feeds the users table"', () => {
      const result = classifier.classify('what feeds the users table');
      expect(result.intent).toBe('get_lineage');
    });

    it('detects "upstream dependencies"', () => {
      const result = classifier.classify('upstream dependencies of raw_events');
      expect(result.intent).toBe('get_lineage');
    });

    it('detects "downstream of orders"', () => {
      const result = classifier.classify('downstream of orders');
      expect(result.intent).toBe('get_lineage');
    });
  });

  describe('metric intent', () => {
    it('detects "what is the MRR metric"', () => {
      const result = classifier.classify('what is the MRR metric');
      expect(result.intent).toBe('resolve_metric');
      expect(result.extractedEntities.metricName?.toLowerCase()).toBe('mrr');
    });

    it('detects "define revenue"', () => {
      const result = classifier.classify('define revenue');
      expect(result.intent).toBe('resolve_metric');
    });

    it('detects "how is churn calculated"', () => {
      const result = classifier.classify('how is churn calculated');
      expect(result.intent).toBe('resolve_metric');
    });
  });

  describe('documentation intent', () => {
    it('detects "describe users table"', () => {
      const result = classifier.classify('describe users table');
      expect(result.intent).toBe('get_documentation');
    });

    it('detects "what columns are in orders"', () => {
      const result = classifier.classify('what columns are in orders');
      expect(result.intent).toBe('get_documentation');
    });
  });

  describe('freshness intent', () => {
    it('detects "how fresh is orders"', () => {
      const result = classifier.classify('how fresh is orders');
      expect(result.intent).toBe('check_freshness');
    });

    it('detects "when was users last updated"', () => {
      const result = classifier.classify('when was users last updated');
      expect(result.intent).toBe('check_freshness');
    });

    it('detects "SLA compliance"', () => {
      const result = classifier.classify('SLA compliance check');
      expect(result.intent).toBe('check_freshness');
    });
  });

  describe('find_assets intent', () => {
    it('detects "find revenue tables"', () => {
      const result = classifier.classify('find revenue tables');
      expect(result.intent).toBe('find_assets');
    });

    it('detects "search for customer data"', () => {
      const result = classifier.classify('search for customer data');
      expect(result.intent).toBe('find_assets');
    });

    it('detects "show me all pipelines"', () => {
      const result = classifier.classify('show me all pipelines');
      expect(result.intent).toBe('find_assets');
    });
  });

  describe('explore intent (fallback)', () => {
    it('falls back to explore for ambiguous queries', () => {
      const result = classifier.classify('orders');
      expect(result.intent).toBe('explore');
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('handles empty query', () => {
      const result = classifier.classify('');
      expect(result.intent).toBe('explore');
    });
  });

  describe('domain extraction', () => {
    it('extracts finance domain', () => {
      const result = classifier.classify('find finance tables');
      expect(result.extractedEntities.domain).toBe('finance');
    });

    it('extracts product domain', () => {
      const result = classifier.classify('define product metrics');
      expect(result.extractedEntities.domain).toBe('product');
    });
  });
});

describe('QueryExpander', () => {
  const expander = new QueryExpander();

  it('expands revenue to include synonyms', () => {
    const results = expander.expand('revenue dashboard');
    expect(results.length).toBeGreaterThan(1);
    expect(results).toContain('revenue dashboard');
    expect(results.some(r => r.includes('sales'))).toBe(true);
  });

  it('expands acronyms', () => {
    const results = expander.expand('mrr trends');
    expect(results.length).toBeGreaterThan(1);
    expect(results.some(r => r.includes('monthly recurring revenue'))).toBe(true);
  });

  it('expands data engineering terms', () => {
    const results = expander.expand('pipeline status');
    expect(results.length).toBeGreaterThan(1);
    expect(results.some(r => r.includes('workflow') || r.includes('dag') || r.includes('etl'))).toBe(true);
  });

  it('returns original query when no synonyms match', () => {
    const results = expander.expand('xyz123 unknown');
    expect(results).toEqual(['xyz123 unknown']);
  });

  it('getSynonyms returns synonyms for known terms', () => {
    const syns = expander.getSynonyms('churn');
    expect(syns.length).toBeGreaterThan(0);
    expect(syns).toContain('attrition');
  });

  it('getSynonyms returns empty for unknown terms', () => {
    const syns = expander.getSynonyms('xyzabc');
    expect(syns).toEqual([]);
  });
});
