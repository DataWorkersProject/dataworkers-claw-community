/**
 * In-memory orchestrator API stub for development and testing.
 * Simulates Airflow/orchestrator operations: restart tasks, trigger DAGs, scale compute.
 */

export interface TaskStatus {
  taskId: string;
  dagId: string;
  status: 'running' | 'failed' | 'success' | 'queued';
  lastRun: number;
}

export interface RestartResult {
  success: boolean;
  taskId: string;
  dagId: string;
  restartedAt: number;
}

export interface DagRunResult {
  dagRunId: string;
  dagId: string;
  state: 'queued' | 'running' | 'success' | 'failed';
  triggeredAt: number;
}

export interface ScaleResult {
  success: boolean;
  resourceId: string;
  previousSize: string;
  newSize: string;
  scaledAt: number;
}

import type { IOrchestratorAPI } from './interfaces/index.js';

export class InMemoryOrchestratorAPI implements IOrchestratorAPI {
  private tasks: Map<string, TaskStatus> = new Map();
  private dagRuns: Map<string, DagRunResult> = new Map();
  private computeSizes: Map<string, string> = new Map();

  /**
   * Restart a failed task within a DAG.
   */
  async restartTask(dagId: string, taskId: string): Promise<RestartResult> {
    const key = `${dagId}:${taskId}`;
    this.tasks.get(key);
    const now = Date.now();

    this.tasks.set(key, {
      taskId,
      dagId,
      status: 'success',
      lastRun: now,
    });

    return {
      success: true,
      taskId,
      dagId,
      restartedAt: now,
    };
  }

  /**
   * Get the current status of a task.
   */
  async getTaskStatus(dagId: string, taskId: string): Promise<TaskStatus | null> {
    const key = `${dagId}:${taskId}`;
    return this.tasks.get(key) ?? null;
  }

  /**
   * Trigger a DAG run with optional configuration.
   */
  async triggerDag(dagId: string, _conf?: Record<string, unknown>): Promise<DagRunResult> {
    const dagRunId = `run-${dagId}-${Date.now()}`;
    const now = Date.now();

    const result: DagRunResult = {
      dagRunId,
      dagId,
      state: 'queued',
      triggeredAt: now,
    };

    this.dagRuns.set(dagRunId, result);
    return result;
  }

  /**
   * Scale compute resources (e.g., warehouse size).
   */
  async scaleCompute(resourceId: string, targetSize: string): Promise<ScaleResult> {
    const previousSize = this.computeSizes.get(resourceId) ?? 'XS';
    const now = Date.now();

    this.computeSizes.set(resourceId, targetSize);

    return {
      success: true,
      resourceId,
      previousSize,
      newSize: targetSize,
      scaledAt: now,
    };
  }

  /**
   * Pre-load some DAGs and tasks for testing.
   */
  seed(): void {
    const now = Date.now();

    // Seed some DAGs with tasks
    const dags = [
      { dagId: 'etl_orders_daily', tasks: ['extract_orders', 'transform_orders', 'load_orders'] },
      { dagId: 'etl_customers_daily', tasks: ['extract_customers', 'transform_customers', 'load_customers'] },
      { dagId: 'etl_events_hourly', tasks: ['extract_events', 'transform_events', 'load_events'] },
    ];

    for (const dag of dags) {
      for (const taskId of dag.tasks) {
        this.tasks.set(`${dag.dagId}:${taskId}`, {
          taskId,
          dagId: dag.dagId,
          status: 'success',
          lastRun: now - 3600_000,
        });
      }
    }

    // Set one task as failed for testing
    this.tasks.set('etl_orders_daily:transform_orders', {
      taskId: 'transform_orders',
      dagId: 'etl_orders_daily',
      status: 'failed',
      lastRun: now - 1800_000,
    });

    // Seed compute sizes
    this.computeSizes.set('warehouse_primary', 'XS');
    this.computeSizes.set('warehouse_analytics', 'S');
  }
}
