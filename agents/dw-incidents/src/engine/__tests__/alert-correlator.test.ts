import { describe, it, expect } from 'vitest';
import { AlertCorrelator } from '../alert-correlator.js';
import type { AnomalyDetection } from '../statistical-detector.js';

function makeAlert(overrides: Partial<AnomalyDetection> = {}): AnomalyDetection {
  return {
    isAnomaly: true,
    metric: 'cpu_usage',
    value: 95,
    expected: 50,
    deviation: 4.5,
    method: 'zscore',
    severity: 'warning',
    confidence: 0.85,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('AlertCorrelator', () => {
  describe('correlateByTime', () => {
    it('returns empty array for no alerts', () => {
      const correlator = new AlertCorrelator();
      expect(correlator.correlateByTime([])).toEqual([]);
    });

    it('groups alerts within the temporal window', () => {
      const now = Date.now();
      const correlator = new AlertCorrelator({ temporalWindowMs: 60_000 });
      const alerts = [
        makeAlert({ metric: 'cpu_usage', timestamp: now }),
        makeAlert({ metric: 'mem_usage', timestamp: now + 30_000 }),
        makeAlert({ metric: 'disk_io', timestamp: now + 50_000 }),
      ];
      const groups = correlator.correlateByTime(alerts);
      expect(groups).toHaveLength(1);
      expect(groups[0].alerts).toHaveLength(3);
      expect(groups[0].correlationType).toBe('temporal');
      expect(groups[0].suppressedCount).toBe(2);
    });

    it('splits alerts outside the temporal window into separate groups', () => {
      const now = Date.now();
      const correlator = new AlertCorrelator({ temporalWindowMs: 60_000 });
      const alerts = [
        makeAlert({ metric: 'a', timestamp: now }),
        makeAlert({ metric: 'b', timestamp: now + 30_000 }),
        makeAlert({ metric: 'c', timestamp: now + 200_000 }), // outside window
      ];
      const groups = correlator.correlateByTime(alerts);
      expect(groups).toHaveLength(2);
      expect(groups[0].alerts).toHaveLength(2);
      expect(groups[1].alerts).toHaveLength(1);
    });

    it('picks the highest-confidence alert as root', () => {
      const now = Date.now();
      const correlator = new AlertCorrelator({ temporalWindowMs: 60_000 });
      const alerts = [
        makeAlert({ metric: 'a', confidence: 0.6, timestamp: now }),
        makeAlert({ metric: 'b', confidence: 0.95, timestamp: now + 10_000 }),
        makeAlert({ metric: 'c', confidence: 0.7, timestamp: now + 20_000 }),
      ];
      const groups = correlator.correlateByTime(alerts);
      expect(groups[0].rootAlert.confidence).toBe(0.95);
      expect(groups[0].confidence).toBe(0.95);
    });
  });

  describe('correlateByTopology', () => {
    it('groups alerts by metric namespace (dot-separated prefix)', () => {
      const correlator = new AlertCorrelator();
      const alerts = [
        makeAlert({ metric: 'orders.row_count' }),
        makeAlert({ metric: 'orders.latency' }),
        makeAlert({ metric: 'customers.row_count' }),
      ];
      const groups = correlator.correlateByTopology(alerts);
      expect(groups).toHaveLength(2);
      const orderGroup = groups.find(g => g.alerts.some(a => a.metric === 'orders.row_count'));
      expect(orderGroup!.alerts).toHaveLength(2);
      expect(orderGroup!.correlationType).toBe('topology');
    });

    it('uses full metric name when no dot separator exists', () => {
      const correlator = new AlertCorrelator();
      const alerts = [
        makeAlert({ metric: 'cpu_usage' }),
        makeAlert({ metric: 'cpu_usage' }),
        makeAlert({ metric: 'mem_usage' }),
      ];
      const groups = correlator.correlateByTopology(alerts);
      expect(groups).toHaveLength(2);
    });
  });

  describe('correlateBySemantic', () => {
    it('groups alerts by underscore-separated metric prefix', () => {
      const correlator = new AlertCorrelator();
      const alerts = [
        makeAlert({ metric: 'cpu_usage' }),
        makeAlert({ metric: 'cpu_load' }),
        makeAlert({ metric: 'mem_usage' }),
        makeAlert({ metric: 'mem_free' }),
      ];
      const groups = correlator.correlateBySemantic(alerts);
      expect(groups).toHaveLength(2);
      const cpuGroup = groups.find(g => g.alerts.some(a => a.metric === 'cpu_usage'));
      expect(cpuGroup!.alerts).toHaveLength(2);
      expect(cpuGroup!.correlationType).toBe('semantic');
    });

    it('handles metrics without underscores', () => {
      const correlator = new AlertCorrelator();
      const alerts = [
        makeAlert({ metric: 'latency' }),
        makeAlert({ metric: 'latency' }),
      ];
      const groups = correlator.correlateBySemantic(alerts);
      expect(groups).toHaveLength(1);
      expect(groups[0].alerts).toHaveLength(2);
    });
  });

  describe('correlate (full pipeline)', () => {
    it('returns zero-state for empty alerts', () => {
      const correlator = new AlertCorrelator();
      const result = correlator.correlate([]);
      expect(result.originalCount).toBe(0);
      expect(result.groupCount).toBe(0);
      expect(result.noiseReductionPercent).toBe(0);
      expect(result.groups).toEqual([]);
    });

    it('reduces noise across temporal and topology layers', () => {
      const now = Date.now();
      const correlator = new AlertCorrelator({ temporalWindowMs: 60_000 });
      // 10 alerts from same topology within same time window -> should reduce heavily
      const alerts = Array.from({ length: 10 }, (_, i) =>
        makeAlert({
          metric: 'orders.row_count',
          timestamp: now + i * 5_000,
          confidence: 0.8 + i * 0.01,
        }),
      );
      const result = correlator.correlate(alerts);
      expect(result.originalCount).toBe(10);
      expect(result.groupCount).toBe(1);
      expect(result.noiseReductionPercent).toBe(90);
    });

    it('achieves 85%+ noise reduction with many similar alerts', () => {
      const now = Date.now();
      const correlator = new AlertCorrelator({ temporalWindowMs: 120_000 });
      // 20 alerts across 2 topology groups, all within time window
      const alerts: AnomalyDetection[] = [];
      for (let i = 0; i < 20; i++) {
        alerts.push(makeAlert({
          metric: i < 10 ? 'orders.latency' : 'orders.row_count',
          timestamp: now + i * 3_000,
          confidence: 0.75 + (i % 5) * 0.04,
        }));
      }
      const result = correlator.correlate(alerts);
      expect(result.noiseReductionPercent).toBeGreaterThanOrEqual(85);
    });

    it('preserves distinct groups for unrelated alerts', () => {
      const now = Date.now();
      const correlator = new AlertCorrelator({ temporalWindowMs: 60_000 });
      const alerts = [
        makeAlert({ metric: 'orders.latency', timestamp: now }),
        makeAlert({ metric: 'customers.row_count', timestamp: now + 500_000 }), // different time window
      ];
      const result = correlator.correlate(alerts);
      // Two temporal groups, then topology splits further
      expect(result.groupCount).toBeGreaterThanOrEqual(2);
    });
  });
});
