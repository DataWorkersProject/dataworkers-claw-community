import { describe, it, expect } from 'vitest';
import { CodeValidationGate } from '../code-validation.js';

describe('CodeValidationGate', () => {
  it('exports CodeValidationGate class', () => {
    expect(CodeValidationGate).toBeDefined();
  });

  it('creates instance with validators', () => {
    const gate = new CodeValidationGate();
    expect(gate.name).toBe('code-validation');
  });

  it('validates SQL content', async () => {
    const gate = new CodeValidationGate();
    const result = await gate.validate({
      content: 'SELECT id, name FROM users WHERE active = true',
      contentType: 'sql',
      agentId: 'agent-1',
      customerId: 'cust-1',
    });
    expect(result.gateName).toBe('code-validation');
    expect(typeof result.passed).toBe('boolean');
  });

  it('handles unknown content type gracefully', async () => {
    const gate = new CodeValidationGate();
    const result = await gate.validate({
      content: 'some content',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
    });
    expect(result.passed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
