/**
 * Stubbed dbt Cloud API client.
 * Uses in-memory data to simulate the dbt Cloud API.
 */

import type {
  DbtModel,
  DbtTestResult,
  DbtRunHistory,
  DbtLineageEdge,
} from './types.js';

export class DbtCloudStubClient {
  private models: Map<string, DbtModel> = new Map();
  private runHistory: DbtRunHistory[] = [];
  private testResults: Map<string, DbtTestResult[]> = new Map();
  private seeded = false;

  /** Pre-load with realistic dbt project data. */
  seed(): void {
    if (this.seeded) return;

    // --- Models ---

    const stgOrders: DbtModel = {
      uniqueId: 'model.project.stg_orders',
      name: 'stg_orders',
      schema: 'staging',
      database: 'analytics',
      materialization: 'view',
      description: 'Staged orders from raw source',
      columns: [
        { name: 'order_id', description: 'Primary key', type: 'integer', tests: ['unique', 'not_null'] },
        { name: 'customer_id', description: 'FK to customers', type: 'integer', tests: ['not_null'] },
        { name: 'order_date', description: 'Date of order', type: 'date', tests: [] },
        { name: 'status', description: 'Order status', type: 'varchar', tests: ['accepted_values'] },
      ],
      dependsOn: [],
      tags: ['staging', 'daily'],
    };

    const stgCustomers: DbtModel = {
      uniqueId: 'model.project.stg_customers',
      name: 'stg_customers',
      schema: 'staging',
      database: 'analytics',
      materialization: 'view',
      description: 'Staged customers from raw source',
      columns: [
        { name: 'customer_id', description: 'Primary key', type: 'integer', tests: ['unique', 'not_null'] },
        { name: 'name', description: 'Customer full name', type: 'varchar', tests: ['not_null'] },
        { name: 'email', description: 'Customer email', type: 'varchar', tests: ['unique'] },
      ],
      dependsOn: [],
      tags: ['staging', 'daily'],
    };

    const intOrderItems: DbtModel = {
      uniqueId: 'model.project.int_order_items',
      name: 'int_order_items',
      schema: 'intermediate',
      database: 'analytics',
      materialization: 'ephemeral',
      description: 'Intermediate order items with enrichment',
      columns: [
        { name: 'order_id', description: 'FK to orders', type: 'integer', tests: ['not_null'] },
        { name: 'item_total', description: 'Line item total', type: 'numeric', tests: [] },
      ],
      dependsOn: ['model.project.stg_orders'],
      tags: ['intermediate'],
    };

    const fctOrders: DbtModel = {
      uniqueId: 'model.project.fct_orders',
      name: 'fct_orders',
      schema: 'marts',
      database: 'analytics',
      materialization: 'table',
      description: 'Fact table for completed orders',
      columns: [
        { name: 'order_id', description: 'Primary key', type: 'integer', tests: ['unique', 'not_null'] },
        { name: 'customer_id', description: 'FK to dim_customers', type: 'integer', tests: ['not_null', 'relationships'] },
        { name: 'order_total', description: 'Total order amount', type: 'numeric', tests: [] },
        { name: 'order_date', description: 'Date of order', type: 'date', tests: [] },
      ],
      dependsOn: ['model.project.int_order_items'],
      tags: ['marts', 'finance'],
    };

    const dimCustomers: DbtModel = {
      uniqueId: 'model.project.dim_customers',
      name: 'dim_customers',
      schema: 'marts',
      database: 'analytics',
      materialization: 'incremental',
      description: 'Customer dimension with lifetime metrics',
      columns: [
        { name: 'customer_id', description: 'Primary key', type: 'integer', tests: ['unique', 'not_null'] },
        { name: 'name', description: 'Customer name', type: 'varchar', tests: ['not_null'] },
        { name: 'total_orders', description: 'Lifetime order count', type: 'integer', tests: [] },
        { name: 'first_order_date', description: 'Date of first order', type: 'date', tests: [] },
      ],
      dependsOn: ['model.project.stg_customers'],
      tags: ['marts', 'marketing'],
    };

    this.models.set(stgOrders.uniqueId, stgOrders);
    this.models.set(stgCustomers.uniqueId, stgCustomers);
    this.models.set(intOrderItems.uniqueId, intOrderItems);
    this.models.set(fctOrders.uniqueId, fctOrders);
    this.models.set(dimCustomers.uniqueId, dimCustomers);

    // --- Run history (3 entries) ---

    this.runHistory = [
      {
        runId: 'run_001',
        status: 'success',
        startedAt: '2026-03-20T08:00:00Z',
        finishedAt: '2026-03-20T08:05:30Z',
        durationMs: 330_000,
        modelCount: 5,
      },
      {
        runId: 'run_002',
        status: 'error',
        startedAt: '2026-03-21T08:00:00Z',
        finishedAt: '2026-03-21T08:02:15Z',
        durationMs: 135_000,
        modelCount: 3,
      },
      {
        runId: 'run_003',
        status: 'success',
        startedAt: '2026-03-22T08:00:00Z',
        finishedAt: '2026-03-22T08:04:45Z',
        durationMs: 285_000,
        modelCount: 5,
      },
    ];

    // --- Test results (8 results) ---

    const allTestResults: DbtTestResult[] = [
      { testId: 'test_001', testName: 'unique_stg_orders_order_id', status: 'pass', executionTimeMs: 120 },
      { testId: 'test_002', testName: 'not_null_stg_orders_order_id', status: 'pass', executionTimeMs: 95 },
      { testId: 'test_003', testName: 'not_null_stg_orders_customer_id', status: 'pass', executionTimeMs: 88 },
      { testId: 'test_004', testName: 'accepted_values_stg_orders_status', status: 'fail', executionTimeMs: 150, failureMessage: 'Unexpected value: refunded' },
      { testId: 'test_005', testName: 'unique_fct_orders_order_id', status: 'pass', executionTimeMs: 200 },
      { testId: 'test_006', testName: 'relationships_fct_orders_customer_id', status: 'warn', executionTimeMs: 310, failureMessage: '2 orphaned records found' },
      { testId: 'test_007', testName: 'unique_dim_customers_customer_id', status: 'pass', executionTimeMs: 105 },
      { testId: 'test_008', testName: 'not_null_dim_customers_name', status: 'error', executionTimeMs: 50, failureMessage: 'Query execution timeout' },
    ];

    // Associate all test results with latest run, also store as default
    this.testResults.set('run_003', allTestResults);
    this.testResults.set('__all__', allTestResults);

    this.seeded = true;
  }

  /** List all models. */
  listModels(): DbtModel[] {
    return Array.from(this.models.values());
  }

  /** Get a specific model by uniqueId. */
  getModel(uniqueId: string): DbtModel {
    const model = this.models.get(uniqueId);
    if (!model) {
      throw new Error(`Model not found: ${uniqueId}`);
    }
    return model;
  }

  /** Get lineage edges for a model (traces dependsOn). */
  getModelLineage(uniqueId: string): DbtLineageEdge[] {
    const model = this.models.get(uniqueId);
    if (!model) {
      throw new Error(`Model not found: ${uniqueId}`);
    }

    const edges: DbtLineageEdge[] = [];

    // Direct parents (dependsOn)
    for (const parentId of model.dependsOn) {
      edges.push({
        parent: parentId,
        child: uniqueId,
        relationship: parentId.startsWith('source.') ? 'source' : 'ref',
      });
    }

    // Direct children (models that depend on this one)
    for (const [childId, childModel] of this.models.entries()) {
      if (childModel.dependsOn.includes(uniqueId)) {
        edges.push({
          parent: uniqueId,
          child: childId,
          relationship: 'ref',
        });
      }
    }

    return edges;
  }

  /** Get test results, optionally filtered by runId. */
  getTestResults(runId?: string): DbtTestResult[] {
    if (runId) {
      const results = this.testResults.get(runId);
      if (!results) {
        throw new Error(`Run not found: ${runId}`);
      }
      return results;
    }
    return this.testResults.get('__all__') ?? [];
  }

  /** Get run history, optionally limited. */
  getRunHistory(limit?: number): DbtRunHistory[] {
    const history = [...this.runHistory].reverse(); // newest first
    if (limit !== undefined && limit > 0) {
      return history.slice(0, limit);
    }
    return history;
  }
}
