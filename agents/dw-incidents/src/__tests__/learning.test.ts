import { describe, it, expect } from 'vitest';
import { IncidentLogger } from '../learning/incident-logger.js';
import { MTTRTracker } from '../learning/mttr-tracker.js';
import type { Incident } from '../types.js';
import type { IncidentRecord } from '../learning/incident-logger.js';
import {
  InMemoryRelationalStore,
  InMemoryVectorStore,
} from '@data-workers/infrastructure-stubs';

async function createLogger(): Promise<IncidentLogger> {
  const relationalStore = new InMemoryRelationalStore();
  const vectorStore = new InMemoryVectorStore();
  await relationalStore.createTable('incident_log');
  return new IncidentLogger(relationalStore, vectorStore);
}

function makeIncident(overrides?: Partial<Incident>): Incident {
  return {
    id: `inc-${Math.random().toString(36).slice(2)}`,
    customerId: 'cust-1',
    type: 'quality_degradation',
    severity: 'medium',
    status: 'resolved',
    title: 'Test incident',
    description: 'Test',
    affectedResources: ['table_a'],
    detectedAt: Date.now() - 600_000, // 10 min ago
    resolvedAt: Date.now(),
    confidence: 0.9,
    metadata: {},
    ...overrides,
  };
}

function makeRecord(overrides?: Partial<IncidentRecord>): IncidentRecord {
  const now = Date.now();
  return {
    incidentId: `inc-${Math.random().toString(36).slice(2)}`,
    customerId: 'cust-1',
    timeline: {
      detectedAt: now - 600_000,
      resolvedAt: now,
      totalDurationMs: 600_000, // 10 minutes
    },
    diagnosis: { type: 'quality_degradation', severity: 'medium', confidence: 0.9 },
    outcome: { resolved: true, automated: true, falsePositive: false, resolutionMethod: 'auto_playbook' },
    createdAt: now,
    ...overrides,
  };
}

describe('IncidentLogger (REQ-INC-006)', () => {
  it('logs incident records', async () => {
    const logger = await createLogger();
    const record = logger.createRecord(makeIncident());
    await logger.log(record);
    expect(await logger.getCount()).toBe(1);
  });

  it('calculates total duration', async () => {
    const logger = await createLogger();
    const incident = makeIncident();
    const record = logger.createRecord(incident);
    await logger.log(record);
    expect(record.timeline.totalDurationMs).toBeGreaterThan(0);
  });

  it('marks false positives', async () => {
    const logger = await createLogger();
    const record = logger.createRecord(makeIncident({ id: 'fp-1' }));
    await logger.log(record);
    expect(await logger.markFalsePositive('fp-1')).toBe(true);
    const records = await logger.getRecords('cust-1');
    expect(records[0].outcome.falsePositive).toBe(true);
  });

  it('accepts feedback', async () => {
    const logger = await createLogger();
    const record = logger.createRecord(makeIncident({ id: 'fb-1' }));
    await logger.log(record);
    expect(await logger.provideFeedback('fb-1', 'correct')).toBe(true);
    const records = await logger.getRecords('cust-1');
    expect(records[0].outcome.feedback).toBe('correct');
  });

  it('filters by customer', async () => {
    const logger = await createLogger();
    await logger.log(logger.createRecord(makeIncident({ customerId: 'cust-1' })));
    await logger.log(logger.createRecord(makeIncident({ customerId: 'cust-2' })));
    expect(await logger.getRecords('cust-1')).toHaveLength(1);
    expect(await logger.getRecords('cust-2')).toHaveLength(1);
  });
});

describe('MTTRTracker (REQ-INC-008)', () => {
  it('generates MTTR report', () => {
    const tracker = new MTTRTracker(30);
    const records = [
      makeRecord({ timeline: { detectedAt: Date.now() - 900_000, resolvedAt: Date.now(), totalDurationMs: 900_000 } }), // 15 min
      makeRecord({ timeline: { detectedAt: Date.now() - 300_000, resolvedAt: Date.now(), totalDurationMs: 300_000 } }), // 5 min
    ];

    const report = tracker.generateReport(records, 'cust-1');
    expect(report.totalIncidents).toBe(2);
    expect(report.resolvedIncidents).toBe(2);
    expect(report.mttrMs).toBe(600_000); // Average of 15 and 5 = 10 min
    expect(report.mttrMinutes).toBe(10);
  });

  it('calculates auto-resolution rate', () => {
    const tracker = new MTTRTracker(30);
    const records = [
      makeRecord({ outcome: { resolved: true, automated: true, falsePositive: false, resolutionMethod: 'auto_playbook' } }),
      makeRecord({ outcome: { resolved: true, automated: true, falsePositive: false, resolutionMethod: 'auto_playbook' } }),
      makeRecord({ outcome: { resolved: true, automated: false, falsePositive: false, resolutionMethod: 'manual_human' } }),
    ];

    const report = tracker.generateReport(records, 'cust-1');
    expect(report.autoResolutionRate).toBeCloseTo(0.667, 1);
  });

  it('tracks by incident type', () => {
    const tracker = new MTTRTracker(30);
    const records = [
      makeRecord({ diagnosis: { type: 'schema_change', severity: 'high', confidence: 0.9 } }),
      makeRecord({ diagnosis: { type: 'schema_change', severity: 'high', confidence: 0.9 } }),
      makeRecord({ diagnosis: { type: 'source_delay', severity: 'medium', confidence: 0.85 } }),
    ];

    const report = tracker.generateReport(records, 'cust-1');
    expect(report.byType['schema_change'].count).toBe(2);
    expect(report.byType['source_delay'].count).toBe(1);
  });

  it('checks MTTR target (8-15 minutes)', () => {
    const tracker = new MTTRTracker(30);
    const goodReport = tracker.generateReport(
      [makeRecord({ timeline: { detectedAt: 0, resolvedAt: 600_000, totalDurationMs: 600_000 } })],
      'cust-1',
    );
    expect(tracker.isMeetingTarget(goodReport)).toBe(true); // 10 min

    const badReport = tracker.generateReport(
      [makeRecord({ timeline: { detectedAt: 0, resolvedAt: 7_200_000, totalDurationMs: 7_200_000 } })],
      'cust-1',
    );
    expect(tracker.isMeetingTarget(badReport)).toBe(false); // 120 min
  });

  it('checks auto-resolution rate target (60-70%)', () => {
    const tracker = new MTTRTracker(30);
    const records = [
      makeRecord({ outcome: { resolved: true, automated: true, falsePositive: false, resolutionMethod: 'auto_playbook' } }),
      makeRecord({ outcome: { resolved: true, automated: true, falsePositive: false, resolutionMethod: 'auto_playbook' } }),
      makeRecord({ outcome: { resolved: true, automated: false, falsePositive: false, resolutionMethod: 'manual_human' } }),
    ];

    const report = tracker.generateReport(records, 'cust-1');
    expect(tracker.isAutoResolutionOnTarget(report)).toBe(true); // 66%
  });

  it('calculates false positive rate', () => {
    const tracker = new MTTRTracker(30);
    const records = [
      makeRecord({ outcome: { resolved: true, automated: true, falsePositive: true, resolutionMethod: 'auto_playbook' } }),
      makeRecord(),
      makeRecord(),
    ];

    const report = tracker.generateReport(records, 'cust-1');
    expect(report.falsePositiveRate).toBeCloseTo(0.333, 1);
  });

  it('handles empty records', () => {
    const tracker = new MTTRTracker(30);
    const report = tracker.generateReport([], 'cust-1');
    expect(report.totalIncidents).toBe(0);
    expect(report.mttrMs).toBe(0);
    expect(report.autoResolutionRate).toBe(0);
  });
});
