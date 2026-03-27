/**
 * Classification evaluation scenarios.
 */
import type { EvalScenario } from '../llm-eval-framework.js';

export const classificationScenarios: EvalScenario[] = [
  {
    name: 'classify cost anomaly',
    category: 'classification',
    input: 'classify this alert: warehouse compute cost increased by 300% in the last hour',
    expectedOutput: /help|data|pipeline|cost/i,
    agent: 'dw-cost',
    difficulty: 'easy',
  },
  {
    name: 'classify schema change',
    category: 'classification',
    input: 'classify this event: column customer_email was removed from the customers table',
    expectedOutput: /help|data|pipeline|schema/i,
    agent: 'dw-schema',
    difficulty: 'easy',
  },
  {
    name: 'classify data quality issue',
    category: 'classification',
    input: 'classify: duplicate rate in orders table increased from 0.1% to 15%',
    expectedOutput: /help|data|pipeline|quality/i,
    agent: 'dw-quality',
    difficulty: 'medium',
  },
];
