/**
 * Persona Scenarios: Analytics Engineer
 *
 * 12 scenarios covering transformations, SLAs, documentation, anomalies,
 * schema compatibility, metric resolution, and dbt model management.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const analyticsEngineerScenarios: PersonaScenario[] = [
  // ── 1. Explain a table ─────────────────────────────────────────────────
  {
    name: 'ae-explain-orders-table',
    persona: 'analytics_engineer',
    question: 'Hey, the new analyst keeps asking me about fact_orders. Can you pull up what columns it has so I can point them in the right direction?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'explain_table',
        args: { tableIdentifier: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['columns', 'description'],
        forbiddenEntities: ['fact_returns'],
      },
      openmetadata: {
        requiredEntities: ['orders'],
        requiredFields: ['columns', 'description'],
        forbiddenEntities: ['fact_returns'],
      },
    },
    actionabilityCriteria: 'Returns column names, types, descriptions, and overall table purpose',
    difficulty: 'basic',
  },

  // ── 2. Set SLA on a dataset ────────────────────────────────────────────
  {
    name: 'ae-set-sla',
    persona: 'analytics_engineer',
    question: 'We had a data quality incident last week because of nulls in fact_orders. Set up an SLA so null rate never exceeds 5% again.',
    applicableSeeds: ['jaffle-shop'],
    routes: [
      {
        agent: 'dw-quality',
        tool: 'set_sla',
        args: {
          datasetId: 'fact_orders',
          customerId: CID,
          rules: [
            { metric: 'null_rate', operator: 'lte', threshold: 0.05, severity: 'critical', description: 'Null rate must not exceed 5%' },
          ],
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['sla', 'rules'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Confirms SLA creation with rule details and monitoring status',
    difficulty: 'intermediate',
  },

  // ── 3. Generate documentation ──────────────────────────────────────────
  {
    name: 'ae-generate-docs',
    persona: 'analytics_engineer',
    question: 'Auto-generate documentation for the fact_orders table.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'generate_documentation',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['documentation'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Produces a formatted documentation artifact with column descriptions and usage context',
    difficulty: 'intermediate',
  },

  // ── 4. Get anomalies ───────────────────────────────────────────────────
  {
    name: 'ae-get-anomalies',
    persona: 'analytics_engineer',
    question: 'The board meeting is tomorrow and I need to make sure our numbers are clean. Are there any anomalies I should know about?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-quality',
        tool: 'get_anomalies',
        args: { customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['anomalies'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: [],
        requiredFields: ['anomalies'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Lists detected anomalies with metric, dataset, deviation, and timestamp',
    difficulty: 'basic',
  },

  // ── 5. Validate schema compatibility ───────────────────────────────────
  {
    name: 'ae-validate-schema-compat',
    persona: 'analytics_engineer',
    question: 'Is adding a discount_pct column to fact_orders a backward-compatible change?',
    applicableSeeds: ['jaffle-shop'],
    routes: [
      {
        agent: 'dw-schema',
        tool: 'validate_schema_compatibility',
        args: {
          change: {
            type: 'add_column',
            table: 'fact_orders',
            column: 'discount_pct',
            changeType: 'column_added',
            details: { newType: 'DECIMAL(5,2)' },
          },
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['compatible', 'analysis'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns compatibility verdict with impact analysis on downstream consumers',
    difficulty: 'intermediate',
  },

  // ── 6. Resolve a metric ────────────────────────────────────────────────
  {
    name: 'ae-resolve-metric',
    persona: 'analytics_engineer',
    question: 'How is the "revenue" metric defined in our semantic layer?',
    applicableSeeds: ['jaffle-shop'],
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'resolve_metric',
        args: { metricName: 'revenue', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['revenue'],
        requiredFields: ['definition', 'formula'],
        forbiddenEntities: ['fake_metric_gross_profit'],
      },
    },
    actionabilityCriteria: 'Returns the metric definition, SQL formula, and source datasets used',
    difficulty: 'basic',
  },

  // ── 7. Get quality score ───────────────────────────────────────────────
  {
    name: 'ae-quality-score',
    persona: 'analytics_engineer',
    question: 'What is the current quality score for the orders table?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    routes: [
      {
        agent: 'dw-quality',
        tool: 'get_quality_score',
        args: { datasetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['score'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['fact_orders'],
        requiredFields: ['score'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Provides a numeric quality score with dimension breakdown (completeness, accuracy, etc.)',
    difficulty: 'basic',
  },

  // ── 8. Define a business rule ──────────────────────────────────────────
  {
    name: 'ae-define-business-rule',
    persona: 'analytics_engineer',
    question: 'Define a business rule: total_amount in fact_orders includes tax and shipping.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'define_business_rule',
        args: {
          assetId: 'fact_orders',
          ruleType: 'calculation',
          content: 'Total amount includes tax and shipping',
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['rule', 'ruleId'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Confirms rule creation with unique ID and association to the asset',
    difficulty: 'intermediate',
  },

  // ── 9. List semantic definitions ───────────────────────────────────────
  {
    name: 'ae-list-semantic-defs',
    persona: 'analytics_engineer',
    question: 'List all semantic definitions in our catalog.',
    applicableSeeds: ['jaffle-shop'],
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'list_semantic_definitions',
        args: { customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['definitions'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns a list of semantic definitions with names, types, and formulas',
    difficulty: 'basic',
  },

  // ── 10. dbt model lineage ─────────────────────────────────────────────
  {
    name: 'ae-dbt-model-lineage',
    persona: 'analytics_engineer',
    question: 'Show me the lineage for the fct_orders dbt model.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-connectors',
        tool: 'get_dbt_model_lineage',
        args: { customerId: CID, modelId: 'model.project.fct_orders' },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fct_orders', 'int_order_items'],
        requiredFields: ['edges'],
        forbiddenEntities: ['nonexistent_model'],
      },
    },
    actionabilityCriteria: 'Shows parent and child models with edge types (ref, source)',
    difficulty: 'intermediate',
  },

  // ── 11. Check staleness ────────────────────────────────────────────────
  {
    name: 'ae-check-staleness',
    persona: 'analytics_engineer',
    question: 'Is the daily_revenue model getting stale? Check its staleness status.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'check_staleness',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['staleness'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns staleness status with time since last refresh and threshold comparison',
    difficulty: 'basic',
  },

  // ── 12. Import tribal knowledge ────────────────────────────────────────
  {
    name: 'ae-import-tribal-knowledge',
    persona: 'analytics_engineer',
    question: 'Record this tribal knowledge: revenue calculation in dim_orders excludes refunded orders.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'import_tribal_knowledge',
        args: {
          entries: [{ assetId: 'fact_orders', content: 'Revenue calculation excludes refunded orders' }],
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['imported'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Confirms knowledge entries were imported and linked to the correct assets',
    difficulty: 'intermediate',
  },
];
