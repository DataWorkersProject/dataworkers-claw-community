/**
 * Persona Scenarios: Data Engineer
 *
 * 12 scenarios covering search, lineage, freshness, blast radius,
 * pipeline generation, quality checks, and schema change detection.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

// Data Engineer latency budgets:
// - Incident/urgent scenarios: 500ms
// - Interactive exploration: 1000ms
// - Batch operations: 2000ms
export const dataEngineerScenarios: PersonaScenario[] = [
  // ── 1. Search for customer tables ──────────────────────────────────────
  {
    name: 'de-search-customer-tables',
    persona: 'data_engineer',
    question: 'I just joined the data team and need to find customer information. Where do we keep customer tables?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'customers', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['customers', 'dim_customers'],
        requiredFields: ['results'],
        forbiddenEntities: ['nonexistent_customers_v2'],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['results'],
        forbiddenEntities: ['nonexistent_customers_v2'],
      },
    },
    actionabilityCriteria: 'Returns a list of matching datasets with names, platforms, and descriptions',
    difficulty: 'basic',
  },

  // ── 2. Search for revenue data ─────────────────────────────────────────
  {
    name: 'de-search-revenue-data',
    persona: 'data_engineer',
    question: 'Where can I find revenue data?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'revenue', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['daily_revenue'],
        requiredFields: ['results'],
        forbiddenEntities: ['monthly_revenue_forecast'],
      },
      openmetadata: {
        requiredEntities: ['daily_revenue'],
        requiredFields: ['results'],
        forbiddenEntities: ['monthly_revenue_forecast'],
      },
    },
    actionabilityCriteria: 'Returns datasets tagged with revenue or containing revenue columns',
    difficulty: 'basic',
  },

  // ── 3. Trace lineage for orders ────────────────────────────────────────
  {
    name: 'de-trace-orders-lineage',
    persona: 'data_engineer',
    question: 'Where does the orders table come from? Show me its upstream lineage.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'get_lineage',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders', 'raw_orders'],
        requiredFields: ['upstream', 'downstream'],
        forbiddenEntities: ['phantom_source_table'],
      },
      openmetadata: {
        requiredEntities: ['orders'],
        requiredFields: ['upstream', 'downstream'],
        forbiddenEntities: ['phantom_source_table'],
      },
    },
    actionabilityCriteria: 'Shows upstream sources and downstream consumers with relationship types',
    difficulty: 'intermediate',
  },

  // ── 4. Check freshness ─────────────────────────────────────────────────
  {
    name: 'de-check-freshness',
    persona: 'data_engineer',
    question: 'The analytics team is complaining that orders data looks stale. When was it last refreshed?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 500,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'check_freshness',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['freshnessScore', 'lastUpdated'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['orders'],
        requiredFields: ['freshnessScore', 'lastUpdated'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Provides a freshness score and last-updated timestamp to decide if data is stale',
    difficulty: 'basic',
  },

  // ── 5. Blast radius analysis ───────────────────────────────────────────
  {
    name: 'de-blast-radius',
    persona: 'data_engineer',
    question: 'If the raw_orders source goes down, what downstream assets are affected?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'blast_radius_analysis',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['impactedAssets'],
        forbiddenEntities: ['unrelated_marketing_table'],
        minResultCount: 1,
      },
    },
    actionabilityCriteria: 'Lists all downstream consumers that would be impacted with severity assessment',
    difficulty: 'intermediate',
  },

  // ── 6. Generate a pipeline ─────────────────────────────────────────────
  {
    name: 'de-generate-pipeline',
    persona: 'data_engineer',
    question: 'Generate a pipeline to extract daily orders from Snowflake, transform with dbt, and load to BigQuery.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-pipelines',
        tool: 'generate_pipeline',
        args: { description: 'Extract daily orders from Snowflake, transform with dbt, load to BigQuery', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['pipeline', 'steps'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Produces a pipeline spec with extract, transform, and load steps that can be validated',
    difficulty: 'intermediate',
  },

  // ── 7. Run quality check ───────────────────────────────────────────────
  {
    name: 'de-run-quality-check',
    persona: 'data_engineer',
    question: 'Run data quality checks on the orders table.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-quality',
        tool: 'run_quality_check',
        args: { datasetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['checks', 'status'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['fact_orders'],
        requiredFields: ['checks', 'status'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns list of quality checks with pass/fail status and specific metric values',
    difficulty: 'basic',
  },

  // ── 8. Detect schema changes ───────────────────────────────────────────
  {
    name: 'de-detect-schema-changes',
    persona: 'data_engineer',
    question: 'Have there been any schema changes in the Snowflake analytics database recently?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-schema',
        tool: 'detect_schema_change',
        args: { source: 'snowflake', customerId: CID, database: 'analytics', schema: 'public' },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['changes'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Lists detected schema changes with type, table, column, and timestamp',
    difficulty: 'intermediate',
  },

  // ── 9. Validate a pipeline spec ────────────────────────────────────────
  {
    name: 'de-validate-pipeline',
    persona: 'data_engineer',
    question: 'Validate this pipeline configuration before I deploy it.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-pipelines',
        tool: 'validate_pipeline',
        args: {
          pipelineSpec: {
            name: 'orders-daily-etl',
            steps: [
              { name: 'extract', type: 'extract', config: { source: 'snowflake', table: 'orders' } },
              { name: 'transform', type: 'transform', config: { model: 'stg_orders' } },
            ],
          },
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['valid', 'errors'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns validation result with pass/fail and list of any configuration errors',
    difficulty: 'basic',
  },

  // ── 10. Monitor streaming lag ──────────────────────────────────────────
  {
    name: 'de-monitor-stream-lag',
    persona: 'data_engineer',
    question: 'What is the current consumer lag on the orders Kafka topic?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 500,
    routes: [
      {
        agent: 'dw-streaming',
        tool: 'monitor_lag',
        args: { topic: 'orders' },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['orders'],
        requiredFields: ['lag'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Shows consumer group lag metrics with partition-level detail',
    difficulty: 'intermediate',
  },

  // ── 11. Cross-platform search ──────────────────────────────────────────
  {
    name: 'de-cross-platform-search',
    persona: 'data_engineer',
    question: 'Search for order-related tables across all our connected platforms.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_across_platforms',
        args: { query: 'orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['orders'],
        requiredFields: ['results'],
        forbiddenEntities: ['invented_orders_archive'],
      },
      openmetadata: {
        requiredEntities: ['orders'],
        requiredFields: ['results'],
        forbiddenEntities: ['invented_orders_archive'],
      },
    },
    actionabilityCriteria: 'Returns results from multiple platforms (Snowflake, dbt, BigQuery) with platform labels',
    difficulty: 'intermediate',
  },

  // ── 12. Diagnose an incident ───────────────────────────────────────────
  {
    name: 'de-diagnose-incident',
    persona: 'data_engineer',
    question: 'URGENT: The CEO dashboard is showing zero orders since midnight. Something broke in the pipeline -- diagnose this NOW.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 500,
    routes: [
      {
        agent: 'dw-incidents',
        tool: 'diagnose_incident',
        args: {
          anomalySignals: [
            {
              metric: 'row_count',
              value: 0,
              expected: 50000,
              deviation: -1.0,
              source: 'fact_orders',
              timestamp: Date.now(),
            },
          ],
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['diagnosis', 'severity'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Provides root cause hypothesis, severity level, and suggested remediation steps',
    difficulty: 'advanced',
  },
];
