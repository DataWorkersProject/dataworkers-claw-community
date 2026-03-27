/**
 * Benchmark Scenarios — dw-governance
 *
 * 5 scenarios covering policy checks, RBAC enforcement, access provisioning,
 * PII scanning, and audit reporting.
 */

import type { BenchmarkScenario } from '../types.js';
import { nonEmptyCheck, typeCheck } from '../framework.js';

const CID = 'test-customer-1';

export const governanceScenarios: BenchmarkScenario[] = [
  // ── 1. Check policy ───────────────────────────────────────────────────
  {
    name: 'governance-check-policy',
    description: 'Check if an action is allowed by governance policy',
    agent: 'dw-governance',
    tool: 'check_policy',
    input: {
      action: 'read',
      resource: 'table:analytics.public.fact_orders',
      agentId: 'dw-insights',
      customerId: CID,
    },
    expectedFields: ['allowed'],
    qualityChecks: [
      { name: 'allowed-is-boolean', fn: typeCheck({ allowed: 'boolean' }) },
    ],
    category: 'analysis',
    difficulty: 'basic',
  },

  // ── 2. Enforce RBAC ──────────────────────────────────────────────────
  {
    name: 'governance-enforce-rbac',
    description: 'Enforce role-based access control on a resource',
    agent: 'dw-governance',
    tool: 'enforce_rbac',
    input: {
      resource: 'table:analytics.public.fact_orders',
      userId: 'user-1',
      role: 'analyst',
      customerId: CID,
    },
    expectedFields: ['allowed'],
    qualityChecks: [
      { name: 'allowed-is-boolean', fn: typeCheck({ allowed: 'boolean' }) },
    ],
    category: 'analysis',
    difficulty: 'basic',
  },

  // ── 3. Provision access ───────────────────────────────────────────────
  {
    name: 'governance-provision-access',
    description: 'Provision access for a user to a resource with justification',
    agent: 'dw-governance',
    tool: 'provision_access',
    input: {
      userId: 'user-1',
      resource: 'table:analytics.public.fact_orders',
      accessLevel: 'read',
      justification: 'Quarterly reporting needs',
      customerId: CID,
    },
    expectedFields: ['granted'],
    qualityChecks: [],
    category: 'mutation',
    difficulty: 'intermediate',
  },

  // ── 4. Scan for PII ──────────────────────────────────────────────────
  {
    name: 'governance-scan-pii',
    description: 'Scan a dataset for personally identifiable information',
    agent: 'dw-governance',
    tool: 'scan_pii',
    input: { datasetId: 'dim_customers', customerId: CID },
    expectedFields: ['datasetId'],
    qualityChecks: [
      { name: 'dataset-id-present', fn: nonEmptyCheck(['datasetId']) },
    ],
    category: 'analysis',
    difficulty: 'intermediate',
  },

  // ── 5. Generate audit report ──────────────────────────────────────────
  {
    name: 'governance-audit-report',
    description: 'Generate a governance audit report',
    agent: 'dw-governance',
    tool: 'generate_audit_report',
    input: { customerId: CID },
    expectedFields: ['customerId'],
    qualityChecks: [],
    category: 'generation',
    difficulty: 'basic',
  },
];
