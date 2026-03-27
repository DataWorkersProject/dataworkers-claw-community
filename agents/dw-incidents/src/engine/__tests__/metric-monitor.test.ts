import { describe, it, expect } from 'vitest';
import { MetricMonitor } from '../metric-monitor.js';

describe('MetricMonitor', () => {
  it('creates instance with default config', () => {
    const monitor = new MetricMonitor();
    expect(monitor).toBeDefined();
  });

  it('creates instance with custom config', () => {
    const monitor = new MetricMonitor({ checkIntervalMs: 30_000 });
    expect(monitor).toBeDefined();
  });

  it('registers alert callback', () => {
    const monitor = new MetricMonitor();
    const alerts: unknown[] = [];
    monitor.onAlert((d) => alerts.push(d));
    expect(alerts).toHaveLength(0);
  });

  it('records metric without error', () => {
    const monitor = new MetricMonitor();
    const result = monitor.recordMetric({
      timestamp: Date.now(), value: 42, metric: 'row_count', source: 'pipeline-1',
    });
    // First data point builds baseline — no anomaly expected
    expect(result === null || result.isAnomaly === false).toBe(true);
  });
});
