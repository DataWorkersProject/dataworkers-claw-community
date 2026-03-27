import { describe, it, expect, beforeEach } from 'vitest';
import { createVectorStore, createRelationalStore } from '@data-workers/infrastructure-stubs';
import type { IVectorStore, IRelationalStore } from '@data-workers/infrastructure-stubs';
import { HistoryMatcher } from '../rca/history-matcher.js';
import type { KnowledgeLevel } from '../rca/history-matcher.js';

describe('Hierarchical Knowledge (buildKnowledge)', () => {
  let vectorStore: IVectorStore;
  let relationalStore: IRelationalStore;
  let matcher: HistoryMatcher;

  beforeEach(async () => {
    vectorStore = await createVectorStore();
    relationalStore = await createRelationalStore();
    await relationalStore.createTable('incidents');
    matcher = new HistoryMatcher(vectorStore, relationalStore);
  });

  it('returns 3 levels with empty entries when no incidents', async () => {
    const levels = await matcher.buildKnowledge('cust-1');
    expect(levels).toHaveLength(3);
    expect(levels[0].level).toBe(1);
    expect(levels[0].label).toBe('individual');
    expect(levels[0].entries).toHaveLength(0);
    expect(levels[1].level).toBe(2);
    expect(levels[1].label).toBe('pattern');
    expect(levels[1].entries).toHaveLength(0);
    expect(levels[2].level).toBe(3);
    expect(levels[2].label).toBe('category');
    expect(levels[2].entries).toHaveLength(0);
  });

  it('returns individual incidents at level 1', async () => {
    await relationalStore.insert('incidents', {
      id: 'inc-1', customerId: 'cust-1', type: 'schema_change', severity: 'high',
      status: 'resolved', affectedResources: JSON.stringify(['orders']),
      detectedAt: Date.now() - 60000, resolvedAt: Date.now(), confidence: 0.9,
      resolution: 'automated',
    });

    const levels = await matcher.buildKnowledge('cust-1');
    expect(levels[0].entries).toHaveLength(1);
    expect(levels[0].entries[0].id).toBe('inc-1');
  });

  it('detects patterns at level 2 with 2+ occurrences', async () => {
    const now = Date.now();
    const resources = JSON.stringify(['orders']);
    await relationalStore.insert('incidents', {
      id: 'inc-1', customerId: 'cust-1', type: 'schema_change', severity: 'high',
      status: 'resolved', affectedResources: resources,
      detectedAt: now - 120000, resolvedAt: now - 60000, confidence: 0.9,
      resolution: 'automated',
    });
    await relationalStore.insert('incidents', {
      id: 'inc-2', customerId: 'cust-1', type: 'schema_change', severity: 'high',
      status: 'resolved', affectedResources: resources,
      detectedAt: now - 60000, resolvedAt: now, confidence: 0.85,
      resolution: 'automated',
    });

    const levels = await matcher.buildKnowledge('cust-1');
    // Level 2: should have a pattern for schema_change on orders
    expect(levels[1].entries.length).toBeGreaterThanOrEqual(1);
    const pattern = levels[1].entries[0];
    expect(pattern.supportingIncidentIds).toHaveLength(2);
    expect(pattern.confidence).toBeGreaterThanOrEqual(0.5);
    expect(pattern.summary).toContain('schema_change');
  });

  it('does not create pattern for single occurrence', async () => {
    await relationalStore.insert('incidents', {
      id: 'inc-1', customerId: 'cust-1', type: 'schema_change', severity: 'high',
      status: 'resolved', affectedResources: JSON.stringify(['orders']),
      detectedAt: Date.now() - 60000, resolvedAt: Date.now(), confidence: 0.9,
      resolution: 'manual',
    });

    const levels = await matcher.buildKnowledge('cust-1');
    expect(levels[1].entries).toHaveLength(0);
  });

  it('builds category insights at level 3', async () => {
    const now = Date.now();
    await relationalStore.insert('incidents', {
      id: 'inc-1', customerId: 'cust-1', type: 'source_delay', severity: 'medium',
      status: 'resolved', affectedResources: JSON.stringify(['pipeline-a']),
      detectedAt: now - 120000, resolvedAt: now - 60000, confidence: 0.8,
      resolution: 'automated',
    });
    await relationalStore.insert('incidents', {
      id: 'inc-2', customerId: 'cust-1', type: 'source_delay', severity: 'high',
      status: 'resolved', affectedResources: JSON.stringify(['pipeline-b']),
      detectedAt: now - 60000, resolvedAt: now, confidence: 0.85,
      resolution: 'manual',
    });

    const levels = await matcher.buildKnowledge('cust-1');
    const categoryLevel = levels[2];
    expect(categoryLevel.entries.length).toBeGreaterThanOrEqual(1);
    const cat = categoryLevel.entries.find(e => e.id === 'category-source_delay');
    expect(cat).toBeDefined();
    expect(cat!.summary).toContain('source_delay');
    expect(cat!.summary).toContain('2 total');
    expect(cat!.summary).toContain('50% auto-resolved');
    expect(cat!.supportingIncidentIds).toHaveLength(2);
  });

  it('isolates knowledge by customer', async () => {
    const now = Date.now();
    await relationalStore.insert('incidents', {
      id: 'inc-1', customerId: 'cust-1', type: 'schema_change', severity: 'high',
      status: 'resolved', affectedResources: JSON.stringify(['tbl']),
      detectedAt: now - 60000, resolvedAt: now, confidence: 0.9,
      resolution: 'automated',
    });
    await relationalStore.insert('incidents', {
      id: 'inc-2', customerId: 'cust-2', type: 'schema_change', severity: 'high',
      status: 'resolved', affectedResources: JSON.stringify(['tbl']),
      detectedAt: now - 60000, resolvedAt: now, confidence: 0.9,
      resolution: 'automated',
    });

    const levels = await matcher.buildKnowledge('cust-1');
    expect(levels[0].entries).toHaveLength(1);
    expect(levels[0].entries[0].id).toBe('inc-1');
  });

  it('caps pattern confidence at 0.95', async () => {
    const now = Date.now();
    const resources = JSON.stringify(['orders']);
    // Insert 10 incidents of same type+resource to push confidence high
    for (let i = 0; i < 10; i++) {
      await relationalStore.insert('incidents', {
        id: `inc-${i}`, customerId: 'cust-1', type: 'schema_change', severity: 'high',
        status: 'resolved', affectedResources: resources,
        detectedAt: now - (10 - i) * 60000, resolvedAt: now - (9 - i) * 60000,
        confidence: 0.9, resolution: 'automated',
      });
    }

    const levels = await matcher.buildKnowledge('cust-1');
    const pattern = levels[1].entries[0];
    expect(pattern.confidence).toBeLessThanOrEqual(0.95);
  });
});
