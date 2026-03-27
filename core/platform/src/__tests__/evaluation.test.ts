import { describe, it, expect } from 'vitest';
import { EvaluationFramework } from '../evaluation.js';

describe('EvaluationFramework', () => {
  it('exports EvaluationFramework class', () => {
    expect(EvaluationFramework).toBeDefined();
  });

  it('creates with default config', () => {
    const framework = new EvaluationFramework();
    expect(framework).toBeDefined();
  });

  it('runs benchmark and returns results', async () => {
    const framework = new EvaluationFramework();
    const result = await framework.runBenchmark('v1.0');
    expect(result.modelVersion).toBe('v1.0');
    expect(typeof result.metrics.sqlSyntacticAccuracy).toBe('number');
    expect(typeof result.passedThresholds).toBe('boolean');
    expect(result.corpusSize).toBeGreaterThan(0);
  });
});
