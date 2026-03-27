import { describe, it, expect } from 'vitest';
import { AnomalyClassifier } from '../anomaly-classifier.js';
import type { AnomalyDetection } from '../statistical-detector.js';

const makeDetection = (overrides?: Partial<AnomalyDetection>): AnomalyDetection => ({
  isAnomaly: true,
  metric: 'row_count',
  value: 100,
  expected: 50,
  deviation: 4.0,
  method: 'zscore',
  severity: 'warning',
  confidence: 0.9,
  timestamp: Date.now(),
  ...overrides,
});

describe('AnomalyClassifier', () => {
  it('classifies an anomaly with severity', () => {
    const classifier = new AnomalyClassifier();
    const result = classifier.classify(makeDetection({ deviation: 4.0 }));
    expect(result.severity).toBe('high');
    expect(result.actionable).toBe(true);
  });

  it('suppresses duplicate alerts within window', () => {
    const classifier = new AnomalyClassifier();
    const det = makeDetection();
    classifier.classify(det);
    const second = classifier.classify(det);
    expect(second.actionable).toBe(false);
  });

  it('returns suppression stats', () => {
    const classifier = new AnomalyClassifier();
    classifier.classify(makeDetection());
    classifier.classify(makeDetection());
    const stats = classifier.getSuppressionStats();
    expect(stats.total).toBe(2);
    expect(stats.suppressed).toBe(1);
  });

  it('maps critical severity for high deviation', () => {
    const classifier = new AnomalyClassifier();
    const result = classifier.classify(makeDetection({ deviation: 6.0 }));
    expect(result.severity).toBe('critical');
  });
});
