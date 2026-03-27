/**
 * Persona Scenarios: Negative / Adversarial Tests
 *
 * These scenarios are EXPECTED to fail or return errors. They test that
 * agents handle bad inputs, non-existent entities, permission-denied cases,
 * and edge cases gracefully rather than hallucinating results.
 *
 * Each scenario has `isNegativeTest: true` and an `expectedErrorPattern`
 * describing the kind of error response we expect.
 *
 * Covers:
 *   - Non-existent table/entity queries
 *   - Empty/missing required parameters
 *   - Permission-denied scenarios
 *   - Malformed inputs (special characters, SQL injection attempts)
 *   - Very long query strings
 *   - Ambiguous/conflicting requests
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const negativeTestScenarios: PersonaScenario[] = [
  // ──────────────────────────────────────────────────────────────────────
  // Non-existent entity tests
  // ──────────────────────────────────────────────────────────────────────

  {
    name: 'neg-search-nonexistent-table',
    persona: 'data_engineer',
    question: 'Find the zzz_nonexistent_table_42 in our warehouse.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    isNegativeTest: true,
    expectedErrorPattern: 'no.*(result|match|found)|empty|not.*found|0.*result',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'zzz_nonexistent_table_42', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['results'],
        forbiddenEntities: ['zzz_nonexistent_table_42'],
      },
      openmetadata: {
        requiredEntities: [],
        requiredFields: ['results'],
        forbiddenEntities: ['zzz_nonexistent_table_42'],
      },
    },
    actionabilityCriteria: 'Returns empty results or a clear not-found message without fabricating data',
    difficulty: 'basic',
  },

  {
    name: 'neg-explain-nonexistent-table',
    persona: 'analytics_engineer',
    question: 'Explain the phantom_revenue_v99 table.',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'not.*found|does.*not.*exist|unknown|no.*table',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'explain_table',
        args: { tableIdentifier: 'phantom_revenue_v99', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: ['phantom_revenue_v99'],
      },
    },
    actionabilityCriteria: 'Returns a clear error that the table does not exist, not fabricated column info',
    difficulty: 'basic',
  },

  {
    name: 'neg-lineage-nonexistent-asset',
    persona: 'data_engineer',
    question: 'Show me the lineage for the imaginary_metrics_cube table.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    isNegativeTest: true,
    expectedErrorPattern: 'not.*found|no.*lineage|unknown.*asset|does.*not.*exist',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'get_lineage',
        args: { assetId: 'imaginary_metrics_cube', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: ['imaginary_metrics_cube'],
      },
      openmetadata: {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: ['imaginary_metrics_cube'],
      },
    },
    actionabilityCriteria: 'Returns not-found or empty lineage rather than fabricating upstream/downstream',
    difficulty: 'basic',
  },

  {
    name: 'neg-quality-nonexistent-dataset',
    persona: 'data_practitioner',
    question: 'Run quality checks on the fake_dataset_xyz table.',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'not.*found|unknown|no.*dataset|does.*not.*exist',
    routes: [
      {
        agent: 'dw-quality',
        tool: 'run_quality_check',
        args: { datasetId: 'fake_dataset_xyz', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: ['fake_dataset_xyz'],
      },
    },
    actionabilityCriteria: 'Returns an error or empty check result, not fabricated quality metrics',
    difficulty: 'basic',
  },

  // ──────────────────────────────────────────────────────────────────────
  // Empty / missing parameter tests
  // ──────────────────────────────────────────────────────────────────────

  {
    name: 'neg-search-empty-query',
    persona: 'data_practitioner',
    question: 'Search for... um, I forgot what I was looking for.',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'empty|invalid|required|provide.*query',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: '', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns an error about empty/missing query parameter or an empty result set',
    difficulty: 'basic',
  },

  {
    name: 'neg-empty-customer-id',
    persona: 'data_engineer',
    question: 'Search for orders tables.',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'customer|invalid|required|missing|empty',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'orders', customerId: '' },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Handles empty customerId gracefully with a clear validation error',
    difficulty: 'basic',
  },

  // ──────────────────────────────────────────────────────────────────────
  // Permission denied / access control tests
  // ──────────────────────────────────────────────────────────────────────

  {
    name: 'neg-policy-deny-write',
    persona: 'governance_officer',
    question: 'Can the read-only audit bot write to the customers table?',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'denied|not.*allowed|forbidden|reject',
    routes: [
      {
        agent: 'dw-governance',
        tool: 'check_policy',
        args: {
          action: 'write',
          resource: 'table:analytics.public.dim_customers',
          agentId: 'dw-audit-readonly',
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['allowed', 'policy'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns a clear deny decision with the specific policy that blocks write access',
    difficulty: 'intermediate',
  },

  {
    name: 'neg-provision-unauthorized-admin',
    persona: 'governance_officer',
    question: 'Grant admin access to all tables for the external contractor.',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'denied|not.*allowed|forbidden|cannot.*grant|admin.*restricted',
    routes: [
      {
        agent: 'dw-governance',
        tool: 'provision_access',
        args: {
          userId: 'external-contractor-123',
          resource: 'table:*',
          accessLevel: 'admin',
          justification: 'Need full access for project',
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns clear denial of wildcard admin access with policy explanation',
    difficulty: 'intermediate',
  },

  // ──────────────────────────────────────────────────────────────────────
  // Malformed input / injection tests
  // ──────────────────────────────────────────────────────────────────────

  {
    name: 'neg-sql-injection-search',
    persona: 'data_scientist',
    question: "Search for tables matching: orders'; DROP TABLE users; --",
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'invalid|sanitize|no.*result|error|empty',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: "orders'; DROP TABLE users; --", customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: ['users'],
      },
    },
    actionabilityCriteria: 'Handles SQL injection attempt safely without executing malicious input',
    difficulty: 'intermediate',
  },

  {
    name: 'neg-special-chars-query',
    persona: 'data_engineer',
    question: 'Search for tables with name: <script>alert("xss")</script>',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'invalid|no.*result|error|empty|sanitize',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: '<script>alert("xss")</script>', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Handles special characters safely without XSS or error propagation',
    difficulty: 'intermediate',
  },

  {
    name: 'neg-very-long-query',
    persona: 'data_engineer',
    question: 'Search for a table with an extremely long name that exceeds any reasonable limit.',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'no.*result|empty|error|too.*long|invalid|not.*found',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'a'.repeat(10000), customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Handles extremely long input without crashing or hanging',
    difficulty: 'basic',
  },

  // ──────────────────────────────────────────────────────────────────────
  // Ambiguous / conflicting request tests
  // ──────────────────────────────────────────────────────────────────────

  {
    name: 'neg-resolve-nonexistent-metric',
    persona: 'analytics_engineer',
    question: 'What is the definition of the "quantum_revenue_flux" metric?',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'not.*found|unknown|no.*metric|does.*not.*exist',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'resolve_metric',
        args: { metricName: 'quantum_revenue_flux', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: ['quantum_revenue_flux'],
      },
    },
    actionabilityCriteria: 'Returns not-found rather than fabricating a metric definition',
    difficulty: 'basic',
  },

  {
    name: 'neg-diagnose-empty-signals',
    persona: 'data_engineer',
    question: 'Diagnose an incident with no anomaly signals provided.',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'no.*signal|empty|invalid|required|cannot.*diagnose',
    routes: [
      {
        agent: 'dw-incidents',
        tool: 'diagnose_incident',
        args: {
          anomalySignals: [],
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns an error about missing anomaly signals rather than fabricating a diagnosis',
    difficulty: 'basic',
  },

  {
    name: 'neg-blast-radius-nonexistent',
    persona: 'data_platform_lead',
    question: 'What is the blast radius if the totally_fake_source_table goes down?',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'not.*found|unknown|no.*asset|does.*not.*exist|empty',
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'blast_radius_analysis',
        args: { assetId: 'totally_fake_source_table', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: ['totally_fake_source_table'],
      },
    },
    actionabilityCriteria: 'Returns not-found or empty impact list rather than inventing downstream dependencies',
    difficulty: 'basic',
  },

  {
    name: 'neg-pii-scan-nonexistent-table',
    persona: 'governance_officer',
    question: 'Scan the secret_users_hidden_v99 table for PII.',
    applicableSeeds: ['jaffle-shop'],
    isNegativeTest: true,
    expectedErrorPattern: 'not.*found|unknown|no.*table|does.*not.*exist',
    routes: [
      {
        agent: 'dw-governance',
        tool: 'scan_pii',
        args: { datasetId: 'secret_users_hidden_v99', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: [],
        forbiddenEntities: ['secret_users_hidden_v99'],
      },
    },
    actionabilityCriteria: 'Returns not-found rather than fabricating PII scan results',
    difficulty: 'basic',
  },
];
