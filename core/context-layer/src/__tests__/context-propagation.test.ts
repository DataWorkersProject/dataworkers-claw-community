import { describe, it, expect } from 'vitest';
import { ContextPropagationEngine } from '../context-propagation.js';
import type { ContextItem } from '../context-propagation.js';

function createItem(overrides?: Partial<ContextItem>): ContextItem {
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    content: 'test content',
    source: 'test-source',
    agentId: 'dw-pipelines',
    customerId: 'cust-1',
    priority: 'task-specific',
    timestamp: Date.now(),
    tokenCount: 100,
    confidenceScore: 0.8,
    ...overrides,
  };
}

describe('ContextPropagationEngine', () => {
  const engine = new ContextPropagationEngine();

  it('selects context items within token budget', async () => {
    const items = [
      createItem({ tokenCount: 1000 }),
      createItem({ tokenCount: 1000 }),
      createItem({ tokenCount: 1000 }),
    ];

    const result = await engine.selectContext(items, {
      agentId: 'dw-pipelines',
      customerId: 'cust-1',
      taskType: 'generate_pipeline',
    }, { totalTokens: 2500 });

    expect(result.items).toHaveLength(2); // Only 2 fit in budget
    expect(result.totalTokens).toBe(2000);
    expect(result.budgetTotal).toBe(2500);
  });

  it('prioritizes task-specific over historical', async () => {
    const items = [
      createItem({ priority: 'historical', tokenCount: 500, id: 'hist' }),
      createItem({ priority: 'task-specific', tokenCount: 500, id: 'task' }),
    ];

    const result = await engine.selectContext(items, {
      agentId: 'dw-pipelines',
      customerId: 'cust-1',
      taskType: 'generate_pipeline',
    }, { totalTokens: 600 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('task'); // Task-specific wins
  });

  it('filters items below quality threshold', async () => {
    const items = [
      createItem({ confidenceScore: 0.1, relevanceScore: 0.1, freshnessScore: 0.1, timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000 }),
      createItem({ confidenceScore: 0.9, relevanceScore: 0.9 }),
    ];

    const result = await engine.selectContext(items, {
      agentId: 'dw-pipelines',
      customerId: 'cust-1',
      taskType: 'test',
    }, { minQualityScore: 0.5 });

    expect(result.items).toHaveLength(1);
  });

  it('filters items from other customers', async () => {
    const items = [
      createItem({ customerId: 'cust-1' }),
      createItem({ customerId: 'cust-2' }),
    ];

    const result = await engine.selectContext(items, {
      agentId: 'dw-pipelines',
      customerId: 'cust-1',
      taskType: 'test',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].customerId).toBe('cust-1');
  });

  // REQ-CTX-011: Conflict detection
  it('detects conflicting context items', () => {
    const items = [
      createItem({ source: 'schema', agentId: 'dw-schema', timestamp: 1000, content: 'v1' }),
      createItem({ source: 'schema', agentId: 'dw-schema', timestamp: 2000, content: 'v2' }),
    ];

    const conflicts = engine.detectConflicts(items);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].itemA.timestamp).toBe(2000); // Newer first
    expect(conflicts[0].itemB.timestamp).toBe(1000);
  });

  it('builds conflict resolution prompt', () => {
    const conflict = {
      itemA: createItem({ content: 'revenue = SUM(amount)', timestamp: 2000 }),
      itemB: createItem({ content: 'revenue = SUM(price * qty)', timestamp: 1000 }),
      field: 'metric_definition',
      description: 'Conflicting metric definitions',
      detectedAt: Date.now(),
    };

    const prompt = engine.buildConflictPrompt(conflict);
    expect(prompt).toContain('CONTEXT CONFLICT DETECTED');
    expect(prompt).toContain('Version A');
    expect(prompt).toContain('Version B');
    expect(prompt).toContain('MUST explicitly acknowledge');
  });

  it('completes selection under 50ms for reasonable inputs', async () => {
    const items = Array.from({ length: 100 }, (_, i) =>
      createItem({ id: `item-${i}`, tokenCount: 50 }),
    );

    const result = await engine.selectContext(items, {
      agentId: 'dw-pipelines',
      customerId: 'cust-1',
      taskType: 'test',
    });

    expect(result.selectionTimeMs).toBeLessThan(50);
  });
});
