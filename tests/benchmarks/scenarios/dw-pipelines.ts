/**
 * Benchmark Scenarios — dw-pipelines
 *
 * 5 scenarios covering pipeline generation, validation, deployment,
 * and template listing.
 */

import type { BenchmarkScenario } from '../types.js';
import { nonEmptyCheck, typeCheck } from '../framework.js';

const CID = 'test-customer-1';

export const pipelinesScenarios: BenchmarkScenario[] = [
  // ── 1. List pipeline templates ──────────────────────────────────────────
  {
    name: 'pipelines-list-templates',
    description: 'List all available pipeline templates',
    agent: 'dw-pipelines',
    tool: 'list_pipeline_templates',
    input: {},
    expectedFields: [],
    expectedPatterns: [/id/, /name/],
    qualityChecks: [],
    category: 'search',
    difficulty: 'basic',
  },

  // ── 2. Generate a pipeline ─────────────────────────────────────────────
  {
    name: 'pipelines-generate-basic',
    description: 'Generate a pipeline from a natural-language description',
    agent: 'dw-pipelines',
    tool: 'generate_pipeline',
    input: {
      description: 'Extract daily sales from Snowflake, transform with dbt, load to BigQuery',
      customerId: CID,
    },
    expectedFields: ['name', 'steps'],
    qualityChecks: [
      { name: 'has-name-and-steps', fn: nonEmptyCheck(['name', 'steps']) },
      { name: 'steps-is-array', fn: typeCheck({ steps: 'array' }) },
    ],
    category: 'generation',
    difficulty: 'intermediate',
  },

  // ── 3. Validate a pipeline ────────────────────────────────────────────
  {
    name: 'pipelines-validate',
    description: 'Validate a pipeline specification for correctness',
    agent: 'dw-pipelines',
    tool: 'validate_pipeline',
    input: {
      pipelineSpec: {
        name: 'test-pipeline',
        steps: [{ name: 'extract', type: 'extract', config: {} }],
      },
      customerId: CID,
    },
    expectedFields: ['valid'],
    qualityChecks: [
      { name: 'valid-is-boolean', fn: typeCheck({ valid: 'boolean' }) },
    ],
    category: 'analysis',
    difficulty: 'basic',
  },

  // ── 4. Deploy a pipeline ──────────────────────────────────────────────
  {
    name: 'pipelines-deploy',
    description: 'Deploy a pipeline to staging environment',
    agent: 'dw-pipelines',
    tool: 'deploy_pipeline',
    input: {
      pipelineSpec: {
        name: 'test-pipeline',
        steps: [{ name: 'extract', type: 'extract', config: {} }],
      },
      customerId: CID,
      environment: 'staging',
    },
    expectedFields: ['deploymentId', 'status'],
    qualityChecks: [
      { name: 'deployment-id-present', fn: nonEmptyCheck(['deploymentId']) },
    ],
    category: 'mutation',
    difficulty: 'intermediate',
  },

  // ── 5. Generate complex pipeline ──────────────────────────────────────
  {
    name: 'pipelines-generate-complex',
    description: 'Generate a complex multi-source ETL pipeline',
    agent: 'dw-pipelines',
    tool: 'generate_pipeline',
    input: {
      description: 'Merge data from PostgreSQL and S3, deduplicate, apply SCD Type 2, load to Snowflake with audit trail',
      customerId: CID,
    },
    expectedFields: ['name', 'steps'],
    qualityChecks: [
      { name: 'has-steps', fn: typeCheck({ steps: 'array' }) },
    ],
    category: 'generation',
    difficulty: 'advanced',
  },
];
