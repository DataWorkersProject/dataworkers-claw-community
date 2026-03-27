import { describe, it, expect } from 'vitest';
import { InMemoryOrchestratorAPI } from '../orchestrator-api.js';

describe('InMemoryOrchestratorAPI', () => {
  it('getTaskStatus returns null for unknown task', async () => {
    const api = new InMemoryOrchestratorAPI();
    const status = await api.getTaskStatus('unknown_dag', 'unknown_task');
    expect(status).toBeNull();
  });

  it('restartTask restarts and returns success', async () => {
    const api = new InMemoryOrchestratorAPI();
    const result = await api.restartTask('dag1', 'task1');
    expect(result.success).toBe(true);
    expect(result.taskId).toBe('task1');
    expect(result.dagId).toBe('dag1');
    expect(result.restartedAt).toBeGreaterThan(0);
  });

  it('getTaskStatus returns status after restart', async () => {
    const api = new InMemoryOrchestratorAPI();
    await api.restartTask('dag1', 'task1');
    const status = await api.getTaskStatus('dag1', 'task1');
    expect(status).not.toBeNull();
    expect(status!.status).toBe('success');
    expect(status!.taskId).toBe('task1');
    expect(status!.dagId).toBe('dag1');
  });

  it('triggerDag creates a queued dag run', async () => {
    const api = new InMemoryOrchestratorAPI();
    const result = await api.triggerDag('etl_orders_daily', { date: '2025-01-01' });
    expect(result.dagId).toBe('etl_orders_daily');
    expect(result.state).toBe('queued');
    expect(result.dagRunId).toContain('run-etl_orders_daily');
    expect(result.triggeredAt).toBeGreaterThan(0);
  });

  it('scaleCompute scales and returns previous size', async () => {
    const api = new InMemoryOrchestratorAPI();
    const result = await api.scaleCompute('warehouse_primary', 'L');
    expect(result.success).toBe(true);
    expect(result.previousSize).toBe('XS'); // default when no prior size
    expect(result.newSize).toBe('L');
    // Scale again to confirm previous size is tracked
    const result2 = await api.scaleCompute('warehouse_primary', 'XL');
    expect(result2.previousSize).toBe('L');
  });

  it('seed populates tasks including one failed task', async () => {
    const api = new InMemoryOrchestratorAPI();
    api.seed();
    const failedTask = await api.getTaskStatus('etl_orders_daily', 'transform_orders');
    expect(failedTask).not.toBeNull();
    expect(failedTask!.status).toBe('failed');
    // A successful task should also be present
    const successTask = await api.getTaskStatus('etl_orders_daily', 'extract_orders');
    expect(successTask).not.toBeNull();
    expect(successTask!.status).toBe('success');
  });

  it('getTaskStatus returns failed task after seed', async () => {
    const api = new InMemoryOrchestratorAPI();
    api.seed();
    const status = await api.getTaskStatus('etl_orders_daily', 'transform_orders');
    expect(status).not.toBeNull();
    expect(status!.status).toBe('failed');
    expect(status!.dagId).toBe('etl_orders_daily');
    expect(status!.taskId).toBe('transform_orders');
  });
});
