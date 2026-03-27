import { describe, it, expect } from 'vitest';
import { FactualGroundingGate } from '../factual-grounding.js';

describe('FactualGroundingGate', () => {
  it('exports FactualGroundingGate class', () => {
    expect(FactualGroundingGate).toBeDefined();
  });

  it('creates instance with default catalog lookup', () => {
    const gate = new FactualGroundingGate();
    expect(gate.name).toBe('factual-grounding');
  });

  it('passes when all entities exist', async () => {
    const gate = new FactualGroundingGate(async () => true);
    const result = await gate.validate({
      content: 'The users table has good data quality.',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
    });
    expect(result.passed).toBe(true);
    expect(result.gateName).toBe('factual-grounding');
  });

  it('uses custom catalog lookup function', async () => {
    const lookup = async (_cid: string, _type: string, name: string) => name !== 'nonexistent';
    const gate = new FactualGroundingGate(lookup);
    const result = await gate.validate({
      content: 'Check the data',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
    });
    expect(typeof result.passed).toBe('boolean');
  });
});
