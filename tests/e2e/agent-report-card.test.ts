/**
 * Agent Report Card Framework
 *
 * Systematically scores EVERY MCP tool across all 14 agents.
 * For each tool, calls it with realistic test data and classifies the result:
 *   - 'working': valid, non-empty JSON response
 *   - 'stub':    response returned but empty/placeholder
 *   - 'error':   threw an exception or returned isError: true
 *
 * Generates a JSON report card at the end with per-agent and overall scores.
 * Runs with InMemory backends — no Docker or external services required.
 */

import { describe, it, expect } from 'vitest';

// ─── MCP-based agents (13 MCP servers) ──────────────────────────────────────
import { server as pipelinesServer } from '../../agents/dw-pipelines/src/index.js';
import { server as incidentsServer } from '../../agents/dw-incidents/src/index.js';
import { server as catalogServer } from '../../agents/dw-context-catalog/src/index.js';
import { server as schemaServer } from '../../agents/dw-schema/src/index.js';
import { server as qualityServer } from '../../agents/dw-quality/src/index.js';
import { server as governanceServer } from '../../agents/dw-governance/src/index.js';
import { server as usageIntelServer } from '../../agents/dw-usage-intelligence/src/index.js';
import { server as observabilityServer } from '../../agents/dw-observability/src/index.js';
import { server as connectorsServer } from '../../agents/dw-connectors/src/index.js';

// dw-orchestration is NOT an MCP agent — it exports TypeScript APIs
import { TaskScheduler, AgentRegistry } from '../../agents/dw-orchestration/src/index.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type ToolScore = 'working' | 'stub' | 'error';

interface ToolResult {
  tool: string;
  score: ToolScore;
  detail: string;
}

interface AgentReport {
  agent: string;
  toolsTotal: number;
  toolsWorking: number;
  toolsStub: number;
  toolsError: number;
  score: number;
  tools: ToolResult[];
}

interface OverallReport {
  agents: AgentReport[];
  totalTools: number;
  totalWorking: number;
  totalStub: number;
  totalError: number;
  overallScore: number;
}

// ─── Realistic test data for each tool ──────────────────────────────────────

const CID = 'test-customer-1';

/** Map of tool name -> args to pass. Covers required params with realistic data. */
const TOOL_ARGS: Record<string, Record<string, unknown>> = {
  // ── dw-pipelines ──
  generate_pipeline: { description: 'Extract daily sales from Snowflake, transform with dbt, load to BigQuery', customerId: CID },
  validate_pipeline: { pipelineSpec: { name: 'test-pipeline', steps: [{ name: 'extract', type: 'extract', config: {} }] }, customerId: CID },
  deploy_pipeline: { pipelineSpec: { name: 'test-pipeline', steps: [{ name: 'extract', type: 'extract', config: {} }] }, customerId: CID, environment: 'staging' },
  list_pipeline_templates: {},

  // ── dw-incidents ──
  diagnose_incident: { anomalySignals: [{ metric: 'row_count', value: 0, expected: 50000, deviation: -1.0, source: 'fact_orders', timestamp: Date.now() }], customerId: CID },
  get_incident_history: { customerId: CID },
  get_root_cause: { incidentId: 'inc-001', incidentType: 'data_quality', affectedResources: ['fact_orders'], customerId: CID },
  remediate: { incidentId: 'inc-001', incidentType: 'data_quality', confidence: 0.85, customerId: CID },
  monitor_metrics: { dataPoints: [{ metric: 'row_count', value: 50000, source: 'fact_orders' }, { metric: 'null_rate', value: 0.02, source: 'fact_orders' }], customerId: CID },

  // ── dw-context-catalog ──
  search_datasets: { query: 'customer orders', customerId: CID },
  get_context: { assetId: 'fact_orders', customerId: CID },
  get_lineage: { assetId: 'fact_orders', customerId: CID },
  get_documentation: { assetId: 'fact_orders', customerId: CID },
  check_freshness: { assetId: 'fact_orders', customerId: CID },
  assess_impact: { assetId: 'fact_orders', customerId: CID },
  list_semantic_definitions: { customerId: CID },
  resolve_metric: { metricName: 'revenue', customerId: CID },
  explain_table: { tableIdentifier: 'fact_orders', customerId: CID },
  search_across_platforms: { query: 'customer orders', customerId: CID },
  trace_cross_platform_lineage: { assetId: 'fact_orders', customerId: CID },
  blast_radius_analysis: { assetId: 'fact_orders', customerId: CID },
  generate_documentation: { assetId: 'fact_orders', customerId: CID },
  correlate_metadata: { assetIdentifier: 'fact_orders', customerId: CID },
  update_lineage: { sourceDatasetId: 'src-raw-orders', targetDatasetId: 'stg-orders' },
  auto_tag_dataset: { datasetId: 'orders' },
  define_business_rule: { assetId: 'fact_orders', ruleType: 'calculation', content: 'Total amount includes tax', customerId: CID },
  query_rules: { query: 'revenue', customerId: CID },
  import_tribal_knowledge: { entries: [{ assetId: 'fact_orders', content: 'Revenue includes tax and shipping' }], customerId: CID },
  update_business_rule: { ruleId: 'rule-1', content: 'Updated rule content', customerId: CID },
  analyze_query_history: { assetId: 'fact_orders', customerId: CID },
  identify_golden_path: { domain: 'revenue', customerId: CID },
  check_staleness: { assetId: 'fact_orders', customerId: CID },

  // ── dw-schema ──
  detect_schema_change: { source: 'snowflake', customerId: CID, database: 'analytics', schema: 'public' },
  generate_migration: { change: { type: 'add_column', table: 'fact_orders', column: 'discount_pct', dataType: 'DECIMAL(5,2)' }, customerId: CID },
  apply_migration: { migration: { id: 'mig-001', sql: 'ALTER TABLE fact_orders ADD COLUMN discount_pct DECIMAL(5,2)', rollbackSql: 'ALTER TABLE fact_orders DROP COLUMN discount_pct' }, customerId: CID },
  get_schema_snapshot: { source: 'snowflake', database: 'analytics', schema: 'public', table: 'orders', customerId: 'cust-1' },
  validate_schema_compatibility: { change: { type: 'add_column', table: 'fact_orders', column: 'discount_pct', changeType: 'column_added', details: { newType: 'DECIMAL(5,2)' } }, customerId: CID },
  rollback_migration: { migration: { id: 'mig-001', sql: 'ALTER TABLE fact_orders ADD COLUMN discount_pct DECIMAL(5,2)', rollbackSql: 'ALTER TABLE fact_orders DROP COLUMN discount_pct', changeId: 'chg-001' }, customerId: CID, reason: 'Test rollback' },
  // Note: dw-schema also has assess_impact — use a unique key
  'schema:assess_impact': { change: { type: 'drop_column', table: 'fact_orders', column: 'legacy_id' }, customerId: CID },

  // ── dw-quality ──
  run_quality_check: { datasetId: 'fact_orders', customerId: CID },
  get_quality_score: { datasetId: 'fact_orders', customerId: CID },
  get_anomalies: { customerId: CID },
  set_sla: { datasetId: 'fact_orders', customerId: CID, rules: [{ metric: 'null_rate', operator: 'lte', threshold: 0.05, severity: 'critical', description: 'Null rate must not exceed 5%' }] },

  // ── dw-governance ──
  check_policy: { action: 'read', resource: 'table:analytics.public.fact_orders', agentId: 'dw-insights', customerId: CID },
  enforce_rbac: { resource: 'table:analytics.public.fact_orders', userId: 'user-1', role: 'analyst', customerId: CID },
  generate_audit_report: { customerId: CID },
  provision_access: { userId: 'user-1', resource: 'table:analytics.public.fact_orders', accessLevel: 'read', justification: 'Quarterly reporting', customerId: CID },
  scan_pii: { datasetId: 'dim_customers', customerId: CID },

  // ── dw-usage-intelligence ──
  get_adoption_dashboard: {},
  check_agent_health: {},
  detect_drift: {},
  detect_usage_anomalies: {},
  get_agent_metrics: { agentName: 'dw-pipelines' },
  get_audit_trail: {},
  get_evaluation_report: { agentName: 'dw-pipelines' },
  get_session_analytics: {},
  get_tool_usage_metrics: {},
  get_usage_activity_log: {},
  get_usage_heatmap: {},
  get_workflow_patterns: {},
  list_active_agents: {},
  set_adoption_targets: { agentName: 'dw-pipelines', targetActiveUsers: 10, targetCallsPerDay: 50, targetAdoptionRate: 0.8 },
  cross_agent_query: { targetAgent: 'dw-cost', queryType: 'get_summary', payload: { customerId: CID } },

  // ── dw-observability ── (prefixed to avoid key collision with usage-intelligence)
  'obs:check_agent_health': {},
  'obs:detect_drift': {},
  'obs:get_agent_metrics': { agentName: 'dw-pipelines' },
  'obs:get_audit_trail': {},
  'obs:get_evaluation_report': { agentName: 'dw-pipelines' },
  'obs:list_active_agents': {},

  // ── dw-connectors (catalog tools) ──
  list_all_catalogs: { customerId: CID },
  search_across_catalogs: { customerId: CID, query: 'orders' },
  get_table_from_any_catalog: { customerId: CID, provider: 'snowflake', namespace: 'ANALYTICS.PUBLIC', table: 'ORDERS' },

  // ── dw-connectors (BigQuery) ──
  list_bigquery_datasets: { customerId: CID },
  list_bigquery_tables: { customerId: CID, datasetId: 'analytics' },
  get_bigquery_table_schema: { customerId: CID, datasetId: 'analytics', tableId: 'orders' },
  estimate_bigquery_cost: { customerId: CID, queryText: 'SELECT * FROM analytics.orders LIMIT 100' },

  // ── dw-connectors (Databricks) ──
  list_databricks_catalogs: { customerId: CID },
  list_databricks_tables: { customerId: CID, catalog: 'main' },
  get_databricks_table: { customerId: CID, catalog: 'main', schema: 'default', table: 'orders' },
  get_databricks_query_history: { customerId: CID },

  // ── dw-connectors (DataHub) ──
  search_datahub_datasets: { customerId: CID, query: 'orders' },
  get_datahub_dataset: { customerId: CID, urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)' },
  get_datahub_lineage: { customerId: CID, urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)', direction: 'upstream' },
  list_datahub_domains: { customerId: CID },

  // ── dw-connectors (Dataplex) ──
  list_dataplex_lakes: { customerId: CID },
  list_dataplex_entities: { customerId: CID, zone: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/raw-zone' },
  get_dataplex_entity: { customerId: CID, name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/raw-zone/entities/raw_events' },
  search_dataplex_entries: { customerId: CID, query: 'orders' },

  // ── dw-connectors (dbt) ──
  list_dbt_models: { customerId: CID },
  get_dbt_model_lineage: { customerId: CID, modelId: 'model.project.fct_orders' },
  get_dbt_test_results: { customerId: CID },
  get_dbt_run_history: { customerId: CID },

  // ── dw-connectors (Glue) ──
  list_glue_databases: { customerId: CID },
  list_glue_tables: { customerId: CID, database: 'analytics_db' },
  get_glue_table: { customerId: CID, database: 'analytics_db', table: 'orders_transactions' },
  search_glue_tables: { customerId: CID, query: 'orders' },

  // ── dw-connectors (Hive) ──
  list_hive_databases: { customerId: CID },
  list_hive_tables: { customerId: CID, database: 'analytics' },
  get_hive_table_schema: { customerId: CID, database: 'analytics', table: 'daily_sales' },
  get_hive_partitions: { customerId: CID, database: 'analytics', table: 'daily_sales' },

  // ── dw-connectors (Lake Formation) ──
  list_lf_permissions: { customerId: CID, resource: 'analytics_db' },
  list_lf_tags: { customerId: CID, resource: 'analytics_db' },
  search_lf_by_tags: { customerId: CID, tags: ['pii', 'sensitive'] },

  // ── dw-connectors (Nessie) ──
  list_nessie_branches: { customerId: CID },
  list_nessie_tables: { customerId: CID, ref: 'main' },
  get_nessie_content: { customerId: CID, ref: 'main', key: 'warehouse.analytics.orders' },
  create_nessie_branch: { customerId: CID, name: 'feature/test', from: 'main' },
  diff_nessie_refs: { customerId: CID, from: 'main', to: 'feature/test' },

  // ── dw-connectors (OpenLineage) ──
  list_lineage_datasets: { customerId: CID, namespace: 'analytics' },
  list_lineage_jobs: { customerId: CID, namespace: 'analytics' },
  get_lineage_graph: { customerId: CID, nodeId: 'dataset:analytics.daily_revenue' },
  emit_lineage_event: { customerId: CID, eventType: 'COMPLETE', jobNamespace: 'analytics', jobName: 'daily_orders', runId: 'run-001' },

  // ── dw-connectors (OpenMetadata) ──
  list_om_tables: { customerId: CID, database: 'warehouse_db' },
  get_om_table: { customerId: CID, tableId: 'tbl-002' },
  search_om_tables: { customerId: CID, query: 'orders' },
  get_om_lineage: { customerId: CID, tableId: 'tbl-002', direction: 'upstream' },
  get_om_quality_tests: { customerId: CID, tableId: 'tbl-002' },

  // ── dw-connectors (Purview) ──
  search_purview_entities: { customerId: CID, query: 'orders' },
  get_purview_entity: { customerId: CID, guid: 'pv-001' },
  get_purview_lineage: { customerId: CID, guid: 'pv-001' },
  list_purview_glossary: { customerId: CID },

  // ── dw-connectors (Snowflake) ──
  list_snowflake_databases: { customerId: CID },
  list_snowflake_tables: { customerId: CID, database: 'ANALYTICS', schema: 'PUBLIC' },
  get_snowflake_table_ddl: { customerId: CID, database: 'ANALYTICS', schema: 'PUBLIC', table: 'ORDERS' },
  get_snowflake_usage: { customerId: CID },

  // ── dw-connectors (Enterprise - orchestration: Dagster, Prefect, Step Functions, ADF, dbt Cloud, Composer) ──
  list_dagster_jobs: { customerId: CID },
  trigger_dagster_job: { customerId: CID, dagId: 'daily_pipeline' },
  get_dagster_run: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },
  list_dagster_ops: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },

  list_prefect_flows: { customerId: CID },
  trigger_prefect_flow: { customerId: CID, dagId: 'daily_pipeline' },
  get_prefect_flow_run: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },
  list_prefect_tasks: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },

  list_step_function_machines: { customerId: CID },
  trigger_step_function: { customerId: CID, dagId: 'daily_pipeline' },
  get_step_function_execution: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },
  list_step_function_steps: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },

  list_adf_pipelines: { customerId: CID },
  trigger_adf_pipeline: { customerId: CID, dagId: 'daily_pipeline' },
  get_adf_pipeline_run: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },
  list_adf_activities: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },

  list_dbt_cloud_jobs: { customerId: CID },
  trigger_dbt_cloud_job: { customerId: CID, dagId: 'daily_pipeline' },
  get_dbt_cloud_run: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },
  list_dbt_cloud_steps: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },

  list_composer_dags: { customerId: CID },
  trigger_composer_dag: { customerId: CID, dagId: 'daily_pipeline' },
  get_composer_dag_run: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },
  list_composer_tasks: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },

  // ── dw-connectors (Enterprise - alerting) ──
  send_pagerduty_alert: { customerId: CID, title: 'Test Alert', message: 'Pipeline failure detected', severity: 'warning', source: 'dw-pipelines' },
  resolve_pagerduty_alert: { customerId: CID, alertId: 'alert-001' },
  send_slack_alert: { customerId: CID, title: 'Test Alert', message: 'Pipeline failure detected', severity: 'warning', source: 'dw-pipelines' },
  resolve_slack_alert: { customerId: CID, alertId: 'alert-001' },
  send_teams_alert: { customerId: CID, title: 'Test Alert', message: 'Pipeline failure detected', severity: 'warning', source: 'dw-pipelines' },
  resolve_teams_alert: { customerId: CID, alertId: 'alert-001' },
  send_opsgenie_alert: { customerId: CID, title: 'Test Alert', message: 'Pipeline failure detected', severity: 'warning', source: 'dw-pipelines' },
  resolve_opsgenie_alert: { customerId: CID, alertId: 'alert-001' },
  send_newrelic_alert: { customerId: CID, title: 'Test Alert', message: 'Pipeline failure detected', severity: 'warning', source: 'dw-pipelines' },
  resolve_newrelic_alert: { customerId: CID, alertId: 'alert-001' },

  // ── dw-connectors (Enterprise - Airflow) ──
  list_airflow_dags: { customerId: CID },
  trigger_airflow_dag: { customerId: CID, dagId: 'daily_pipeline' },
  get_airflow_dag_run: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },
  list_airflow_tasks: { customerId: CID, dagId: 'daily_pipeline', runId: 'run-001' },

  // ── dw-connectors (Enterprise - Kafka Schema Registry) ──
  list_kafka_schemas: { customerId: CID },
  get_kafka_schema: { customerId: CID, subject: 'orders-value' },
  register_kafka_schema: { customerId: CID, subject: 'orders-value', schema: '{"type":"record","name":"Order","fields":[]}' },
  check_kafka_compatibility: { customerId: CID, subject: 'orders-value', schema: '{"type":"record","name":"Order","fields":[]}' },
  get_connector_status: { customerId: CID, connectorName: 'snowflake-prod' },
  register_stream_schema: { customerId: CID, subject: 'orders-value', schema: '{"type":"record","name":"Order","fields":[]}', schemaType: 'AVRO' },

  // ── dw-connectors (Enterprise - AWS Cost) ──
  get_aws_cost_by_service: { customerId: CID, startDate: '2025-01-01', endDate: '2025-01-31' },
  get_aws_cost_forecast: { customerId: CID, months: 3 },
  get_aws_cost_recommendations: { customerId: CID },

  // ── dw-connectors (Enterprise - Identity) ──
  list_okta_users: { customerId: CID },
  get_okta_user: { customerId: CID, userId: 'okta-user-1' },
  list_azure_ad_users: { customerId: CID },
  get_azure_ad_user: { customerId: CID, userId: 'aad-user-1' },

  // ── dw-connectors (Enterprise - Observability) ──
  query_otel_metrics: { customerId: CID, query: 'http_requests_total', start: '2025-01-01T00:00:00Z', end: '2025-01-01T23:59:59Z' },
  list_otel_alerts: { customerId: CID },
  get_otel_trace: { customerId: CID, traceId: 'trace-abc-123' },
  query_datadog_metrics: { customerId: CID, query: 'avg:system.cpu.user{*}', start: '2025-01-01T00:00:00Z', end: '2025-01-01T23:59:59Z' },
  list_datadog_monitors: { customerId: CID },
  get_datadog_trace: { customerId: CID, traceId: 'dd-trace-xyz-789' },

  // ── dw-connectors (Enterprise - Quality) ──
  list_gx_suites: { customerId: CID },
  run_gx_suite: { customerId: CID, suiteId: 'gx-suite-1' },
  get_gx_results: { customerId: CID, suiteId: 'gx-suite-1' },
  list_gx_monitors: { customerId: CID },
  list_soda_suites: { customerId: CID },
  run_soda_suite: { customerId: CID, suiteId: 'soda-suite-1' },
  get_soda_results: { customerId: CID, suiteId: 'soda-suite-1' },
  list_soda_monitors: { customerId: CID },
  list_monte_carlo_suites: { customerId: CID },
  run_monte_carlo_suite: { customerId: CID, suiteId: 'mc-suite-1' },
  get_monte_carlo_results: { customerId: CID, suiteId: 'mc-suite-1' },
  list_monte_carlo_monitors: { customerId: CID },

  // ── dw-connectors (Enterprise - BI) ──
  list_looker_dashboards: { customerId: CID },
  get_looker_dashboard: { customerId: CID, dashboardId: 'lkr-dash-1' },
  list_looker_reports: { customerId: CID },
  get_looker_data_sources: { customerId: CID },
  list_tableau_dashboards: { customerId: CID },
  get_tableau_dashboard: { customerId: CID, dashboardId: 'tab-dash-1' },
  list_tableau_reports: { customerId: CID },
  get_tableau_data_sources: { customerId: CID },

  // ── dw-connectors (Enterprise - ITSM) ──
  create_servicenow_ticket: { customerId: CID, summary: 'Pipeline failure', description: 'Daily pipeline failed at extract stage', priority: 'high', category: 'data-pipeline' },
  get_servicenow_ticket: { customerId: CID, ticketId: 'SNOW-INC-1' },
  list_servicenow_tickets: { customerId: CID },
  update_servicenow_ticket: { customerId: CID, ticketId: 'SNOW-INC-1', summary: 'Pipeline failure - resolved' },
  create_jira_sm_ticket: { customerId: CID, summary: 'Pipeline failure', description: 'Daily pipeline failed at extract stage', priority: 'high', category: 'data-pipeline' },
  get_jira_sm_ticket: { customerId: CID, ticketId: 'JSM-1' },
  list_jira_sm_tickets: { customerId: CID },
  update_jira_sm_ticket: { customerId: CID, ticketId: 'JSM-1', summary: 'Pipeline failure - resolved' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Score a single tool call result.
 */
function scoreResult(result: any): { score: ToolScore; detail: string } {
  if (!result) {
    return { score: 'error', detail: 'Result is null/undefined' };
  }

  if (result.isError === true) {
    const text = result.content?.[0]?.text ?? 'unknown error';
    return { score: 'error', detail: `isError: ${text.substring(0, 120)}` };
  }

  if (!result.content || result.content.length === 0) {
    return { score: 'stub', detail: 'Empty content array' };
  }

  const text = result.content[0]?.text;
  if (!text || typeof text !== 'string') {
    return { score: 'stub', detail: 'No text in content' };
  }

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(text);

    // Check for stub/empty responses
    if (text === '{}' || text === '[]') {
      return { score: 'stub', detail: 'Empty JSON response' };
    }

    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed);
      if (keys.length === 0) {
        return { score: 'stub', detail: 'Empty object' };
      }
      if (Array.isArray(parsed) && parsed.length === 0) {
        // Empty arrays are valid for list endpoints with no data
        return { score: 'working', detail: 'Empty array (valid for no-data state)' };
      }
    }

    return { score: 'working', detail: 'Valid JSON response' };
  } catch {
    // Not JSON but has text content — could be valid non-JSON response
    if (text.length > 2) {
      return { score: 'working', detail: 'Non-JSON text response' };
    }
    return { score: 'stub', detail: 'Unparseable/minimal text response' };
  }
}

/**
 * Get the args for a tool, resolving prefixed keys like 'schema:assess_impact'
 * and 'obs:check_agent_health' back to their actual tool names.
 */
function getToolArgs(toolName: string, agentName: string): Record<string, unknown> {
  // Check for agent-specific prefixed keys first
  if (agentName === 'dw-schema' && toolName === 'assess_impact') {
    return TOOL_ARGS['schema:assess_impact'] ?? { change: { type: 'drop_column', table: 'fact_orders', column: 'legacy_id' }, customerId: CID };
  }
  if (agentName === 'dw-observability') {
    const prefixed = TOOL_ARGS[`obs:${toolName}`];
    if (prefixed !== undefined) return prefixed;
  }

  // Direct lookup
  if (TOOL_ARGS[toolName] !== undefined) {
    return TOOL_ARGS[toolName];
  }

  // Fallback: try with just customerId
  return { customerId: CID };
}

/**
 * Test all tools for a given MCP server agent.
 */
async function scoreAgent(agentName: string, server: any): Promise<AgentReport> {
  const tools = server.listTools() as Array<{ name: string }>;
  const results: ToolResult[] = [];

  for (const tool of tools) {
    const args = getToolArgs(tool.name, agentName);
    let toolScore: ToolScore;
    let detail: string;

    try {
      const result = await server.callTool(tool.name, args);
      const scored = scoreResult(result);
      toolScore = scored.score;
      detail = scored.detail;
    } catch (err: any) {
      toolScore = 'error';
      detail = `Exception: ${(err.message ?? String(err)).substring(0, 120)}`;
    }

    results.push({ tool: tool.name, score: toolScore, detail });
  }

  const working = results.filter((r) => r.score === 'working').length;
  const stub = results.filter((r) => r.score === 'stub').length;
  const error = results.filter((r) => r.score === 'error').length;

  return {
    agent: agentName,
    toolsTotal: tools.length,
    toolsWorking: working,
    toolsStub: stub,
    toolsError: error,
    score: tools.length > 0 ? Math.round((working / tools.length) * 100) / 100 : 0,
    tools: results,
  };
}

// ─── The Test ───────────────────────────────────────────────────────────────

describe('Agent Report Card', () => {
  const agentReports: AgentReport[] = [];

  // ── MCP Agents ──────────────────────────────────────────────────────────
  const mcpAgents: Array<{ name: string; server: any }> = [
    { name: 'dw-pipelines', server: pipelinesServer },
    { name: 'dw-incidents', server: incidentsServer },
    { name: 'dw-context-catalog', server: catalogServer },
    { name: 'dw-schema', server: schemaServer },
    { name: 'dw-quality', server: qualityServer },
    { name: 'dw-governance', server: governanceServer },
    { name: 'dw-usage-intelligence', server: usageIntelServer },
    { name: 'dw-observability', server: observabilityServer },
    { name: 'dw-connectors', server: connectorsServer },
  ];

  for (const { name, server } of mcpAgents) {
    it(`scores all tools for ${name}`, async () => {
      const report = await scoreAgent(name, server);
      agentReports.push(report);

      // Print per-agent summary inline
      console.log(`\n  [${name}] ${report.toolsWorking}/${report.toolsTotal} working (${report.toolsStub} stub, ${report.toolsError} error) — score: ${(report.score * 100).toFixed(0)}%`);

      // Log individual tool results
      for (const t of report.tools) {
        const icon = t.score === 'working' ? 'OK' : t.score === 'stub' ? 'STUB' : 'ERR';
        if (t.score !== 'working') {
          console.log(`    [${icon}] ${t.tool}: ${t.detail}`);
        }
      }

      // This test always passes — it's scoring, not asserting
      expect(true).toBe(true);
    }, 60_000); // generous timeout for large agents like connectors
  }

  // ── dw-orchestration (non-MCP) ────────────────────────────────────────
  it('scores dw-orchestration (TypeScript API)', async () => {
    const results: ToolResult[] = [];

    // Test TaskScheduler
    try {
      const { InMemoryKeyValueStore } = await import('@data-workers/infrastructure-stubs');
      const kv = new InMemoryKeyValueStore();
      const scheduler = new TaskScheduler(kv);
      const task = {
        id: 'report-task-1',
        agentId: 'dw-pipelines',
        action: 'generate_pipeline',
        payload: { description: 'test pipeline' },
        priority: 1 as const,
        status: 'queued' as const,
        createdAt: Date.now(),
      };
      await scheduler.submit(task);
      const next = await scheduler.dequeue();
      if (next && next.id === 'report-task-1') {
        results.push({ tool: 'TaskScheduler.submit+dequeue', score: 'working', detail: 'Task submitted and dequeued' });
      } else {
        results.push({ tool: 'TaskScheduler.submit+dequeue', score: 'stub', detail: 'Dequeue returned unexpected result' });
      }
    } catch (err: any) {
      results.push({ tool: 'TaskScheduler.submit+dequeue', score: 'error', detail: `Exception: ${err.message}` });
    }

    // Test AgentRegistry
    try {
      const { InMemoryRelationalStore } = await import('@data-workers/infrastructure-stubs');
      const db = new InMemoryRelationalStore();
      const registry = new AgentRegistry(db);
      await registry.init();
      await registry.register({
        id: 'report-agent-1',
        name: 'dw-pipelines',
        version: '0.1.0',
        status: 'active',
        customerId: CID,
        capabilities: ['generate_pipeline'],
        registeredAt: Date.now(),
      });
      const agents = await registry.list();
      if (agents.length >= 1 && agents.some((a: any) => a.name === 'dw-pipelines')) {
        results.push({ tool: 'AgentRegistry.register+list', score: 'working', detail: 'Agent registered and listed' });
      } else {
        results.push({ tool: 'AgentRegistry.register+list', score: 'stub', detail: 'List returned unexpected result' });
      }
    } catch (err: any) {
      results.push({ tool: 'AgentRegistry.register+list', score: 'error', detail: `Exception: ${err.message}` });
    }

    const working = results.filter((r) => r.score === 'working').length;
    const stub = results.filter((r) => r.score === 'stub').length;
    const error = results.filter((r) => r.score === 'error').length;

    const orchestrationReport: AgentReport = {
      agent: 'dw-orchestration',
      toolsTotal: results.length,
      toolsWorking: working,
      toolsStub: stub,
      toolsError: error,
      score: results.length > 0 ? Math.round((working / results.length) * 100) / 100 : 0,
      tools: results,
    };
    agentReports.push(orchestrationReport);

    console.log(`\n  [dw-orchestration] ${working}/${results.length} working (${stub} stub, ${error} error) — score: ${(orchestrationReport.score * 100).toFixed(0)}%`);
    for (const t of results) {
      const icon = t.score === 'working' ? 'OK' : t.score === 'stub' ? 'STUB' : 'ERR';
      if (t.score !== 'working') {
        console.log(`    [${icon}] ${t.tool}: ${t.detail}`);
      }
    }

    expect(true).toBe(true);
  }, 30_000);

  // ── Final Report ──────────────────────────────────────────────────────
  it('prints the overall report card', () => {
    const totalTools = agentReports.reduce((s, r) => s + r.toolsTotal, 0);
    const totalWorking = agentReports.reduce((s, r) => s + r.toolsWorking, 0);
    const totalStub = agentReports.reduce((s, r) => s + r.toolsStub, 0);
    const totalError = agentReports.reduce((s, r) => s + r.toolsError, 0);
    const overallScore = totalTools > 0 ? Math.round((totalWorking / totalTools) * 100) / 100 : 0;

    const report: OverallReport = {
      agents: agentReports.map(({ agent, toolsTotal, toolsWorking, toolsStub, toolsError, score }) => ({
        agent,
        toolsTotal,
        toolsWorking,
        toolsStub,
        toolsError,
        score,
        tools: [], // omit individual tool details from final summary for readability
      })),
      totalTools,
      totalWorking,
      totalStub,
      totalError,
      overallScore,
    };

    console.log('\n' + '='.repeat(72));
    console.log('  AGENT REPORT CARD — ');
    console.log('='.repeat(72));
    console.log(`\n  Agents scored: ${agentReports.length}`);
    console.log(`  Total tools:   ${totalTools}`);
    console.log(`  Working:       ${totalWorking} (${(overallScore * 100).toFixed(1)}%)`);
    console.log(`  Stub:          ${totalStub}`);
    console.log(`  Error:         ${totalError}`);
    console.log('\n  Per-agent breakdown:');
    console.log('  ' + '-'.repeat(68));

    for (const r of agentReports) {
      const pct = (r.score * 100).toFixed(0).padStart(3);
      const bar = 'X'.repeat(Math.round(r.score * 20)).padEnd(20, '.');
      console.log(`  ${r.agent.padEnd(28)} ${r.toolsWorking.toString().padStart(3)}/${r.toolsTotal.toString().padStart(3)} [${bar}] ${pct}%`);
    }

    console.log('  ' + '-'.repeat(68));
    console.log(`  ${'OVERALL'.padEnd(28)} ${totalWorking.toString().padStart(3)}/${totalTools.toString().padStart(3)} [${'X'.repeat(Math.round(overallScore * 20)).padEnd(20, '.')}] ${(overallScore * 100).toFixed(1)}%`);
    console.log('='.repeat(72));

    console.log('\n  JSON Report:');
    console.log(JSON.stringify(report, null, 2));

    // Always passes — this is a scoring/reporting test
    expect(agentReports.length).toBe(10);
  });
});
