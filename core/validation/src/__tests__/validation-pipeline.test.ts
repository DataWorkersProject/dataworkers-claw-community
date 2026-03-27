import { describe, it, expect } from 'vitest';
import { ValidationPipeline } from '../validation-pipeline.js';
import { ConfidenceGate } from '../gates/confidence-gate.js';

describe('ValidationPipeline', () => {
  it('exports ValidationPipeline class', () => {
    expect(ValidationPipeline).toBeDefined();
  });

  it('creates an empty pipeline', () => {
    const pipeline = new ValidationPipeline();
    expect(pipeline).toBeDefined();
  });

  it('adds gates and validates', async () => {
    const pipeline = new ValidationPipeline();
    pipeline.addGate(new ConfidenceGate(0.5));

    const result = await pipeline.validate({
      content: 'test',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
      metadata: { confidence: 0.9 },
    });

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(typeof result.overallConfidence).toBe('number');
  });

  it('fails when a gate fails', async () => {
    const pipeline = new ValidationPipeline();
    pipeline.addGate(new ConfidenceGate(0.99));

    const result = await pipeline.validate({
      content: 'test',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
      metadata: { confidence: 0.5 },
    });

    expect(result.passed).toBe(false);
  });
});
