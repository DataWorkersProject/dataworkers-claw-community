/**
 * Eval Framework — Swarm Scenario: Cost Optimization
 *
 * Simulates a cost optimization workflow: review cost dashboard,
 * find unused data, analyze tool usage, estimate savings, and
 * recommend archival candidates.
 *
 * Flow:
 * 1. get_cost_dashboard -> overview of current costs
 * 2. find_unused_data -> identify tables not being queried
 * 3. get_tool_usage_metrics -> understand agent/tool utilization
 * 4. estimate_savings -> quantify potential savings
 * 5. recommend_archival -> generate archival plan
 */

import type { SwarmScenario } from './types.js';
import { runSwarmScenario } from './onboarding.js';

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

export const costOptimizationScenario: SwarmScenario = {
  name: 'cost-optimization',
  description: 'Review costs, find unused data, analyze usage, estimate savings, and recommend archival',
  steps: [
    {
      id: 'cost-dashboard',
      agent: 'dw-cost',
      tool: 'get_cost_dashboard',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      extractFields: {
        totalCost: 'totalCost',
        breakdown: 'breakdown',
        topCostDrivers: 'topCostDrivers',
      },
      expectedFields: ['totalCost'],
    },
    {
      id: 'unused-data',
      agent: 'dw-cost',
      tool: 'find_unused_data',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      extractFields: {
        unusedTables: 'unusedTables',
        totalStorageCost: 'totalStorageCost',
        unusedCount: 'count',
      },
      expectedFields: ['unusedTables'],
    },
    {
      id: 'usage-metrics',
      agent: 'dw-usage-intelligence',
      tool: 'get_tool_usage_metrics',
      inputTemplate: {},
      extractFields: {
        metrics: 'metrics',
        totalCalls: 'totalCalls',
        activeTools: 'activeTools',
      },
      expectedFields: ['metrics'],
    },
    {
      id: 'savings-estimate',
      agent: 'dw-cost',
      tool: 'estimate_savings',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      extractFields: {
        estimatedSavings: 'estimatedSavings',
        recommendations: 'recommendations',
      },
      expectedFields: ['estimatedSavings'],
    },
    {
      id: 'archival-plan',
      agent: 'dw-cost',
      tool: 'recommend_archival',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      extractFields: {
        candidates: 'candidates',
        totalSavings: 'totalSavings',
      },
      expectedFields: ['candidates'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function runCostOptimizationScenario(
  servers: Record<string, { callTool: (name: string, args: Record<string, unknown>) => Promise<any> }>,
) {
  return runSwarmScenario(costOptimizationScenario, servers);
}
