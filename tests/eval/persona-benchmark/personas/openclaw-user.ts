/**
 * Persona Scenarios: OpenClaw Community User
 *
 * 10 scenarios covering free-tier, read-only tools available via
 * `npx data-context-mcp`. This persona represents an OSS user
 * exploring the platform -- no write operations, no enterprise features.
 *
 * Focuses on: search, context, lineage, freshness, quality scores,
 * documentation, metric resolution, and cross-platform discovery.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const openclawUserScenarios: PersonaScenario[] = [
  // -- 1. Basic search --
  {
    name: 'ocu-search-tables',
    persona: 'openclaw_user',
    question: 'I just installed data-context-mcp. Can I search for tables about orders?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['orders'],
        requiredFields: ['results'],
        forbiddenEntities: ['nonexistent_orders_v3'],
      },
      openmetadata: {
        requiredEntities: ['orders'],
        requiredFields: ['results'],
        forbiddenEntities: ['nonexistent_orders_v3'],
      },
    },
    actionabilityCriteria: 'Returns a list of matching datasets with names and descriptions',
    difficulty: 'basic',
  },

  // -- 2. Explain a table --
  {
    name: 'ocu-explain-table',
    persona: 'openclaw_user',
    question: 'What is the customers table? Show me its columns.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'explain_table',
        args: { tableIdentifier: 'customers', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['customers'],
        requiredFields: ['columns', 'description'],
        forbiddenEntities: ['phantom_customers_extended'],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['columns', 'description'],
        forbiddenEntities: ['phantom_customers_extended'],
      },
    },
    actionabilityCriteria: 'Returns column names, types, and table description',
    difficulty: 'basic',
  },

  // -- 3. Get lineage --
  {
    name: 'ocu-view-lineage',
    persona: 'openclaw_user',
    question: 'Show me where the orders data comes from.',
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
        requiredEntities: ['fact_orders'],
        requiredFields: ['upstream', 'downstream'],
        forbiddenEntities: ['phantom_source'],
      },
      openmetadata: {
        requiredEntities: ['orders'],
        requiredFields: ['upstream', 'downstream'],
        forbiddenEntities: ['phantom_source'],
      },
    },
    actionabilityCriteria: 'Shows upstream sources and downstream consumers',
    difficulty: 'basic',
  },

  // -- 4. Check freshness --
  {
    name: 'ocu-check-freshness',
    persona: 'openclaw_user',
    question: 'How fresh is the orders data? When was it last updated?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
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
    actionabilityCriteria: 'Returns a freshness score and last-updated timestamp',
    difficulty: 'basic',
  },

  // -- 5. Get context --
  {
    name: 'ocu-get-context',
    persona: 'openclaw_user',
    question: 'Give me the full context on the customers dataset.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'get_context',
        args: { assetId: 'customers', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['customers'],
        requiredFields: ['context'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['context'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns comprehensive context including quality, freshness, and owner info',
    difficulty: 'basic',
  },

  // -- 6. Resolve a metric --
  {
    name: 'ocu-resolve-metric',
    persona: 'openclaw_user',
    question: 'What does the "revenue" metric mean? How is it calculated?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 1000,
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
        forbiddenEntities: ['fake_metric_arpu'],
      },
    },
    actionabilityCriteria: 'Returns the metric definition and calculation formula',
    difficulty: 'basic',
  },

  // -- 7. Get quality score --
  {
    name: 'ocu-quality-score',
    persona: 'openclaw_user',
    question: 'What is the data quality score for the orders table?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
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
    actionabilityCriteria: 'Returns a numeric quality score with dimension breakdown',
    difficulty: 'basic',
  },

  // -- 8. Search across platforms --
  {
    name: 'ocu-cross-platform-search',
    persona: 'openclaw_user',
    question: 'Search for revenue data across all connected platforms.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_across_platforms',
        args: { query: 'revenue', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['daily_revenue'],
        requiredFields: ['results'],
        forbiddenEntities: ['phantom_revenue_table'],
      },
      openmetadata: {
        requiredEntities: ['daily_revenue'],
        requiredFields: ['results'],
        forbiddenEntities: ['phantom_revenue_table'],
      },
    },
    actionabilityCriteria: 'Returns results from multiple platforms with platform labels',
    difficulty: 'intermediate',
  },

  // -- 9. List semantic definitions --
  {
    name: 'ocu-list-semantics',
    persona: 'openclaw_user',
    question: 'What semantic definitions are available in the catalog?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 1000,
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
    actionabilityCriteria: 'Returns a list of semantic definitions with names and types',
    difficulty: 'basic',
  },

  // -- 10. View documentation --
  {
    name: 'ocu-get-documentation',
    persona: 'openclaw_user',
    question: 'Show me the documentation for the orders table.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 1000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'get_documentation',
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
    actionabilityCriteria: 'Returns existing documentation content for the asset',
    difficulty: 'basic',
  },
];
