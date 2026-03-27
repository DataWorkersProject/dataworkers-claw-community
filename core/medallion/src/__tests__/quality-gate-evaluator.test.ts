import { describe, it, expect } from 'vitest';
import { QualityGateEvaluator } from '../quality-gate-evaluator.js';
import type { QualityGate } from '../types.js';

describe('QualityGateEvaluator', () => {
  it('exports QualityGateEvaluator class', () => {
    expect(QualityGateEvaluator).toBeDefined();
  });

  it('evaluates completeness gate', () => {
    const evaluator = new QualityGateEvaluator();
    const gates: QualityGate[] = [
      { name: 'completeness-check', dimension: 'completeness', threshold: 80, onFailure: 'block' },
    ];
    const data = [
      { id: 1, name: 'Alice', email: 'alice@test.com' },
      { id: 2, name: 'Bob', email: 'bob@test.com' },
    ];
    const results = evaluator.evaluateGates(gates, data);
    expect(results).toHaveLength(1);
    expect(typeof results[0].score).toBe('number');
    expect(typeof results[0].passed).toBe('boolean');
    expect(results[0].gate.name).toBe('completeness-check');
  });

  it('evaluates uniqueness gate', () => {
    const evaluator = new QualityGateEvaluator();
    const gates: QualityGate[] = [
      { name: 'uniqueness-check', dimension: 'uniqueness', threshold: 90, onFailure: 'alert' },
    ];
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 2, name: 'Bob' },
    ];
    const results = evaluator.evaluateGates(gates, data);
    expect(results).toHaveLength(1);
    expect(typeof results[0].score).toBe('number');
  });

  it('returns empty results for empty gates', () => {
    const evaluator = new QualityGateEvaluator();
    const results = evaluator.evaluateGates([], [{ id: 1 }]);
    expect(results).toHaveLength(0);
  });
});
