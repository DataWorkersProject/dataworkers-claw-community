/**
 * Eval Framework — Swarm Scenario: Data Discovery
 *
 * Simulates a data discovery workflow: search for customer order data,
 * explain the table, generate insights, and auto-generate documentation.
 *
 * Flow:
 * 1. search_across_platforms -> find customer orders data
 * 2. explain_table -> understand the orders table
 * 3. generate_insight -> discover patterns in the data
 * 4. generate_documentation -> create documentation for the asset
 */

import type { SwarmScenario } from './types.js';
import { runSwarmScenario } from './onboarding.js';

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

export const dataDiscoveryScenario: SwarmScenario = {
  name: 'data-discovery',
  description: 'Search for data, explain tables, generate insights, and create documentation',
  steps: [
    {
      id: 'search-data',
      agent: 'dw-context-catalog',
      tool: 'search_across_platforms',
      inputTemplate: {
        query: 'customer orders',
        customerId: 'test-customer-1',
      },
      extractFields: {
        tableName: 'results[0].name',
        tableId: 'results[0].id',
        assetId: 'results[0].assetId',
      },
      expectedFields: ['results'],
    },
    {
      id: 'explain-table',
      agent: 'dw-context-catalog',
      tool: 'explain_table',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      dynamicInputs: {
        tableIdentifier: { fromStep: 'search-data', field: 'tableName', fallback: 'orders' },
      },
      extractFields: {
        description: 'description',
        columns: 'columns',
        rowCount: 'rowCount',
      },
      expectedFields: ['description'],
    },
    {
      id: 'generate-insight',
      agent: 'dw-insights',
      tool: 'generate_insight',
      inputTemplate: {
        sql: 'SELECT * FROM orders LIMIT 100',
        results: [
          { customer_id: 'C001', order_total: 250.00, order_date: '2025-01-15' },
          { customer_id: 'C002', order_total: 1200.00, order_date: '2025-01-16' },
          { customer_id: 'C001', order_total: 75.00, order_date: '2025-01-17' },
        ],
      },
      extractFields: {
        insight: 'insight',
        patterns: 'patterns',
        recommendations: 'recommendations',
      },
      expectedFields: ['insight'],
    },
    {
      id: 'generate-docs',
      agent: 'dw-context-catalog',
      tool: 'generate_documentation',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      dynamicInputs: {
        assetId: { fromStep: 'search-data', field: 'assetId', fallback: 'fact_orders' },
      },
      extractFields: {
        documentation: 'documentation',
        format: 'format',
      },
      expectedFields: ['documentation'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function runDataDiscoveryScenario(
  servers: Record<string, { callTool: (name: string, args: Record<string, unknown>) => Promise<any> }>,
) {
  return runSwarmScenario(dataDiscoveryScenario, servers);
}
