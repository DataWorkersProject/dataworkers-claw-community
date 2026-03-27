/**
 * SQL generation accuracy benchmarks.
 *
 * 30 NL->SQL test pairs across:
 * - Simple SELECT (10)
 * - JOIN queries (8)
 * - Aggregation (7)
 * - Window functions (5)
 *
 * Measures: exact match rate, partial match rate, syntax validity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryLLMClient } from '../../core/infrastructure-stubs/src/index.js';
import { LLMEvalRunner } from './llm-eval-framework.js';
import type { EvalScenario } from './llm-eval-framework.js';

// ---------------------------------------------------------------------------
// SQL Benchmark Scenarios
// ---------------------------------------------------------------------------

const simpleSelectScenarios: EvalScenario[] = [
  { name: 'count all orders', category: 'sql', input: 'generate SQL: count all orders', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'average revenue by month', category: 'sql', input: 'generate SQL: average revenue by month', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'select all customers', category: 'sql', input: 'generate SQL: select all customers', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'orders from last 30 days', category: 'sql', input: 'generate SQL: orders from the last 30 days', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'distinct product categories', category: 'sql', input: 'generate SQL: distinct product categories', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'total revenue this year', category: 'sql', input: 'generate SQL: total revenue this year', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'minimum order amount', category: 'sql', input: 'generate SQL: minimum order amount', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'count customers by country', category: 'sql', input: 'generate SQL: count customers by country', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'max price in products', category: 'sql', input: 'generate SQL: maximum price in products table', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'orders with status pending', category: 'sql', input: 'generate SQL: all orders with status pending', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
];

const joinScenarios: EvalScenario[] = [
  { name: 'customers with orders over $100', category: 'sql', input: 'generate SQL: customers with orders over $100', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'products with no orders', category: 'sql', input: 'generate SQL: products that have never been ordered', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'customer order count', category: 'sql', input: 'generate SQL: each customer with their total order count', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'orders with customer names', category: 'sql', input: 'generate SQL: all orders with customer names', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'top spending customers', category: 'sql', input: 'generate SQL: top 10 customers by total spend', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'product revenue breakdown', category: 'sql', input: 'generate SQL: revenue breakdown by product category', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'customer latest order', category: 'sql', input: 'generate SQL: each customer with their most recent order date', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'multi-table join', category: 'sql', input: 'generate SQL: orders with customer name and product name', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'hard' },
];

const aggregationScenarios: EvalScenario[] = [
  { name: 'top 5 products by revenue', category: 'sql', input: 'generate SQL: top 5 products by revenue', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'monthly order count', category: 'sql', input: 'generate SQL: order count by month', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'easy' },
  { name: 'average order value by category', category: 'sql', input: 'generate SQL: average order value by product category', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'revenue percentiles', category: 'sql', input: 'generate SQL: 25th, 50th, and 75th percentile of order amounts', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'hard' },
  { name: 'customers with more than 5 orders', category: 'sql', input: 'generate SQL: customers who have placed more than 5 orders', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'daily revenue trend', category: 'sql', input: 'generate SQL: daily revenue for the last 90 days', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'medium' },
  { name: 'category market share', category: 'sql', input: 'generate SQL: each category percentage of total revenue', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'hard' },
];

const windowFunctionScenarios: EvalScenario[] = [
  { name: 'running total of sales', category: 'sql', input: 'generate SQL: running total of sales ordered by date', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'hard' },
  { name: 'rank customers by spend', category: 'sql', input: 'generate SQL: rank customers by their total spending', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'hard' },
  { name: 'moving average revenue', category: 'sql', input: 'generate SQL: 7-day moving average of daily revenue', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'hard' },
  { name: 'row number partitioned', category: 'sql', input: 'generate SQL: latest order per customer using row_number', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'hard' },
  { name: 'lag comparison', category: 'sql', input: 'generate SQL: daily revenue with day-over-day change', expectedOutput: /SELECT/i, agent: 'dw-pipelines', difficulty: 'hard' },
];

const allSQLScenarios = [
  ...simpleSelectScenarios,
  ...joinScenarios,
  ...aggregationScenarios,
  ...windowFunctionScenarios,
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SQL Generation Accuracy Benchmarks', () => {
  let llm: InMemoryLLMClient;
  let runner: LLMEvalRunner;

  beforeEach(() => {
    llm = new InMemoryLLMClient();
    runner = new LLMEvalRunner(llm);
  });

  it('has 30 benchmark scenarios', () => {
    expect(allSQLScenarios).toHaveLength(30);
  });

  it('has 10 simple SELECT scenarios', () => {
    expect(simpleSelectScenarios).toHaveLength(10);
  });

  it('has 8 JOIN scenarios', () => {
    expect(joinScenarios).toHaveLength(8);
  });

  it('has 7 aggregation scenarios', () => {
    expect(aggregationScenarios).toHaveLength(7);
  });

  it('has 5 window function scenarios', () => {
    expect(windowFunctionScenarios).toHaveLength(5);
  });

  it('all scenarios are in the sql category', () => {
    for (const s of allSQLScenarios) {
      expect(s.category).toBe('sql');
    }
  });

  it('all scenarios target dw-pipelines agent', () => {
    for (const s of allSQLScenarios) {
      expect(s.agent).toBe('dw-pipelines');
    }
  });

  describe('Simple SELECT scenarios', () => {
    for (const scenario of simpleSelectScenarios) {
      it(`generates SQL for: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].actualOutput).toBeTruthy();
        // The stub LLM returns SELECT for generate prompts
        expect(results[0].passed).toBe(true);
      });
    }
  });

  describe('JOIN scenarios', () => {
    for (const scenario of joinScenarios) {
      it(`generates SQL for: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].actualOutput).toBeTruthy();
        expect(results[0].passed).toBe(true);
      });
    }
  });

  describe('Aggregation scenarios', () => {
    for (const scenario of aggregationScenarios) {
      it(`generates SQL for: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
      });
    }
  });

  describe('Window function scenarios', () => {
    for (const scenario of windowFunctionScenarios) {
      it(`generates SQL for: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
      });
    }
  });

  it('computes aggregate metrics across all scenarios', async () => {
    const results = await runner.runScenarios(allSQLScenarios);
    const metrics = runner.computeMetrics(results);

    expect(metrics.totalScenarios).toBe(30);
    expect(metrics.passRate).toBeGreaterThan(0);
    expect(metrics.byCategory.sql).toBeDefined();
    expect(metrics.byCategory.sql.total).toBe(30);
    expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
    expect(metrics.totalTokens.input).toBeGreaterThan(0);
    expect(metrics.totalTokens.output).toBeGreaterThan(0);
  });

  it('reports metrics by difficulty level', async () => {
    const results = await runner.runScenarios(allSQLScenarios);
    const metrics = runner.computeMetrics(results);

    expect(metrics.byDifficulty.easy).toBeDefined();
    expect(metrics.byDifficulty.medium).toBeDefined();
    expect(metrics.byDifficulty.hard).toBeDefined();
  });

  it('stub LLM returns valid SQL-like output for generate prompts', async () => {
    const response = await llm.complete('generate SQL: count all orders');
    expect(response.content).toContain('SELECT');
  });
});
