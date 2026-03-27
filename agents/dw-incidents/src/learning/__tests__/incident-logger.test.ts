import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentLogger } from '../incident-logger.js';
import {
  InMemoryRelationalStore,
  InMemoryVectorStore,
} from '@data-workers/infrastructure-stubs';

let relationalStore: InMemoryRelationalStore;
let vectorStore: InMemoryVectorStore;

async function createLogger(): Promise<IncidentLogger> {
  relationalStore = new InMemoryRelationalStore();
  vectorStore = new InMemoryVectorStore();
  await relationalStore.createTable('incident_log');
  return new IncidentLogger(relationalStore, vectorStore);
}

describe('IncidentLogger', () => {
  it('creates instance', async () => {
    const logger = await createLogger();
    expect(logger).toBeDefined();
  });

  it('logs a record without throwing', async () => {
    const logger = await createLogger();
    await expect(logger.log({
      incidentId: 'inc-1', customerId: 'cust-1', createdAt: Date.now(),
      timeline: { detectedAt: Date.now() - 60000, resolvedAt: Date.now() },
      diagnosis: { type: 'schema_change', severity: 'high', confidence: 0.9 },
      outcome: { resolved: true, automated: false, falsePositive: false, resolutionMethod: 'manual_human' },
    })).resolves.not.toThrow();
  });

  it('calculates totalDurationMs on log', async () => {
    const logger = await createLogger();
    const now = Date.now();
    const record = {
      incidentId: 'inc-2', customerId: 'cust-1', createdAt: now,
      timeline: { detectedAt: now - 120000, resolvedAt: now },
      diagnosis: { type: 'source_delay', severity: 'medium', confidence: 0.8 },
      outcome: { resolved: true, automated: true, falsePositive: false, resolutionMethod: 'auto_playbook' as const },
    };
    await logger.log(record);
    expect(record.timeline.totalDurationMs).toBe(120000);
  });
});
