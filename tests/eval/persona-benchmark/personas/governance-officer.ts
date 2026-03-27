/**
 * Persona Scenarios: Data Governance Officer
 *
 * 10 scenarios covering compliance, PII scanning, audit trails,
 * RBAC enforcement, policy management, and data classification.
 *
 * This persona cares about GDPR/SOC2 compliance, access control,
 * data lineage for audit purposes, and sensitive data discovery.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const governanceOfficerScenarios: PersonaScenario[] = [
  // -- 1. PII scanning --
  {
    name: 'gov-scan-pii-customers',
    persona: 'governance_officer',
    question: 'The GDPR auditors are coming next week. Scan the customers table right now -- I need to know exactly what PII is exposed.',
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
    actionabilityCriteria: 'Identifies PII columns (email, name) with classification type and risk level',
    difficulty: 'intermediate',
  },

  // -- 2. Audit report --
  {
    name: 'gov-generate-audit-report',
    persona: 'governance_officer',
    question: 'We need to be SOC2 compliant by Friday. Generate the full audit report so I can see where we stand.',
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
    actionabilityCriteria: 'Produces a structured audit report with access events, policy checks, and timestamps',
    difficulty: 'intermediate',
  },

  // -- 3. Check access policy --
  {
    name: 'gov-check-policy-compliance',
    persona: 'governance_officer',
    question: 'Can the insights agent access the orders table? Check our data access policies.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
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

  // -- 4. RBAC enforcement --
  {
    name: 'gov-enforce-rbac',
    persona: 'governance_officer',
    question: 'Enforce RBAC on the orders table for analyst role user-1.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-governance',
        tool: 'enforce_rbac',
        args: {
          resource: 'table:analytics.public.fact_orders',
          userId: 'user-1',
          role: 'analyst',
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['enforced'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Confirms RBAC was enforced with role assignment and scope details',
    difficulty: 'intermediate',
  },

  // -- 5. Access provisioning --
  {
    name: 'gov-provision-access',
    persona: 'governance_officer',
    question: 'Grant temporary read access to the orders table for the external auditor.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-governance',
        tool: 'provision_access',
        args: {
          userId: 'user-1',
          resource: 'table:analytics.public.fact_orders',
          accessLevel: 'read',
          justification: 'External SOC2 audit',
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
    actionabilityCriteria: 'Confirms access grant with scope, expiry, and audit trail entry',
    difficulty: 'intermediate',
  },

  // -- 6. Lineage for audit trail --
  {
    name: 'gov-lineage-audit',
    persona: 'governance_officer',
    question: 'Show me the full lineage for customer data -- I need to trace PII flow for GDPR.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 5000,
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
        forbiddenEntities: ['phantom_pii_table'],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['upstream', 'downstream'],
        forbiddenEntities: ['phantom_pii_table'],
      },
    },
    actionabilityCriteria: 'Shows data flow path so PII propagation can be traced end-to-end',
    difficulty: 'intermediate',
  },

  // -- 7. Blast radius for sensitive data --
  {
    name: 'gov-blast-radius-customers',
    persona: 'governance_officer',
    question: 'If customer PII data is compromised, what downstream systems are affected?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'blast_radius_analysis',
        args: { assetId: 'customers', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['customers'],
        requiredFields: ['impactedAssets'],
        forbiddenEntities: [],
        minResultCount: 1,
      },
    },
    actionabilityCriteria: 'Lists all downstream consumers of customer PII with impact severity',
    difficulty: 'advanced',
  },

  // -- 8. Quality check for compliance --
  {
    name: 'gov-quality-check-compliance',
    persona: 'governance_officer',
    question: 'Run data quality checks on the customers table to verify data integrity for compliance.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-quality',
        tool: 'run_quality_check',
        args: { datasetId: 'dim_customers', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['dim_customers'],
        requiredFields: ['checks', 'status'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['checks', 'status'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns quality check results with pass/fail and specific metric values',
    difficulty: 'basic',
  },

  // -- 9. Cross-platform search for sensitive data --
  {
    name: 'gov-search-sensitive-data',
    persona: 'governance_officer',
    question: 'Find all datasets that might contain customer email or personal information.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'customer email personal', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['customers'],
        requiredFields: ['results'],
        forbiddenEntities: ['phantom_pii_database'],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['results'],
        forbiddenEntities: ['phantom_pii_database'],
      },
    },
    actionabilityCriteria: 'Returns datasets containing PII-related columns with platform info',
    difficulty: 'intermediate',
  },

  // -- 10. Schema change impact on compliance --
  {
    name: 'gov-schema-change-impact',
    persona: 'governance_officer',
    question: 'STOP -- someone is trying to add an SSN column to the customers table. What is the compliance impact? I need to block this if it is a risk.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-schema',
        tool: 'validate_schema_compatibility',
        args: {
          change: {
            type: 'add_column',
            table: 'dim_customers',
            column: 'ssn',
            changeType: 'column_added',
            details: { newType: 'VARCHAR(11)' },
          },
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['dim_customers'],
        requiredFields: ['compatible', 'analysis'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns compatibility verdict with analysis noting PII/compliance implications',
    difficulty: 'advanced',
  },
];
