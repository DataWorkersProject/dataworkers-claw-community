import { describe, it, expect } from 'vitest';
import { AuditEngine } from '../audit-engine.js';

describe('AuditEngine', () => {
  it('exports AuditEngine class', () => {
    expect(AuditEngine).toBeDefined();
  });

  it('creates instance', () => {
    const engine = new AuditEngine();
    expect(engine).toBeDefined();
  });

  it('generates a report with evidence chain', async () => {
    const engine = new AuditEngine();
    const now = Date.now();
    const report = await engine.generateReport({
      customerId: 'cust-1',
      from: now - 86400000 * 7,
      to: now,
    });
    expect(report.customerId).toBe('cust-1');
    expect(report.evidenceChain.length).toBeGreaterThan(0);
    expect(report.summary.totalActions).toBeGreaterThan(0);
    expect(report.id).toMatch(/^audit-/);
  });
});
