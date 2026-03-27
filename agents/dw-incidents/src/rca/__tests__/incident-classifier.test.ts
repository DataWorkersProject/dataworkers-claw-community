import { describe, it, expect } from 'vitest';
import { IncidentClassifier } from '../incident-classifier.js';

describe('IncidentClassifier', () => {
  it('classifies schema-related anomalies as schema_change', () => {
    const classifier = new IncidentClassifier();
    const result = classifier.classify({
      anomalyDetections: [{
        isAnomaly: true, metric: 'schema_column_count', value: 12, expected: 10,
        deviation: 3, method: 'zscore', severity: 'warning', confidence: 0.9, timestamp: Date.now(),
      }],
      affectedMetrics: ['schema_column_count'],
    });
    expect(result.type).toBe('schema_change');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('classifies latency anomalies as source_delay', () => {
    const classifier = new IncidentClassifier();
    const result = classifier.classify({
      anomalyDetections: [{
        isAnomaly: true, metric: 'delivery_latency', value: 300, expected: 50,
        deviation: 5, method: 'zscore', severity: 'critical', confidence: 0.95, timestamp: Date.now(),
      }],
      affectedMetrics: ['delivery_latency'],
    });
    expect(result.type).toBe('source_delay');
  });

  it('uses log patterns for classification', () => {
    const classifier = new IncidentClassifier();
    const result = classifier.classify({
      anomalyDetections: [],
      affectedMetrics: [],
      logPatterns: ['OOM killed process 12345'],
    });
    expect(result.type).toBe('resource_exhaustion');
  });

  it('returns normalized scores', () => {
    const classifier = new IncidentClassifier();
    const result = classifier.classify({
      anomalyDetections: [{
        isAnomaly: true, metric: 'cpu_usage', value: 99, expected: 50,
        deviation: 4, method: 'zscore', severity: 'critical', confidence: 0.9, timestamp: Date.now(),
      }],
      affectedMetrics: ['cpu_usage'],
    });
    const maxScore = Math.max(...Object.values(result.scores));
    expect(maxScore).toBe(1);
  });
});
