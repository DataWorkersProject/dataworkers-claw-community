/**
 * Root Cause Analysis evaluation scenarios.
 */
import type { EvalScenario } from '../llm-eval-framework.js';

export const rcaScenarios: EvalScenario[] = [
  {
    name: 'data freshness SLA breach',
    category: 'rca',
    input: 'diagnose: orders table has not been updated in 6 hours, SLA is 2 hours',
    expectedOutput: /help|pipeline|freshness|data/i,
    agent: 'dw-incidents',
    difficulty: 'easy',
  },
  {
    name: 'null spike anomaly',
    category: 'rca',
    input: 'diagnose: null rate in customer_email column jumped from 2% to 45%',
    expectedOutput: /help|data|pipeline/i,
    agent: 'dw-incidents',
    difficulty: 'medium',
  },
  {
    name: 'pipeline timeout failure',
    category: 'rca',
    input: 'diagnose: ETL pipeline etl_orders_daily timed out after 3 hours, normally completes in 30 minutes',
    expectedOutput: /help|pipeline|data/i,
    agent: 'dw-incidents',
    difficulty: 'medium',
  },
];
