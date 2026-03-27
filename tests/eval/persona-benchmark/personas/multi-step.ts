/**
 * Persona Scenarios: Multi-Step Cross-Agent
 *
 * 6 scenarios that chain tools across multiple agents to test
 * orchestration capability. Each scenario requires sequential
 * execution of 2-4 tools where later steps DYNAMICALLY consume
 * output from earlier steps via the `fromStep` + `field` + `fallback` pattern.
 *
 * These are "advanced" difficulty by default and exercise the
 * inter-agent coordination that single-tool scenarios miss.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const multiStepScenarios: PersonaScenario[] = [
  // ── 1. Safe schema migration workflow ───────────────────────────────
  {
    name: 'ms-safe-schema-migration',
    persona: 'data_engineer',
    question: 'I need to add a discount_pct column to the orders table safely. Check the blast radius first, then validate the schema change, and finally run quality checks.',
    applicableSeeds: ['jaffle-shop'],
    isMultiStep: true,
    maxLatencyMs: 500, // data engineer during incident-like migration
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'blast_radius_analysis',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    steps: [
      {
        agent: 'dw-context-catalog',
        tool: 'blast_radius_analysis',
        args: { assetId: 'fact_orders', customerId: CID },
      },
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
      {
        agent: 'dw-quality',
        tool: 'run_quality_check',
        args: { datasetId: 'fact_orders', customerId: CID },
      },
    ],
    multiSteps: [
      {
        id: 'blast-radius',
        agent: 'dw-context-catalog',
        tool: 'blast_radius_analysis',
        args: { assetId: 'fact_orders', customerId: CID },
        extractFields: {
          impactedCount: 'impactedAssets.length',
          primaryAsset: 'assetId',
        },
      },
      {
        id: 'validate-schema',
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
        dynamicInputs: {
          'change.table': { fromStep: 'blast-radius', field: 'primaryAsset', fallback: 'fact_orders' },
        },
        extractFields: {
          isCompatible: 'compatible',
        },
      },
      {
        id: 'quality-check',
        agent: 'dw-quality',
        tool: 'run_quality_check',
        args: { datasetId: 'fact_orders', customerId: CID },
        dynamicInputs: {
          datasetId: { fromStep: 'blast-radius', field: 'primaryAsset', fallback: 'fact_orders' },
        },
        extractFields: {
          qualityStatus: 'status',
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['impactedAssets', 'compatible', 'checks'],
        forbiddenEntities: [],
        minResultCount: 1,
      },
    },
    actionabilityCriteria: 'Shows blast radius, confirms schema compatibility, and validates current quality before migration',
    difficulty: 'advanced',
  },

  // ── 2. Revenue monitoring setup ─────────────────────────────────────
  {
    name: 'ms-setup-revenue-monitoring',
    persona: 'analytics_engineer',
    question: 'Set up monitoring for our revenue data: find the revenue tables, check their quality, set an SLA, and check freshness.',
    applicableSeeds: ['jaffle-shop'],
    isMultiStep: true,
    maxLatencyMs: 2000, // analytics engineer exploring
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'revenue', customerId: CID },
      },
    ],
    steps: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'revenue', customerId: CID },
      },
      {
        agent: 'dw-quality',
        tool: 'get_quality_score',
        args: { datasetId: 'fact_orders', customerId: CID },
      },
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
      {
        agent: 'dw-context-catalog',
        tool: 'check_freshness',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    multiSteps: [
      {
        id: 'search-revenue',
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'revenue', customerId: CID },
        extractFields: {
          tableName: 'results[0].name',
          tableId: 'results[0].assetId',
        },
      },
      {
        id: 'check-quality',
        agent: 'dw-quality',
        tool: 'get_quality_score',
        args: { customerId: CID },
        dynamicInputs: {
          datasetId: { fromStep: 'search-revenue', field: 'tableName', fallback: 'fact_orders' },
        },
        extractFields: {
          qualityScore: 'score',
        },
      },
      {
        id: 'set-sla',
        agent: 'dw-quality',
        tool: 'set_sla',
        args: {
          customerId: CID,
          rules: [
            { metric: 'null_rate', operator: 'lte', threshold: 0.05, severity: 'critical', description: 'Null rate must not exceed 5%' },
          ],
        },
        dynamicInputs: {
          datasetId: { fromStep: 'search-revenue', field: 'tableName', fallback: 'fact_orders' },
        },
        extractFields: {
          slaId: 'sla.id',
        },
      },
      {
        id: 'check-freshness',
        agent: 'dw-context-catalog',
        tool: 'check_freshness',
        args: { customerId: CID },
        dynamicInputs: {
          assetId: { fromStep: 'search-revenue', field: 'tableName', fallback: 'fact_orders' },
        },
        extractFields: {
          freshness: 'freshnessScore',
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['daily_revenue'],
        requiredFields: ['results', 'score', 'sla', 'freshnessScore'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Discovers revenue tables, assesses quality, establishes SLA thresholds, and confirms freshness status',
    difficulty: 'advanced',
  },

  // ── 3. Pipeline failure investigation ───────────────────────────────
  {
    name: 'ms-investigate-pipeline-failure',
    persona: 'data_engineer',
    question: "Yesterday's orders pipeline failed and row counts dropped to zero. Diagnose the incident, check the agent health, and look for anomalies.",
    applicableSeeds: ['jaffle-shop'],
    isMultiStep: true,
    maxLatencyMs: 500, // data engineer during incident -- urgent
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
    steps: [
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
      {
        agent: 'dw-observability',
        tool: 'check_agent_health',
        args: {},
      },
      {
        agent: 'dw-quality',
        tool: 'get_anomalies',
        args: { customerId: CID },
      },
    ],
    multiSteps: [
      {
        id: 'diagnose',
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
        extractFields: {
          severity: 'severity',
          rootCause: 'diagnosis.rootCause',
          affectedSource: 'diagnosis.source',
        },
      },
      {
        id: 'health-check',
        agent: 'dw-observability',
        tool: 'check_agent_health',
        args: {},
        extractFields: {
          healthStatus: 'status',
          unhealthyAgents: 'agents',
        },
      },
      {
        id: 'get-anomalies',
        agent: 'dw-quality',
        tool: 'get_anomalies',
        args: { customerId: CID },
        extractFields: {
          anomalyCount: 'anomalies.length',
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['diagnosis', 'severity', 'agents', 'anomalies'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Provides root cause diagnosis, confirms system health, and lists any related anomalies',
    difficulty: 'advanced',
  },

  // ── 4. SOC2 audit preparation ───────────────────────────────────────
  {
    name: 'ms-soc2-audit-prep',
    persona: 'governance_officer',
    question: 'We need to be SOC2 compliant by Friday. Scan for PII exposure, generate an audit report, check our access policies, and review schema changes.',
    applicableSeeds: ['jaffle-shop'],
    isMultiStep: true,
    maxLatencyMs: 5000, // governance officer running audit -- batch acceptable
    routes: [
      {
        agent: 'dw-governance',
        tool: 'scan_pii',
        args: { datasetId: 'dim_customers', customerId: CID },
      },
    ],
    steps: [
      {
        agent: 'dw-governance',
        tool: 'scan_pii',
        args: { datasetId: 'dim_customers', customerId: CID },
      },
      {
        agent: 'dw-governance',
        tool: 'generate_audit_report',
        args: { customerId: CID },
      },
      {
        agent: 'dw-governance',
        tool: 'check_policy',
        args: {
          action: 'read',
          resource: 'table:analytics.public.dim_customers',
          agentId: 'dw-insights',
          customerId: CID,
        },
      },
      {
        agent: 'dw-schema',
        tool: 'detect_schema_change',
        args: { source: 'snowflake', customerId: CID, database: 'analytics', schema: 'public' },
      },
    ],
    multiSteps: [
      {
        id: 'scan-pii',
        agent: 'dw-governance',
        tool: 'scan_pii',
        args: { datasetId: 'dim_customers', customerId: CID },
        extractFields: {
          riskLevel: 'riskLevel',
          piiColumns: 'piiColumns',
          scannedDataset: 'datasetId',
        },
      },
      {
        id: 'audit-report',
        agent: 'dw-governance',
        tool: 'generate_audit_report',
        args: { customerId: CID },
        extractFields: {
          reportId: 'report.id',
          entryCount: 'entries.length',
        },
      },
      {
        id: 'check-policy',
        agent: 'dw-governance',
        tool: 'check_policy',
        args: {
          action: 'read',
          agentId: 'dw-insights',
          customerId: CID,
        },
        dynamicInputs: {
          resource: {
            fromStep: 'scan-pii',
            field: 'scannedDataset',
            fallback: 'table:analytics.public.dim_customers',
            transform: 'table:analytics.public.${value}',
          },
        },
        extractFields: {
          policyAllowed: 'allowed',
        },
      },
      {
        id: 'schema-changes',
        agent: 'dw-schema',
        tool: 'detect_schema_change',
        args: { source: 'snowflake', customerId: CID, database: 'analytics', schema: 'public' },
        extractFields: {
          changeCount: 'changes.length',
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['dim_customers'],
        requiredFields: ['piiColumns', 'riskLevel', 'report', 'allowed', 'changes'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Identifies PII, generates compliance report, validates access policies, and flags recent schema changes',
    difficulty: 'advanced',
  },

  // ── 5. Platform cost optimization ───────────────────────────────────
  {
    name: 'ms-optimize-platform-costs',
    persona: 'data_platform_lead',
    question: 'I need to cut our data platform costs by 30%. Show me the cost dashboard, find unused data, check usage metrics, and recommend what to archive.',
    applicableSeeds: ['jaffle-shop'],
    isMultiStep: true,
    maxLatencyMs: 2000, // platform lead exploring options
    routes: [
      {
        agent: 'dw-cost',
        tool: 'get_cost_dashboard',
        args: { customerId: CID },
      },
    ],
    steps: [
      {
        agent: 'dw-cost',
        tool: 'get_cost_dashboard',
        args: { customerId: CID },
      },
      {
        agent: 'dw-cost',
        tool: 'find_unused_data',
        args: { customerId: CID },
      },
      {
        agent: 'dw-usage-intelligence',
        tool: 'get_adoption_dashboard',
        args: {},
      },
      {
        agent: 'dw-cost',
        tool: 'recommend_archival',
        args: { customerId: CID },
      },
    ],
    multiSteps: [
      {
        id: 'cost-dashboard',
        agent: 'dw-cost',
        tool: 'get_cost_dashboard',
        args: { customerId: CID },
        extractFields: {
          totalCost: 'totalCost',
          topService: 'breakdown[0].service',
        },
      },
      {
        id: 'find-unused',
        agent: 'dw-cost',
        tool: 'find_unused_data',
        args: { customerId: CID },
        extractFields: {
          unusedCount: 'unusedDatasets.length',
          topUnused: 'unusedDatasets[0].name',
        },
      },
      {
        id: 'adoption',
        agent: 'dw-usage-intelligence',
        tool: 'get_adoption_dashboard',
        args: {},
        extractFields: {
          adoptionRate: 'adoption.rate',
        },
      },
      {
        id: 'archival-recs',
        agent: 'dw-cost',
        tool: 'recommend_archival',
        args: { customerId: CID },
        extractFields: {
          recommendationCount: 'recommendations.length',
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['totalCost', 'breakdown', 'unusedDatasets', 'recommendations'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Provides cost overview, identifies waste, shows usage patterns, and gives archival recommendations',
    difficulty: 'advanced',
  },

  // ── 6. New team member data onboarding ──────────────────────────────
  {
    name: 'ms-new-member-onboarding',
    persona: 'data_practitioner',
    question: 'I just joined the team and need to get up to speed on our data. Show me what data we have, explain the main tables, and check if the data is fresh and reliable.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    isMultiStep: true,
    maxLatencyMs: 2000, // new member exploring interactively
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: '*', customerId: CID },
      },
    ],
    steps: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: '*', customerId: CID },
      },
      {
        agent: 'dw-context-catalog',
        tool: 'explain_table',
        args: { tableIdentifier: 'fact_orders', customerId: CID },
      },
      {
        agent: 'dw-context-catalog',
        tool: 'check_freshness',
        args: { assetId: 'fact_orders', customerId: CID },
      },
      {
        agent: 'dw-quality',
        tool: 'get_quality_score',
        args: { datasetId: 'fact_orders', customerId: CID },
      },
    ],
    multiSteps: [
      {
        id: 'discover-data',
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: '*', customerId: CID },
        extractFields: {
          firstTable: 'results[0].name',
          firstAssetId: 'results[0].assetId',
        },
      },
      {
        id: 'explain-table',
        agent: 'dw-context-catalog',
        tool: 'explain_table',
        args: { customerId: CID },
        dynamicInputs: {
          tableIdentifier: { fromStep: 'discover-data', field: 'firstTable', fallback: 'fact_orders' },
        },
        extractFields: {
          tableDescription: 'description',
          columnCount: 'columns.length',
        },
      },
      {
        id: 'check-freshness',
        agent: 'dw-context-catalog',
        tool: 'check_freshness',
        args: { customerId: CID },
        dynamicInputs: {
          assetId: { fromStep: 'discover-data', field: 'firstTable', fallback: 'fact_orders' },
        },
        extractFields: {
          freshness: 'freshnessScore',
        },
      },
      {
        id: 'quality-score',
        agent: 'dw-quality',
        tool: 'get_quality_score',
        args: { customerId: CID },
        dynamicInputs: {
          datasetId: { fromStep: 'discover-data', field: 'firstTable', fallback: 'fact_orders' },
        },
        extractFields: {
          qualityScore: 'score',
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['orders', 'customers'],
        requiredFields: ['results', 'columns', 'freshnessScore', 'score'],
        forbiddenEntities: [],
        minResultCount: 2,
      },
      openmetadata: {
        requiredEntities: ['orders', 'customers'],
        requiredFields: ['results', 'columns', 'freshnessScore', 'score'],
        forbiddenEntities: [],
        minResultCount: 2,
      },
    },
    actionabilityCriteria: 'Discovers available data, explains key tables, confirms freshness and quality for a new team member',
    difficulty: 'advanced',
  },
];
