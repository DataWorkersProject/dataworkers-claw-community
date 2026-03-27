/**
 * Benchmark Scenarios — dw-quality
 *
 * 5 scenarios covering quality checks, scoring, SLA management, and anomaly detection.
 */

import type { BenchmarkScenario } from '../types.js';
import { nonEmptyCheck, typeCheck, rangeCheck } from '../framework.js';

const CID = 'test-customer-1';

export const qualityScenarios: BenchmarkScenario[] = [
  // ── 1. Run quality check ───────────────────────────────────────────────
  {
    name: 'quality-run-check',
    description: 'Run quality checks against a dataset',
    agent: 'dw-quality',
    tool: 'run_quality_check',
    input: { datasetId: 'fact_orders', customerId: CID },
    expectedFields: ['datasetId'],
    qualityChecks: [
      { name: 'dataset-id-present', fn: nonEmptyCheck(['datasetId']) },
    ],
    category: 'analysis',
    difficulty: 'basic',
  },

  // ── 2. Get quality score ──────────────────────────────────────────────
  {
    name: 'quality-get-score',
    description: 'Retrieve the quality score for a dataset',
    agent: 'dw-quality',
    tool: 'get_quality_score',
    input: { datasetId: 'fact_orders', customerId: CID },
    expectedFields: ['datasetId'],
    qualityChecks: [],
    category: 'analysis',
    difficulty: 'basic',
  },

  // ── 3. Get anomalies ──────────────────────────────────────────────────
  {
    name: 'quality-get-anomalies',
    description: 'List detected data quality anomalies',
    agent: 'dw-quality',
    tool: 'get_anomalies',
    input: { customerId: CID },
    expectedFields: [],
    expectedPatterns: [],
    category: 'monitoring',
    difficulty: 'basic',
  },

  // ── 4. Set SLA ────────────────────────────────────────────────────────
  {
    name: 'quality-set-sla',
    description: 'Create an SLA definition with quality rules',
    agent: 'dw-quality',
    tool: 'set_sla',
    input: {
      datasetId: 'fact_orders',
      customerId: CID,
      rules: [
        {
          metric: 'null_rate',
          operator: 'lte',
          threshold: 0.05,
          severity: 'critical',
          description: 'Null rate must not exceed 5%',
        },
      ],
    },
    expectedFields: ['created', 'sla', 'sla.id', 'sla.datasetId'],
    qualityChecks: [
      { name: 'created-is-true', fn: typeCheck({ created: 'boolean' }) },
      { name: 'sla-has-id', fn: nonEmptyCheck(['sla.id']) },
    ],
    category: 'mutation',
    difficulty: 'intermediate',
  },

  // ── 5. Set SLA with multiple rules ────────────────────────────────────
  {
    name: 'quality-set-sla-multi-rule',
    description: 'Create an SLA with multiple quality rules',
    agent: 'dw-quality',
    tool: 'set_sla',
    input: {
      datasetId: 'dim_customers',
      customerId: CID,
      rules: [
        {
          metric: 'null_rate',
          operator: 'lte',
          threshold: 0.01,
          severity: 'critical',
          description: 'Null rate must not exceed 1%',
        },
        {
          metric: 'uniqueness',
          operator: 'gte',
          threshold: 0.99,
          severity: 'warning',
          description: 'Uniqueness must be at least 99%',
        },
      ],
    },
    expectedFields: ['created', 'sla', 'sla.id', 'sla.datasetId', 'sla.rules'],
    qualityChecks: [
      { name: 'sla-rules-is-array', fn: typeCheck({ 'sla.rules': 'array' }) },
    ],
    category: 'mutation',
    difficulty: 'advanced',
  },
];
