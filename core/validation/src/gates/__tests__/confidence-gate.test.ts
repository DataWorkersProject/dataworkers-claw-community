import { describe, it, expect } from 'vitest';
import { ConfidenceGate } from '../confidence-gate.js';

describe('ConfidenceGate', () => {
  it('exports ConfidenceGate class', () => {
    expect(ConfidenceGate).toBeDefined();
    expect(typeof ConfidenceGate).toBe('function');
  });

  it('creates instance with default threshold', () => {
    const gate = new ConfidenceGate();
    expect(gate.name).toBe('confidence');
  });

  it('passes when confidence is above threshold', async () => {
    const gate = new ConfidenceGate(0.85);
    const result = await gate.validate({
      content: 'test content',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
      metadata: { confidence: 0.95 },
    });
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when confidence is below threshold', async () => {
    const gate = new ConfidenceGate(0.85);
    const result = await gate.validate({
      content: 'test content',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
      metadata: { confidence: 0.5 },
    });
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('LOW_CONFIDENCE');
  });

  it('defaults confidence to 0 when metadata is missing', async () => {
    const gate = new ConfidenceGate();
    const result = await gate.validate({
      content: 'test',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
    });
    expect(result.passed).toBe(false);
  });
});
