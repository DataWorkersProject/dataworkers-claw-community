/**
 * Persona Scenarios: Data Scientist
 *
 * 12 scenarios covering data discovery, natural language queries,
 * insights generation, anomaly explanation, metric exploration, and exports.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const dataScientistScenarios: PersonaScenario[] = [
  // ── 1. Natural language query ──────────────────────────────────────────
  {
    name: 'ds-nl-query-top-customers',
    persona: 'data_scientist',
    question: 'What are the top 10 customers by revenue?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-insights',
        tool: 'query_data_nl',
        args: { question: 'What are the top 10 customers by revenue?', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['sql', 'results'],
        forbiddenEntities: ['nonexistent_revenue_summary'],
      },
      openmetadata: {
        requiredEntities: [],
        requiredFields: ['sql', 'results'],
        forbiddenEntities: ['nonexistent_revenue_summary'],
      },
    },
    actionabilityCriteria: 'Generates valid SQL and returns query results with customer ranking',
    difficulty: 'basic',
  },

  // ── 2. Generate insight from query results ─────────────────────────────
  {
    name: 'ds-generate-insight-revenue',
    persona: 'data_scientist',
    question: 'Generate insights from this revenue breakdown by region.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-insights',
        tool: 'generate_insight',
        args: {
          sql: 'SELECT region, SUM(revenue) FROM orders GROUP BY region',
          results: [
            { region: 'US', sum_revenue: 1500000 },
            { region: 'EU', sum_revenue: 850000 },
            { region: 'APAC', sum_revenue: 320000 },
          ],
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['insights'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Provides narrative insights with key findings, trends, and comparisons',
    difficulty: 'intermediate',
  },

  // ── 3. Explain an anomaly ──────────────────────────────────────────────
  {
    name: 'ds-explain-anomaly',
    persona: 'data_scientist',
    question: 'The row count for fact_orders dropped to zero. What could explain this?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-insights',
        tool: 'explain_anomaly',
        args: { metric: 'row_count', currentValue: 0, expectedValue: 50000 },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['explanation', 'possibleCauses'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Provides possible root causes ranked by likelihood with investigation steps',
    difficulty: 'intermediate',
  },

  // ── 4. Search datasets for ML features ─────────────────────────────────
  {
    name: 'ds-search-ml-features',
    persona: 'data_scientist',
    question: 'Find datasets that could be useful for a customer churn prediction model.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'customer churn', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['customers'],
        requiredFields: ['results'],
        forbiddenEntities: ['invented_churn_features_v3'],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['results'],
        forbiddenEntities: ['invented_churn_features_v3'],
      },
    },
    actionabilityCriteria: 'Returns relevant datasets with descriptions that help assess ML feature potential',
    difficulty: 'basic',
  },

  // ── 5. Get context for a dataset ───────────────────────────────────────
  {
    name: 'ds-get-context-orders',
    persona: 'data_scientist',
    question: 'Give me full context on the orders dataset -- lineage, quality, freshness.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'get_context',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['context'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['orders'],
        requiredFields: ['context'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns comprehensive context including quality score, freshness, lineage summary, and owner',
    difficulty: 'basic',
  },

  // ── 6. NL query for user engagement ────────────────────────────────────
  {
    name: 'ds-nl-query-engagement',
    persona: 'data_scientist',
    question: 'How many active users do we have per month over the last quarter?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-insights',
        tool: 'query_data_nl',
        args: { question: 'How many active users per month over the last quarter?', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['sql', 'results'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Generates a time-series query with monthly aggregation and returns structured results',
    difficulty: 'intermediate',
  },

  // ── 7. Export insight results ──────────────────────────────────────────
  {
    name: 'ds-export-results',
    persona: 'data_scientist',
    question: 'Export the revenue by region analysis as JSON.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-insights',
        tool: 'export_insight',
        args: {
          results: [
            { region: 'US', revenue: 1500000 },
            { region: 'EU', revenue: 850000 },
          ],
          format: 'json',
          filename: 'revenue-by-region',
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['exportPath', 'format'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns a downloadable export path with correct format and data',
    difficulty: 'basic',
  },

  // ── 8. Search for events data ──────────────────────────────────────────
  {
    name: 'ds-search-events',
    persona: 'data_scientist',
    question: 'Find all datasets containing user interaction events.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'user events', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['user_events'],
        requiredFields: ['results'],
        forbiddenEntities: ['phantom_event_stream'],
      },
      openmetadata: {
        requiredEntities: ['user_metrics'],
        requiredFields: ['results'],
        forbiddenEntities: ['phantom_event_stream'],
      },
    },
    actionabilityCriteria: 'Returns event-related datasets with platform, schema, and freshness info',
    difficulty: 'basic',
  },

  // ── 9. Correlate metadata ──────────────────────────────────────────────
  {
    name: 'ds-correlate-metadata',
    persona: 'data_scientist',
    question: 'Correlate metadata across platforms for the orders asset -- what do different systems say?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'correlate_metadata',
        args: { assetIdentifier: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['correlations'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Shows metadata from each connected platform with consistency analysis',
    difficulty: 'advanced',
  },

  // ── 10. Estimate query cost ────────────────────────────────────────────
  {
    name: 'ds-estimate-query-cost',
    persona: 'data_scientist',
    question: 'How much will this analytical query cost to run?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-cost',
        tool: 'estimate_query_cost',
        args: {
          sql: 'SELECT customer_id, COUNT(*) as order_count, SUM(total) as lifetime_value FROM orders GROUP BY customer_id',
          estimatedRows: 1000000,
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['estimatedCost'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns estimated cost in dollars with breakdown by compute and scan',
    difficulty: 'intermediate',
  },

  // ── 11. Identify golden path ───────────────────────────────────────────
  {
    name: 'ds-golden-path',
    persona: 'data_scientist',
    question: 'What is the golden path for revenue data? Which tables should I use?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'identify_golden_path',
        args: { domain: 'revenue', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['revenue'],
        requiredFields: ['goldenPath'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns the recommended canonical tables/models for the revenue domain',
    difficulty: 'intermediate',
  },

  // ── 12. Analyze query history ──────────────────────────────────────────
  {
    name: 'ds-analyze-query-history',
    persona: 'data_scientist',
    question: 'How is the orders table being queried? Show me query patterns.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'analyze_query_history',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['queryPatterns'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Shows common query patterns, frequency, users, and performance characteristics',
    difficulty: 'advanced',
  },
];
