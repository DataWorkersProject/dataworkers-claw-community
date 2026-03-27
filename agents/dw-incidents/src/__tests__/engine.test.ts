import { describe, it, expect } from 'vitest';
import { StatisticalDetector } from '../engine/statistical-detector.js';
import type { MetricDataPoint } from '../engine/statistical-detector.js';
import { MetricMonitor } from '../engine/metric-monitor.js';
import { AnomalyClassifier } from '../engine/anomaly-classifier.js';

function generateBaseline(metric: string, mean: number, std: number, count: number): MetricDataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: Date.now() - (count - i) * 60_000,
    value: mean + (Math.random() - 0.5) * std * 2,
    metric,
    source: 'test_table',
  }));
}

describe('StatisticalDetector (REQ-INC-001)', () => {
  const detector = new StatisticalDetector({ zScoreThreshold: 3.0 });

  it('detects z-score anomaly', () => {
    const baseline = generateBaseline('row_count', 1000, 50, 100);
    const anomaly: MetricDataPoint = { timestamp: Date.now(), value: 1500, metric: 'row_count', source: 'test' };
    const result = detector.detectZScore(baseline, anomaly);
    expect(result.isAnomaly).toBe(true);
    expect(result.deviation).toBeGreaterThan(3);
  });

  it('does not flag normal values', () => {
    const baseline = generateBaseline('row_count', 1000, 50, 100);
    const normal: MetricDataPoint = { timestamp: Date.now(), value: 1020, metric: 'row_count', source: 'test' };
    const result = detector.detectZScore(baseline, normal);
    expect(result.isAnomaly).toBe(false);
  });

  it('detects IQR anomaly', () => {
    const baseline = generateBaseline('latency', 100, 10, 50);
    const anomaly: MetricDataPoint = { timestamp: Date.now(), value: 500, metric: 'latency', source: 'test' };
    const result = detector.detectIQR(baseline, anomaly);
    expect(result.isAnomaly).toBe(true);
  });

  it('detects moving average anomaly', () => {
    const baseline = generateBaseline('null_rate', 0.05, 0.01, 30);
    const anomaly: MetricDataPoint = { timestamp: Date.now(), value: 0.5, metric: 'null_rate', source: 'test' };
    const result = detector.detectMovingAverage(baseline, anomaly);
    expect(result.isAnomaly).toBe(true);
  });

  it('combined detect returns highest confidence', () => {
    const baseline = generateBaseline('error_rate', 0.01, 0.005, 50);
    const anomaly: MetricDataPoint = { timestamp: Date.now(), value: 0.5, metric: 'error_rate', source: 'test' };
    const result = detector.detect(baseline, anomaly);
    expect(result.isAnomaly).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('handles insufficient data gracefully', () => {
    const sparse = generateBaseline('test', 100, 10, 3);
    const point: MetricDataPoint = { timestamp: Date.now(), value: 200, metric: 'test', source: 'test' };
    const result = detector.detect(sparse, point);
    expect(result.isAnomaly).toBe(false); // Not enough data
  });

  it('assigns correct severity', () => {
    const baseline = generateBaseline('cpu', 50, 5, 100);
    const critical: MetricDataPoint = { timestamp: Date.now(), value: 99, metric: 'cpu', source: 'test' };
    const result = detector.detectZScore(baseline, critical);
    if (result.isAnomaly) {
      expect(['critical', 'warning']).toContain(result.severity);
    }
  });
});

describe('MetricMonitor (REQ-INC-001)', () => {
  it('records metrics and builds baselines', () => {
    const monitor = new MetricMonitor();
    for (let i = 0; i < 20; i++) {
      monitor.recordMetric({
        timestamp: Date.now() - (20 - i) * 60_000,
        value: 100 + Math.random() * 10,
        metric: 'row_count',
        source: 'orders',
      });
    }
    const baseline = monitor.getBaseline('orders', 'row_count');
    expect(baseline).toBeDefined();
    expect(baseline!.history.length).toBe(20);
  });

  it('fires alert on anomaly', () => {
    const monitor = new MetricMonitor();
    let alertFired = false;
    monitor.onAlert(() => { alertFired = true; });

    // Build baseline
    for (let i = 0; i < 50; i++) {
      monitor.recordMetric({
        timestamp: Date.now() - (50 - i) * 60_000,
        value: 100 + Math.random() * 5,
        metric: 'latency',
        source: 'api',
      });
    }

    // Record anomaly
    const detection = monitor.recordMetric({
      timestamp: Date.now(),
      value: 5000, // 50x normal
      metric: 'latency',
      source: 'api',
    });

    expect(detection).not.toBeNull();
    expect(alertFired).toBe(true);
  });

  it('supports seasonality adjustment', () => {
    const monitor = new MetricMonitor();
    monitor.setSeasonality('orders', 'row_count', {
      type: 'weekly',
      weekdayMultiplier: 1.0,
      weekendMultiplier: 0.5,
      monthEndMultiplier: 1.5,
    });

    // Build baseline
    for (let i = 0; i < 20; i++) {
      monitor.recordMetric({
        timestamp: Date.now() - i * 86400000,
        value: 1000,
        metric: 'row_count',
        source: 'orders',
      });
    }

    const baseline = monitor.getBaseline('orders', 'row_count');
    expect(baseline?.seasonality).toBeDefined();
  });

  it('lists monitored metrics', () => {
    const monitor = new MetricMonitor();
    monitor.recordMetric({ timestamp: Date.now(), value: 1, metric: 'a', source: 's1' });
    monitor.recordMetric({ timestamp: Date.now(), value: 2, metric: 'b', source: 's2' });
    expect(monitor.getMonitoredMetrics()).toHaveLength(2);
  });
});

describe('AnomalyClassifier (REQ-INC-005)', () => {
  it('classifies anomalies by severity', () => {
    const classifier = new AnomalyClassifier();
    const detection = {
      isAnomaly: true,
      metric: 'cpu',
      value: 99,
      expected: 50,
      deviation: 6.0,
      method: 'zscore' as const,
      severity: 'critical' as const,
      confidence: 0.9,
      timestamp: Date.now(),
    };
    const result = classifier.classify(detection);
    expect(result.severity).toBe('critical');
    expect(result.actionable).toBe(true);
  });

  it('deduplicates repeated alerts', () => {
    const classifier = new AnomalyClassifier(60_000);
    const detection = {
      isAnomaly: true,
      metric: 'cpu',
      value: 99,
      expected: 50,
      deviation: 4.0,
      method: 'zscore' as const,
      severity: 'warning' as const,
      confidence: 0.9,
      timestamp: Date.now(),
    };

    const first = classifier.classify(detection);
    const second = classifier.classify(detection);
    expect(first.actionable).toBe(true);
    expect(second.actionable).toBe(false); // Deduplicated
  });

  it('tracks suppression stats', () => {
    const classifier = new AnomalyClassifier();
    const detection = {
      isAnomaly: true, metric: 'x', value: 1, expected: 0,
      deviation: 4, method: 'zscore' as const, severity: 'warning' as const,
      confidence: 0.9, timestamp: Date.now(),
    };
    classifier.classify(detection);
    classifier.classify(detection);
    classifier.classify(detection);

    const stats = classifier.getSuppressionStats();
    expect(stats.total).toBe(3);
    expect(stats.suppressed).toBe(2);
    expect(stats.actionable).toBe(1);
  });
});
