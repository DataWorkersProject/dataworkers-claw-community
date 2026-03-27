import { describe, it, expect } from 'vitest';
import {
  MetricMonitor,
  nullRateRule,
  zeroRowCountRule,
  latencyBaselineRule,
} from '../engine/metric-monitor.js';
import type { SemanticRule } from '../engine/metric-monitor.js';
import type { MetricDataPoint } from '../engine/statistical-detector.js';

describe('Semantic Pattern Detection', () => {
  describe('registerSemanticRule + evaluateSemanticRules', () => {
    it('returns empty array when no rules registered', () => {
      const monitor = new MetricMonitor();
      const point: MetricDataPoint = { timestamp: Date.now(), value: 100, metric: 'null_rate', source: 'src-1' };
      expect(monitor.evaluateSemanticRules(point)).toEqual([]);
    });

    it('returns empty array when rules do not trigger', () => {
      const monitor = new MetricMonitor();
      monitor.registerSemanticRule(nullRateRule);
      const point: MetricDataPoint = { timestamp: Date.now(), value: 10, metric: 'null_rate', source: 'src-1' };
      expect(monitor.evaluateSemanticRules(point)).toEqual([]);
    });

    it('returns violations from matching rules', () => {
      const monitor = new MetricMonitor();
      monitor.registerSemanticRule(nullRateRule);
      const point: MetricDataPoint = { timestamp: Date.now(), value: 60, metric: 'null_rate', source: 'src-1' };
      const violations = monitor.evaluateSemanticRules(point);
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('format-null-rate-max');
      expect(violations[0].severity).toBe('warning');
    });

    it('registers multiple rules and evaluates all', () => {
      const monitor = new MetricMonitor();
      monitor.registerSemanticRule(nullRateRule);
      const customRule: SemanticRule = {
        id: 'custom-1',
        name: 'Always Fires',
        description: 'Test rule',
        evaluate: (point) => ({
          ruleId: 'custom-1',
          ruleName: 'Always Fires',
          metric: point.metric,
          value: point.value,
          expected: 'anything',
          severity: 'info',
          confidence: 0.5,
        }),
      };
      monitor.registerSemanticRule(customRule);
      const point: MetricDataPoint = { timestamp: Date.now(), value: 70, metric: 'null_rate', source: 'src-1' };
      const violations = monitor.evaluateSemanticRules(point);
      expect(violations).toHaveLength(2);
    });
  });

  describe('nullRateRule', () => {
    it('ignores non null_rate metrics', () => {
      const result = nullRateRule.evaluate(
        { timestamp: Date.now(), value: 90, metric: 'latency', source: 's' },
        undefined,
      );
      expect(result).toBeNull();
    });

    it('does not fire when null rate <= 50', () => {
      const result = nullRateRule.evaluate(
        { timestamp: Date.now(), value: 50, metric: 'null_rate', source: 's' },
        undefined,
      );
      expect(result).toBeNull();
    });

    it('fires warning when null rate > 50 and <= 80', () => {
      const result = nullRateRule.evaluate(
        { timestamp: Date.now(), value: 65, metric: 'null_rate', source: 's' },
        undefined,
      );
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.confidence).toBe(0.95);
    });

    it('fires critical when null rate > 80', () => {
      const result = nullRateRule.evaluate(
        { timestamp: Date.now(), value: 90, metric: 'null_rate', source: 's' },
        undefined,
      );
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });
  });

  describe('zeroRowCountRule', () => {
    it('ignores non row_count metrics', () => {
      const result = zeroRowCountRule.evaluate(
        { timestamp: Date.now(), value: 0, metric: 'latency', source: 's' },
        undefined,
      );
      expect(result).toBeNull();
    });

    it('does not fire when no baseline exists (new table)', () => {
      const result = zeroRowCountRule.evaluate(
        { timestamp: Date.now(), value: 0, metric: 'row_count', source: 's' },
        undefined,
      );
      expect(result).toBeNull();
    });

    it('does not fire when baseline has empty history', () => {
      const result = zeroRowCountRule.evaluate(
        { timestamp: Date.now(), value: 0, metric: 'row_count', source: 's' },
        { metric: 'row_count', source: 's', history: [], lastUpdated: Date.now() },
      );
      expect(result).toBeNull();
    });

    it('fires critical when row count is 0 on active table', () => {
      const result = zeroRowCountRule.evaluate(
        { timestamp: Date.now(), value: 0, metric: 'row_count', source: 's' },
        {
          metric: 'row_count', source: 's',
          history: [{ timestamp: Date.now() - 1000, value: 100, metric: 'row_count', source: 's' }],
          lastUpdated: Date.now(),
        },
      );
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.ruleId).toBe('business-zero-rows');
    });

    it('does not fire when row count is > 0', () => {
      const result = zeroRowCountRule.evaluate(
        { timestamp: Date.now(), value: 5, metric: 'row_count', source: 's' },
        {
          metric: 'row_count', source: 's',
          history: [{ timestamp: Date.now() - 1000, value: 100, metric: 'row_count', source: 's' }],
          lastUpdated: Date.now(),
        },
      );
      expect(result).toBeNull();
    });
  });

  describe('latencyBaselineRule', () => {
    it('ignores non latency metrics', () => {
      const result = latencyBaselineRule.evaluate(
        { timestamp: Date.now(), value: 9999, metric: 'null_rate', source: 's' },
        undefined,
      );
      expect(result).toBeNull();
    });

    it('does not fire when no baseline', () => {
      const result = latencyBaselineRule.evaluate(
        { timestamp: Date.now(), value: 9999, metric: 'latency', source: 's' },
        undefined,
      );
      expect(result).toBeNull();
    });

    it('does not fire when latency is within 10x baseline', () => {
      const history = Array.from({ length: 5 }, (_, i) => ({
        timestamp: Date.now() - (5 - i) * 1000,
        value: 100,
        metric: 'latency',
        source: 's',
      }));
      const result = latencyBaselineRule.evaluate(
        { timestamp: Date.now(), value: 950, metric: 'latency', source: 's' },
        { metric: 'latency', source: 's', history, lastUpdated: Date.now() },
      );
      expect(result).toBeNull();
    });

    it('fires critical when latency exceeds 10x baseline', () => {
      const history = Array.from({ length: 5 }, (_, i) => ({
        timestamp: Date.now() - (5 - i) * 1000,
        value: 100,
        metric: 'latency',
        source: 's',
      }));
      const result = latencyBaselineRule.evaluate(
        { timestamp: Date.now(), value: 1500, metric: 'latency', source: 's' },
        { metric: 'latency', source: 's', history, lastUpdated: Date.now() },
      );
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.ruleId).toBe('threshold-latency-10x');
    });
  });
});
