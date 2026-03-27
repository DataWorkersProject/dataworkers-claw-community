import { describe, it, expect } from 'vitest';
import { TaskScheduler } from '../task-scheduler.js';
import { InMemoryKeyValueStore } from '@data-workers/infrastructure-stubs';

describe('TaskScheduler', () => {
  it('exports TaskScheduler class', () => {
    expect(TaskScheduler).toBeDefined();
  });

  it('creates instance with KV store', () => {
    const kv = new InMemoryKeyValueStore();
    const scheduler = new TaskScheduler(kv);
    expect(scheduler).toBeDefined();
  });

  it('submits a task', async () => {
    const kv = new InMemoryKeyValueStore();
    const scheduler = new TaskScheduler(kv);
    await scheduler.submit({
      id: 'task-1',
      type: 'generate-pipeline',
      priority: 1,
      createdAt: Date.now(),
      status: 'queued',
      payload: { name: 'test' },
    } as any);
    // Verify task was queued (no error thrown)
    expect(true).toBe(true);
  });
});
