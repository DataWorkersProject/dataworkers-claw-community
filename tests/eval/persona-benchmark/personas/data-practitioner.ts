/**
 * Persona Scenarios: Data Practitioner (Generalist / Junior)
 *
 * 8 scenarios covering the breadth of a generalist junior data role:
 * search, context, quality, lineage, documentation, and basic insights.
 *
 * This persona asks broad, exploratory questions typical of someone
 * new to a data stack -- less specific than domain experts but touching
 * many agent capabilities.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const dataPractitionerScenarios: PersonaScenario[] = [
  // -- 1. Explore available data --
  {
    name: 'dp-discover-data',
    persona: 'data_practitioner',
    question: 'I just started here and I have no idea where anything is. What data do we actually have?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: '*', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['orders', 'customers'],
        requiredFields: ['results'],
        forbiddenEntities: ['nonexistent_table_xyz'],
        minResultCount: 2,
      },
      openmetadata: {
        requiredEntities: ['orders', 'customers'],
        requiredFields: ['results'],
        forbiddenEntities: ['nonexistent_table_xyz'],
        minResultCount: 2,
      },
    },
    actionabilityCriteria: 'Returns a broad list of available datasets with names, platforms, and descriptions',
    difficulty: 'basic',
  },

  // -- 2. Understand a table --
  {
    name: 'dp-understand-orders',
    persona: 'data_practitioner',
    question: 'I need to use the orders table for a report. What columns does it have?',
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
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['orders'],
        requiredFields: ['columns', 'description'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns column names, types, and table purpose to help build a query',
    difficulty: 'basic',
  },

  // -- 3. Check data quality --
  {
    name: 'dp-check-quality',
    persona: 'data_practitioner',
    question: 'My manager wants me to build a report on orders but I am worried the data might have issues. Can I trust it?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
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
    actionabilityCriteria: 'Returns a quality score with breakdown to assess data reliability',
    difficulty: 'basic',
  },

  // -- 4. Simple lineage --
  {
    name: 'dp-simple-lineage',
    persona: 'data_practitioner',
    question: 'Where does the customer data come from? I want to understand the data flow.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'get_lineage',
        args: { assetId: 'customers', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['customers'],
        requiredFields: ['upstream', 'downstream'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['upstream', 'downstream'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Shows upstream sources and downstream consumers in a way that is easy to understand',
    difficulty: 'basic',
  },

  // -- 5. Ask a data question in natural language --
  {
    name: 'dp-nl-query',
    persona: 'data_practitioner',
    question: 'How many orders did we have last month?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-insights',
        tool: 'query_data_nl',
        args: { question: 'How many orders did we have last month?', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['sql', 'results'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Generates valid SQL and returns a result the user can understand',
    difficulty: 'basic',
  },

  // -- 6. Check anomalies --
  {
    name: 'dp-check-anomalies',
    persona: 'data_practitioner',
    question: 'Before I present these numbers to the team, are there any data quality issues that could make me look bad?',
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
    actionabilityCriteria: 'Lists detected anomalies with enough context to assess impact on analysis',
    difficulty: 'basic',
  },

  // -- 7. Get context for analysis --
  {
    name: 'dp-get-full-context',
    persona: 'data_practitioner',
    question: 'Tell me everything about the daily_revenue dataset -- quality, freshness, lineage.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'get_context',
        args: { assetId: 'daily_revenue', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['daily_revenue'],
        requiredFields: ['context'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['daily_revenue'],
        requiredFields: ['context'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns comprehensive context including quality, freshness, lineage, and owner',
    difficulty: 'basic',
  },

  // -- 8. Explore documentation --
  {
    name: 'dp-read-docs',
    persona: 'data_practitioner',
    question: 'Is there any documentation for the orders table?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
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
    actionabilityCriteria: 'Returns existing documentation or indicates none exists',
    difficulty: 'basic',
  },
];
