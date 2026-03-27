import { describe, it, expect, beforeEach } from 'vitest';
import { createVectorStore, createRelationalStore } from '@data-workers/infrastructure-stubs';
import type { IVectorStore, IRelationalStore } from '@data-workers/infrastructure-stubs';
import { LineageTraverser } from '../rca/lineage-traverser.js';
import { IncidentClassifier } from '../rca/incident-classifier.js';
import { HistoryMatcher } from '../rca/history-matcher.js';
import { RCAOrchestrator } from '../rca/rca-orchestrator.js';
import type { AnomalyDetection } from '../engine/statistical-detector.js';

function makeDetection(metric: string, deviation: number): AnomalyDetection {
  return {
    isAnomaly: true, metric, value: 100, expected: 50,
    deviation, method: 'zscore', severity: 'warning',
    confidence: 0.9, timestamp: Date.now(),
  };
}

/** @deprecated LineageTraverser is deprecated — use graphDB.traverseUpstream() via backends.ts. Will be removed in Phase 5. */
describe('LineageTraverser (REQ-INC-002)', () => {
  const traverser = new LineageTraverser();

  it('traverses upstream with 5+ hops', async () => {
    const result = await traverser.traverseUpstream('cust-1', 'orders_table', 5);
    expect(result.depth).toBeGreaterThanOrEqual(5);
    expect(result.path.length).toBe(6); // start + 5 hops
  });

  it('applies confidence decay per hop', async () => {
    const result = await traverser.traverseUpstream('cust-1', 'table', 5);
    expect(result.confidenceAtDepth[0]).toBe(1.0);
    expect(result.confidenceAtDepth[1]).toBeLessThan(1.0);
    expect(result.confidenceAtDepth[4]).toBeLessThan(result.confidenceAtDepth[0]);
  });

  it('performs full impact analysis', async () => {
    const impact = await traverser.getImpactAnalysis('cust-1', 'orders', 3);
    expect(impact.upstream.depth).toBeGreaterThan(0);
    expect(impact.downstream.depth).toBeGreaterThan(0);
    expect(impact.totalImpact).toBeGreaterThan(0);
  });
});

describe('IncidentClassifier (REQ-INC-002)', () => {
  const classifier = new IncidentClassifier();

  it('classifies schema change', () => {
    const result = classifier.classify({
      anomalyDetections: [makeDetection('schema_column_count', 4.0)],
      affectedMetrics: ['schema_column_count'],
      recentChanges: ['schema alter table executed'],
    });
    expect(result.type).toBe('schema_change');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('classifies resource exhaustion', () => {
    const result = classifier.classify({
      anomalyDetections: [
        makeDetection('memory_usage', 5.0),
        makeDetection('cpu_usage', 4.0),
      ],
      affectedMetrics: ['memory_usage', 'cpu_usage'],
      logPatterns: ['OOM killer invoked'],
    });
    expect(result.type).toBe('resource_exhaustion');
  });

  it('classifies source delay', () => {
    const result = classifier.classify({
      anomalyDetections: [makeDetection('data_latency', 3.5)],
      affectedMetrics: ['data_latency'],
    });
    expect(result.type).toBe('source_delay');
  });

  it('classifies code regression with deploy log', () => {
    const result = classifier.classify({
      anomalyDetections: [makeDetection('error_rate', 4.0)],
      affectedMetrics: ['error_rate'],
      recentChanges: ['recent deploy at 14:00'],
      logPatterns: ['deploy completed'],
    });
    expect(result.type).toBe('code_regression');
  });

  it('classifies infrastructure failure', () => {
    const result = classifier.classify({
      anomalyDetections: [makeDetection('uptime_check', 3.0)],
      affectedMetrics: ['uptime_check'],
    });
    expect(result.type).toBe('infrastructure');
  });

  it('classifies quality degradation', () => {
    const result = classifier.classify({
      anomalyDetections: [makeDetection('null_rate', 4.0)],
      affectedMetrics: ['null_rate'],
    });
    expect(result.type).toBe('quality_degradation');
  });

  it('returns feature list', () => {
    const result = classifier.classify({
      anomalyDetections: [makeDetection('cpu_usage', 5.0)],
      affectedMetrics: ['cpu_usage'],
    });
    expect(result.features.length).toBeGreaterThan(0);
  });
});

describe('HistoryMatcher (REQ-INC-002)', () => {
  let vectorStore: IVectorStore;
  let relationalStore: IRelationalStore;

  beforeEach(async () => {
    vectorStore = await createVectorStore();
    relationalStore = await createRelationalStore();
    await relationalStore.createTable('incidents');
  });

  it('finds similar incidents', async () => {
    const matcher = new HistoryMatcher(vectorStore, relationalStore);

    // Seed relational store
    const now = Date.now();
    await relationalStore.insert('incidents', {
      id: 'past-1', customerId: 'cust-1', type: 'schema_change',
      severity: 'high', status: 'resolved', title: 'Past schema incident',
      description: '', affectedResources: JSON.stringify(['orders']),
      detectedAt: now - 86400000, resolvedAt: now - 86400000 + 600000,
      confidence: 0.9, resolution: 'automated',
      playbook: 'apply_schema_migration',
    });

    // Seed vector store
    const desc = 'schema_change high incident on orders';
    const vector = await vectorStore.embed(desc);
    await vectorStore.upsert('past-1', vector, {
      customerId: 'cust-1', type: 'schema_change', severity: 'high',
      affectedResources: ['orders'],
    }, 'incidents');

    const matches = await matcher.findSimilar('schema_change', ['orders'], 'cust-1');
    expect(matches.length).toBe(1);
    expect(matches[0].similarity).toBeGreaterThan(0.5);
    expect(matches[0].resolutionPattern).toBe('apply_schema_migration');
  });

  it('calculates resolution stats', async () => {
    const matcher = new HistoryMatcher(vectorStore, relationalStore);
    await relationalStore.insert('incidents', {
      id: 'h1', customerId: 'c1', type: 'source_delay', severity: 'medium',
      status: 'resolved', title: '', description: '', affectedResources: JSON.stringify([]),
      detectedAt: Date.now() - 1000, resolvedAt: Date.now(), confidence: 0.9,
      resolution: 'automated', playbook: 'restart_task',
    });

    const stats = await matcher.getResolutionStats('c1');
    expect(stats.total).toBe(1);
    expect(stats.autoResolved).toBe(1);
  });
});

describe('RCAOrchestrator (REQ-INC-002)', () => {
  let vectorStore: IVectorStore;
  let relationalStore: IRelationalStore;

  beforeEach(async () => {
    vectorStore = await createVectorStore();
    relationalStore = await createRelationalStore();
    await relationalStore.createTable('incidents');
  });

  it('performs full RCA analysis', async () => {
    const orchestrator = new RCAOrchestrator(vectorStore, relationalStore);
    const rca = await orchestrator.analyze(
      'inc-1', 'cust-1',
      [makeDetection('schema_column_count', 4.0)],
      ['orders_table'],
      ['migration script executed'],
      ['schema alter completed'],
    );

    expect(rca.rootCause).toContain('schema change');
    expect(rca.causalChain.length).toBeGreaterThan(0);
    expect(rca.confidence).toBeGreaterThan(0);
    expect(rca.evidenceSources).toContain('lineage_graph');
    expect(rca.evidenceSources).toContain('execution_logs');
    expect(rca.analysisTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('includes historical resolution in root cause', async () => {
    const orchestrator = new RCAOrchestrator(vectorStore, relationalStore);

    // Seed a past incident into both stores
    const now = Date.now();
    await relationalStore.insert('incidents', {
      id: 'past', customerId: 'cust-1', type: 'resource_exhaustion',
      severity: 'high', status: 'resolved', title: '', description: '',
      affectedResources: JSON.stringify(['warehouse']), detectedAt: now - 86400000,
      resolvedAt: now - 86400000 + 300000, confidence: 0.9,
      resolution: 'automated', playbook: 'scale_compute',
    });
    const desc = 'resource_exhaustion high incident on warehouse';
    const vector = await vectorStore.embed(desc);
    await vectorStore.upsert('past', vector, {
      customerId: 'cust-1', type: 'resource_exhaustion', severity: 'high',
      affectedResources: ['warehouse'],
    }, 'incidents');

    const rca = await orchestrator.analyze(
      'inc-2', 'cust-1',
      [makeDetection('memory_usage', 5.0)],
      ['warehouse'],
    );

    expect(rca.rootCause).toContain('scale_compute');
  });
});
