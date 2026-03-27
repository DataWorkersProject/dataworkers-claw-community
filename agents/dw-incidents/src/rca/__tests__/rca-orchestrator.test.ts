import { describe, it, expect, beforeEach } from 'vitest';
import { createVectorStore, createRelationalStore } from '@data-workers/infrastructure-stubs';
import type { IVectorStore, IRelationalStore } from '@data-workers/infrastructure-stubs';
import { RCAOrchestrator } from '../rca-orchestrator.js';

describe('RCAOrchestrator', () => {
  let vectorStore: IVectorStore;
  let relationalStore: IRelationalStore;

  beforeEach(async () => {
    vectorStore = await createVectorStore();
    relationalStore = await createRelationalStore();
    await relationalStore.createTable('incidents');
  });

  it('creates instance with sub-components', () => {
    const orch = new RCAOrchestrator(vectorStore, relationalStore);
    expect(orch).toBeDefined();
    expect(orch.getClassifier()).toBeDefined();
    expect(orch.getHistoryMatcher()).toBeDefined();
  });

  it('performs full RCA analysis', async () => {
    const orch = new RCAOrchestrator(vectorStore, relationalStore);
    const result = await orch.analyze(
      'inc-1', 'cust-1',
      [{
        isAnomaly: true, metric: 'latency', value: 500, expected: 50,
        deviation: 4, method: 'zscore', severity: 'critical', confidence: 0.9, timestamp: Date.now(),
      }],
      ['orders_table'],
    );
    expect(result.incidentId).toBe('inc-1');
    expect(result.rootCause).toBeDefined();
    expect(result.causalChain.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.analysisTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('includes log patterns in evidence sources', async () => {
    const orch = new RCAOrchestrator(vectorStore, relationalStore);
    const result = await orch.analyze(
      'inc-2', 'cust-1', [], ['tbl'], ['OOM killed'],
    );
    expect(result.evidenceSources).toContain('execution_logs');
  });
});
