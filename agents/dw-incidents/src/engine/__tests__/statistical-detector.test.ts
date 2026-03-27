import { describe, it, expect } from 'vitest';
import { StatisticalDetector } from '../statistical-detector.js';
import type { MetricDataPoint } from '../statistical-detector.js';

const makePoints = (values: number[]): MetricDataPoint[] =>
  values.map((v, i) => ({ timestamp: i, value: v, metric: 'test', source: 'src' }));

describe('StatisticalDetector', () => {
  it('creates instance with default config', () => {
    const d = new StatisticalDetector();
    expect(d).toBeDefined();
  });

  it('detects z-score anomaly for outlier value', () => {
    const d = new StatisticalDetector();
    const history = makePoints([10, 11, 10, 9, 10, 11, 10, 9, 10, 11]);
    const current = { timestamp: 100, value: 50, metric: 'test', source: 'src' };
    const result = d.detectZScore(history, current);
    expect(result.isAnomaly).toBe(true);
  });

  it('does not flag normal value as anomaly', () => {
    const d = new StatisticalDetector();
    const history = makePoints([10, 11, 10, 9, 10, 11, 10, 9, 10, 11]);
    const current = { timestamp: 100, value: 10, metric: 'test', source: 'src' };
    const result = d.detectZScore(history, current);
    expect(result.isAnomaly).toBe(false);
  });

  it('detects IQR anomaly', () => {
    const d = new StatisticalDetector();
    const history = makePoints([10, 11, 10, 9, 10, 11, 10, 9, 10, 11]);
    const current = { timestamp: 100, value: 100, metric: 'test', source: 'src' };
    const result = d.detectIQR(history, current);
    expect(result.isAnomaly).toBe(true);
  });

  it('runs combined detect with insufficient data gracefully', () => {
    const d = new StatisticalDetector();
    const history = makePoints([10, 11]);
    const current = { timestamp: 100, value: 50, metric: 'test', source: 'src' };
    const result = d.detect(history, current);
    expect(result.isAnomaly).toBe(false);
  });
});
