/**
 * SQL generation evaluation scenarios.
 */
import type { EvalScenario } from '../llm-eval-framework.js';

export const sqlScenarios: EvalScenario[] = [
  {
    name: 'simple count query',
    category: 'sql',
    input: 'generate SQL: count all orders',
    expectedOutput: /SELECT/i,
    agent: 'dw-pipelines',
    difficulty: 'easy',
  },
  {
    name: 'average revenue query',
    category: 'sql',
    input: 'generate SQL: average revenue by month',
    expectedOutput: /SELECT/i,
    agent: 'dw-pipelines',
    difficulty: 'medium',
  },
  {
    name: 'join query',
    category: 'sql',
    input: 'generate SQL: customers with orders over $100',
    expectedOutput: /SELECT/i,
    agent: 'dw-pipelines',
    difficulty: 'medium',
  },
];
