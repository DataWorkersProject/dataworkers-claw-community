import { describe, it, expect, beforeEach } from 'vitest';
import { createVectorStore, createRelationalStore } from '@data-workers/infrastructure-stubs';
import type { IVectorStore, IRelationalStore } from '@data-workers/infrastructure-stubs';
import { HistoryMatcher } from '../history-matcher.js';

describe('HistoryMatcher', () => {
  let vectorStore: IVectorStore;
  let relationalStore: IRelationalStore;

  beforeEach(async () => {
    vectorStore = await createVectorStore();
    relationalStore = await createRelationalStore();
    await relationalStore.createTable('incidents');
  });

  it('returns empty array when no history', async () => {
    const matcher = new HistoryMatcher(vectorStore, relationalStore);
    const results = await matcher.findSimilar('schema_change', ['tbl'], 'cust-1');
    expect(results).toEqual([]);
  });

  it('matches incidents by type and customer', async () => {
    const matcher = new HistoryMatcher(vectorStore, relationalStore);
    const now = Date.now();
    // Insert into relational store
    await relationalStore.insert('incidents', {
      id: 'inc-1', customerId: 'cust-1', type: 'schema_change', severity: 'high',
      status: 'resolved', title: 'Test incident', description: 'Test',
      affectedResources: JSON.stringify(['tbl']), detectedAt: now - 3600000,
      resolvedAt: now, confidence: 0.9, resolution: 'automated',
      playbook: 'apply_schema_migration',
    });
    // Insert into vector store
    const desc = 'schema_change high incident on tbl';
    const vector = await vectorStore.embed(desc);
    await vectorStore.upsert('inc-1', vector, {
      customerId: 'cust-1', type: 'schema_change', severity: 'high',
      affectedResources: ['tbl'],
    }, 'incidents');

    const results = await matcher.findSimilar('schema_change', ['tbl'], 'cust-1');
    expect(results.length).toBe(1);
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  it('returns resolution stats', async () => {
    const matcher = new HistoryMatcher(vectorStore, relationalStore);
    await relationalStore.insert('incidents', {
      id: 'inc-1', customerId: 'cust-1', type: 'schema_change', severity: 'high',
      status: 'resolved', affectedResources: JSON.stringify(['tbl']),
      detectedAt: Date.now() - 60000, resolvedAt: Date.now(),
      confidence: 0.9, resolution: 'automated', playbook: 'fix',
    });
    const stats = await matcher.getResolutionStats('cust-1');
    expect(stats.total).toBe(1);
    expect(stats.resolved).toBe(1);
  });
});
