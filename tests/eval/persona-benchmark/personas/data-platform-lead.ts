/**
 * Persona Scenarios: Data Platform Lead
 *
 * 10 scenarios covering cost, governance, adoption, PII,
 * audit, unused data, access provisioning, and observability.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const dataPlatformLeadScenarios: PersonaScenario[] = [
  // ── 1. Cost dashboard ──────────────────────────────────────────────────
  {
    name: 'dpl-cost-dashboard',
    persona: 'data_platform_lead',
    question: 'Show me the cost dashboard for our data platform.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-cost',
        tool: 'get_cost_dashboard',
        args: { customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['totalCost', 'breakdown'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns cost breakdown by service, warehouse, or resource with trend data',
    difficulty: 'basic',
  },

  // ── 2. Estimate savings ────────────────────────────────────────────────
  {
    name: 'dpl-estimate-savings',
    persona: 'data_platform_lead',
    question: 'Finance is pushing for a 20% cut in data infrastructure spend this quarter. Where can we actually save money without breaking anything?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-cost',
        tool: 'estimate_savings',
        args: { customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['recommendations', 'estimatedSavings'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Provides specific cost-saving recommendations with estimated dollar amounts',
    difficulty: 'intermediate',
  },

  // ── 3. Find unused data ────────────────────────────────────────────────
  {
    name: 'dpl-find-unused-data',
    persona: 'data_platform_lead',
    question: 'Which datasets are unused and could be archived or deleted?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-cost',
        tool: 'find_unused_data',
        args: { customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['unusedDatasets'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Lists datasets with last access date, storage cost, and archival recommendation',
    difficulty: 'intermediate',
  },

  // ── 4. Scan for PII ────────────────────────────────────────────────────
  {
    name: 'dpl-scan-pii',
    persona: 'data_platform_lead',
    question: 'Scan the customers table for PII. Do we have exposed personal data?',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-governance',
        tool: 'scan_pii',
        args: { datasetId: 'dim_customers', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['dim_customers'],
        requiredFields: ['piiColumns', 'riskLevel'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['piiColumns', 'riskLevel'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Identifies PII columns (email, name) with classification and risk assessment',
    difficulty: 'intermediate',
  },

  // ── 5. Generate audit report ───────────────────────────────────────────
  {
    name: 'dpl-audit-report',
    persona: 'data_platform_lead',
    question: 'Generate an audit report of all data access and policy checks.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-governance',
        tool: 'generate_audit_report',
        args: { customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['report', 'entries'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Produces a structured audit report with access events, policy violations, and timestamps',
    difficulty: 'intermediate',
  },

  // ── 6. Get adoption dashboard ──────────────────────────────────────────
  {
    name: 'dpl-adoption-dashboard',
    persona: 'data_platform_lead',
    question: 'Show me the agent adoption metrics -- how are teams using Data Workers?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-usage-intelligence',
        tool: 'get_adoption_dashboard',
        args: {},
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['agents', 'adoption'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Shows adoption rates per agent, active users, and usage trends',
    difficulty: 'basic',
  },

  // ── 7. Check agent health ──────────────────────────────────────────────
  {
    name: 'dpl-check-agent-health',
    persona: 'data_platform_lead',
    question: 'Users are reporting slow responses from the AI agents. Are all systems healthy or do we have a problem?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-observability',
        tool: 'check_agent_health',
        args: {},
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['agents', 'status'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns health status for each agent with uptime, error rates, and latency',
    difficulty: 'basic',
  },

  // ── 8. Provision access ────────────────────────────────────────────────
  {
    name: 'dpl-provision-access',
    persona: 'data_platform_lead',
    question: 'Grant read access to the orders table for user-1 for quarterly reporting.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-governance',
        tool: 'provision_access',
        args: {
          userId: 'user-1',
          resource: 'table:analytics.public.fact_orders',
          accessLevel: 'read',
          justification: 'Quarterly reporting',
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['granted', 'accessDetails'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Confirms access was provisioned with scope, expiry, and audit trail entry',
    difficulty: 'intermediate',
  },

  // ── 9. Check policy compliance ─────────────────────────────────────────
  {
    name: 'dpl-check-policy',
    persona: 'data_platform_lead',
    question: 'Can the insights agent read the orders table under our current policies?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-governance',
        tool: 'check_policy',
        args: {
          action: 'read',
          resource: 'table:analytics.public.fact_orders',
          agentId: 'dw-insights',
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
    actionabilityCriteria: 'Returns allow/deny decision with the specific policy rule that applies',
    difficulty: 'intermediate',
  },

  // ── 10. Recommend archival ─────────────────────────────────────────────
  {
    name: 'dpl-recommend-archival',
    persona: 'data_platform_lead',
    question: 'Which datasets should we archive to reduce storage costs?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-cost',
        tool: 'recommend_archival',
        args: { customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['recommendations'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Lists datasets with archival recommendation, last access date, and storage savings',
    difficulty: 'intermediate',
  },
];
