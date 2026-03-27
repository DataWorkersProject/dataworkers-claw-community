import { describe, it, expect } from 'vitest';
import { MTTRTracker } from '../mttr-tracker.js';

describe('MTTRTracker', () => {
  it('generates empty report for no records', () => {
    const tracker = new MTTRTracker();
    const report = tracker.generateReport([], 'cust-1');
    expect(report.totalIncidents).toBe(0);
    expect(report.mttrMs).toBe(0);
  });

  it('calculates MTTR from resolved records', () => {
    const tracker = new MTTRTracker();
    const now = Date.now();
    const records = [{
      customerId: 'cust-1', createdAt: now - 3600000,
      diagnosis: { type: 'schema_change', severity: 'high' },
      outcome: { resolved: true, automated: false, falsePositive: false },
      timeline: { totalDurationMs: 600000 },
    }] as any[];
    const report = tracker.generateReport(records, 'cust-1');
    expect(report.totalIncidents).toBe(1);
    expect(report.mttrMs).toBe(600000);
    expect(report.mttrMinutes).toBe(10);
  });

  it('isMeetingTarget returns true for fast resolution', () => {
    const tracker = new MTTRTracker();
    expect(tracker.isMeetingTarget({ mttrMinutes: 10 } as any)).toBe(true);
    expect(tracker.isMeetingTarget({ mttrMinutes: 20 } as any)).toBe(false);
  });

  it('isAutoResolutionOnTarget checks threshold', () => {
    const tracker = new MTTRTracker();
    expect(tracker.isAutoResolutionOnTarget({ autoResolutionRate: 0.65 } as any)).toBe(true);
    expect(tracker.isAutoResolutionOnTarget({ autoResolutionRate: 0.5 } as any)).toBe(false);
  });
});
