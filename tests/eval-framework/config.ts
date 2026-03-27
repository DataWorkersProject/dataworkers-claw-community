/**
 * Eval Framework — Agent Registry & Configuration
 *
 * Maps each of the 15 agents to its server import path and top tools to evaluate.
 * Tool args reference the TOOL_ARGS pattern from agent-report-card.test.ts.
 */

import type { AgentToolConfig, EvalConfig } from './types.js';

// ---------------------------------------------------------------------------
// Customer ID used across all tool calls (matches report card)
// ---------------------------------------------------------------------------

export const CID = 'test-customer-1';

// ---------------------------------------------------------------------------
// Agent registry: agent name -> server import + top tools
// ---------------------------------------------------------------------------

export const AGENT_REGISTRY: AgentToolConfig[] = [
  {
    agent: 'dw-pipelines',
    serverImport: '../../agents/dw-pipelines/src/index.js',
    tools: ['generate_pipeline', 'validate_pipeline', 'deploy_pipeline', 'list_pipeline_templates'],
  },
  {
    agent: 'dw-incidents',
    serverImport: '../../agents/dw-incidents/src/index.js',
    tools: ['diagnose_incident', 'get_incident_history', 'get_root_cause', 'remediate', 'monitor_metrics'],
  },
  {
    agent: 'dw-context-catalog',
    serverImport: '../../agents/dw-context-catalog/src/index.js',
    tools: ['search_datasets', 'get_context', 'get_lineage', 'explain_table', 'blast_radius_analysis'],
  },
  {
    agent: 'dw-schema',
    serverImport: '../../agents/dw-schema/src/index.js',
    tools: ['detect_schema_change', 'generate_migration', 'apply_migration', 'get_schema_snapshot', 'validate_schema_compatibility'],
  },
  {
    agent: 'dw-quality',
    serverImport: '../../agents/dw-quality/src/index.js',
    tools: ['run_quality_check', 'get_quality_score', 'get_anomalies', 'set_sla'],
  },
  {
    agent: 'dw-governance',
    serverImport: '../../agents/dw-governance/src/index.js',
    tools: ['check_policy', 'enforce_rbac', 'generate_audit_report', 'provision_access', 'scan_pii'],
  },
  {
    agent: 'dw-usage-intelligence',
    serverImport: '../../agents/dw-usage-intelligence/src/index.js',
    tools: ['get_adoption_dashboard', 'check_agent_health', 'get_tool_usage_metrics', 'list_active_agents', 'get_workflow_patterns'],
  },
  {
    agent: 'dw-observability',
    serverImport: '../../agents/dw-observability/src/index.js',
    tools: ['check_agent_health', 'detect_drift', 'get_agent_metrics', 'get_audit_trail', 'list_active_agents'],
  },
  {
    agent: 'dw-connectors',
    serverImport: '../../agents/dw-connectors/src/index.js',
    tools: ['list_all_catalogs', 'search_across_catalogs', 'list_snowflake_databases', 'list_bigquery_datasets', 'list_dbt_models'],
  },
  {
    agent: 'dw-orchestration',
    serverImport: '../../agents/dw-orchestration/src/index.js',
    tools: [], // Non-MCP agent — tested via TypeScript API, not callTool
  },
  {
    agent: 'dw-ml',
    serverImport: '../../agents/dw-ml/src/index.js',
    tools: ['suggest_features', 'select_model', 'train_model', 'evaluate_model', 'deploy_model'],
  },
];

// ---------------------------------------------------------------------------
// Tool arguments for evaluation (subset from agent-report-card TOOL_ARGS)
// ---------------------------------------------------------------------------

export const TOOL_ARGS: Record<string, Record<string, unknown>> = {
  // -- dw-pipelines --
  generate_pipeline: { description: 'Extract daily sales from Snowflake, transform with dbt, load to BigQuery', customerId: CID },
  validate_pipeline: { pipelineSpec: { name: 'test-pipeline', steps: [{ name: 'extract', type: 'extract', config: {} }] }, customerId: CID },
  deploy_pipeline: { pipelineSpec: { name: 'test-pipeline', steps: [{ name: 'extract', type: 'extract', config: {} }] }, customerId: CID, environment: 'staging' },
  list_pipeline_templates: {},

  // -- dw-incidents --
  diagnose_incident: { anomalySignals: [{ metric: 'row_count', value: 0, expected: 50000, deviation: -1.0, source: 'fact_orders', timestamp: Date.now() }], customerId: CID },
  get_incident_history: { customerId: CID },
  get_root_cause: { incidentId: 'inc-001', incidentType: 'data_quality', affectedResources: ['fact_orders'], customerId: CID },
  remediate: { incidentId: 'inc-001', incidentType: 'data_quality', confidence: 0.85, customerId: CID },
  monitor_metrics: { dataPoints: [{ metric: 'row_count', value: 50000, source: 'fact_orders' }, { metric: 'null_rate', value: 0.02, source: 'fact_orders' }], customerId: CID },

  // -- dw-context-catalog --
  search_datasets: { query: 'customer orders', customerId: CID },
  get_context: { assetId: 'fact_orders', customerId: CID },
  get_lineage: { assetId: 'fact_orders', customerId: CID },
  explain_table: { tableIdentifier: 'fact_orders', customerId: CID },
  blast_radius_analysis: { assetId: 'fact_orders', customerId: CID },

  // -- dw-schema --
  detect_schema_change: { source: 'snowflake', customerId: CID, database: 'analytics', schema: 'public' },
  generate_migration: { change: { type: 'add_column', table: 'fact_orders', column: 'discount_pct', dataType: 'DECIMAL(5,2)' }, customerId: CID },
  apply_migration: { migration: { id: 'mig-001', sql: 'ALTER TABLE fact_orders ADD COLUMN discount_pct DECIMAL(5,2)', rollbackSql: 'ALTER TABLE fact_orders DROP COLUMN discount_pct' }, customerId: CID },
  get_schema_snapshot: { source: 'snowflake', database: 'analytics', schema: 'public', table: 'orders', customerId: 'cust-1' },
  validate_schema_compatibility: { change: { type: 'add_column', table: 'fact_orders', column: 'discount_pct', changeType: 'column_added', details: { newType: 'DECIMAL(5,2)' } }, customerId: CID },

  // -- dw-quality --
  run_quality_check: { datasetId: 'fact_orders', customerId: CID },
  get_quality_score: { datasetId: 'fact_orders', customerId: CID },
  get_anomalies: { customerId: CID },
  set_sla: { datasetId: 'fact_orders', customerId: CID, rules: [{ metric: 'null_rate', operator: 'lte', threshold: 0.05, severity: 'critical', description: 'Null rate must not exceed 5%' }] },

  // -- dw-governance --
  check_policy: { action: 'read', resource: 'table:analytics.public.fact_orders', agentId: 'dw-insights', customerId: CID },
  enforce_rbac: { resource: 'table:analytics.public.fact_orders', userId: 'user-1', role: 'analyst', customerId: CID },
  generate_audit_report: { customerId: CID },
  provision_access: { userId: 'user-1', resource: 'table:analytics.public.fact_orders', accessLevel: 'read', justification: 'Quarterly reporting', customerId: CID },
  scan_pii: { datasetId: 'dim_customers', customerId: CID },

  // -- dw-usage-intelligence --
  get_adoption_dashboard: {},
  check_agent_health: {},
  get_tool_usage_metrics: {},
  list_active_agents: {},
  get_workflow_patterns: {},

  // -- dw-observability (uses obs: prefix to disambiguate shared tool names) --
  'obs:check_agent_health': {},
  'obs:detect_drift': {},
  'obs:get_agent_metrics': { agentName: 'dw-pipelines' },
  'obs:get_audit_trail': {},
  'obs:list_active_agents': {},

  // -- dw-connectors --
  list_all_catalogs: { customerId: CID },
  search_across_catalogs: { customerId: CID, query: 'orders' },
  list_snowflake_databases: { customerId: CID },
  list_bigquery_datasets: { customerId: CID },
  list_dbt_models: { customerId: CID },

  // -- dw-ml --
  suggest_features: { datasetId: 'ds-churn', target: 'is_churned', customerId: CID },
  select_model: { datasetId: 'ds-churn', target: 'is_churned', taskType: 'classification', customerId: CID },
  train_model: { experimentId: 'exp-001', modelType: 'random_forest', datasetId: 'ds-churn', target: 'is_churned', customerId: CID },
  evaluate_model: { modelId: 'model-001', datasetId: 'ds-churn', customerId: CID },
  deploy_model: { modelId: 'model-001', environment: 'staging', customerId: CID },
};

// ---------------------------------------------------------------------------
// Resolver: get tool args for a given agent + tool pair
// ---------------------------------------------------------------------------

export function getToolArgs(toolName: string, agentName: string): Record<string, unknown> {
  // Check for agent-specific prefixed keys (observability shares names with usage-intelligence)
  if (agentName === 'dw-observability') {
    const prefixed = TOOL_ARGS[`obs:${toolName}`];
    if (prefixed !== undefined) return prefixed;
  }

  if (TOOL_ARGS[toolName] !== undefined) {
    return TOOL_ARGS[toolName];
  }

  // Fallback
  return { customerId: CID };
}

// ---------------------------------------------------------------------------
// Default eval config
// ---------------------------------------------------------------------------

export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  agents: AGENT_REGISTRY.filter((a) => a.tools.length > 0), // exclude non-MCP agents
  runsPerTool: 3,
  thresholds: {
    composite: 70,
    aiEvals: 70,
    productQuality: 70,
    productivity: 60,
    userValue: 60,
  },
};
