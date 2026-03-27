/**
 * Eval Framework — Tool Gating Verification
 *
 * Verifies that license tier gating works correctly:
 * - Write/admin tools are blocked under community tier (structured error, not crash)
 * - Error messages mention upgrade path / tier requirements
 * - Tools remain discoverable (listed) even when gated
 * - Read tools continue to work under community tier
 */

import {
  getWriteToolsByAgent,
  getAdminTools,
  classifyTool,
} from '../../../core/license/src/tool-gate.js';
import type { MCPServer, RawToolResult } from '../types.js';
import { runUnderTier } from './tier-runner.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GatingVerificationResult {
  /** Number of write/admin tools correctly gated under community tier */
  gatedCorrectly: number;
  /** Total number of write tools checked */
  totalWriteTools: number;
  /** Number of read tools that work under community tier */
  readToolsWork: number;
  /** Total number of read tools checked */
  totalReadTools: number;
  /** Score (0-100) for quality of gating error messages */
  messagingScore: number;
  /** Per-tool details */
  details: ToolGatingDetail[];
}

export interface ToolGatingDetail {
  agent: string;
  tool: string;
  category: 'read' | 'write' | 'admin';
  communityAllowed: boolean;
  returnedError: boolean;
  mentionsUpgrade: boolean;
  discoverable: boolean;
  note: string;
}

// ---------------------------------------------------------------------------
// Gating message detection
// ---------------------------------------------------------------------------

const UPGRADE_KEYWORDS = [
  'upgrade',
  'tier',
  'pro',
  'enterprise',
  'license',
  'requires',
  'not available',
  'gated',
  'write operation',
  'admin operation',
  'DW_LICENSE_TIER',
];

function mentionsUpgrade(result: RawToolResult): boolean {
  if (!result.content) return false;
  const text = result.content.map((c) => c.text).join(' ').toLowerCase();
  return UPGRADE_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

function isErrorResult(result: RawToolResult): boolean {
  if (result.isError === true) return true;
  if (!result.content) return false;
  const text = result.content.map((c) => c.text).join(' ').toLowerCase();
  return text.includes('error') || text.includes('not allowed') || text.includes('denied');
}

// ---------------------------------------------------------------------------
// Default test args per tool (minimal valid-looking arguments)
// ---------------------------------------------------------------------------

function getDefaultArgs(toolName: string): Record<string, unknown> {
  // Provide minimal plausible arguments so the tool reaches the gating
  // check before argument validation. Most gated tools check the license
  // tier before deep-validating inputs.
  const common: Record<string, Record<string, unknown>> = {
    deploy_pipeline: { pipeline: 'test', target: 'dev' },
    generate_pipeline: { source: 'test_table' },
    run_quality_tests: { dataset: 'test' },
    apply_migration: { migration: 'v1' },
    generate_migration: { description: 'test' },
    rollback_migration: { migration: 'v1' },
    set_sla: { dataset: 'test', sla: '99.9' },
    provision_access: { user: 'test', resource: 'test' },
    enforce_rbac: { policy: 'test' },
    configure_stream: { stream: 'test' },
    run_parallel_comparison: { source: 'a', target: 'b' },
    validate_migration: { migration: 'test' },
    recommend_archival: { dataset: 'test' },
    trigger_airflow_dag: { dag_id: 'test' },
    trigger_dagster_job: { job: 'test' },
    trigger_prefect_flow: { flow: 'test' },
    trigger_step_function: { arn: 'test' },
    trigger_adf_pipeline: { pipeline: 'test' },
    trigger_dbt_cloud_job: { job_id: 1 },
    trigger_composer_dag: { dag_id: 'test' },
    send_pagerduty_alert: { message: 'test' },
    send_slack_alert: { message: 'test' },
    send_teams_alert: { message: 'test' },
    send_opsgenie_alert: { message: 'test' },
    send_newrelic_alert: { message: 'test' },
    register_kafka_schema: { subject: 'test', schema: '{}' },
    run_gx_suite: { suite: 'test' },
    run_soda_suite: { suite: 'test' },
    run_monte_carlo_suite: { suite: 'test' },
    create_servicenow_ticket: { title: 'test' },
    update_servicenow_ticket: { id: 'test', status: 'open' },
    create_jira_sm_ticket: { summary: 'test' },
    update_jira_sm_ticket: { key: 'TEST-1', status: 'open' },
    emit_lineage_event: { source: 'a', target: 'b' },
    create_nessie_branch: { branch: 'test' },
    resolve_pagerduty_alert: { id: 'test' },
    resolve_opsgenie_alert: { id: 'test' },
    resolve_newrelic_alert: { id: 'test' },
    resolve_slack_alert: { id: 'test' },
    resolve_teams_alert: { id: 'test' },
    get_connector_status: { connector: 'test' },
    register_stream_schema: { subject: 'test', schema: '{}' },
    schedule_insight: { query: 'test', cron: '0 * * * *' },
    create_alert: { metric: 'test', threshold: 100 },
    export_insight: { insight_id: 'test' },
    scan_pii: { dataset: 'test' },
    auto_tag_dataset: { dataset: 'test' },
    update_lineage: { source: 'a', target: 'b' },
    generate_documentation: { asset: 'test' },
    flag_documentation_gap: { asset: 'test' },
    define_business_rule: { name: 'test', rule: 'test' },
    import_tribal_knowledge: { knowledge: 'test' },
    update_business_rule: { id: 'test', rule: 'test' },
    mark_authoritative: { asset: 'test' },
    revoke_authority: { asset: 'test' },
    correct_response: { id: 'test', correction: 'test' },
    flag_stale_context: { asset: 'test' },
    ingest_unstructured_context: { content: 'test' },
    run_data_steward: { workflow: 'test' },
    train_model: { dataset: 'test', model_type: 'classification' },
    deploy_model: { model_id: 'test' },
    create_experiment: { name: 'test' },
    log_metrics: { experiment: 'test', metrics: {} },
    register_model: { name: 'test', path: '/test' },
    create_feature_pipeline: { features: ['col1'] },
    compare_experiments: { experiments: ['a', 'b'] },
    detect_model_drift: { model_id: 'test' },
    ab_test_models: { model_a: 'a', model_b: 'b' },
    schedule_anomaly_scan: { dataset: 'test' },
    export_usage_report: { format: 'json' },
    configure_usage_alerts: { metric: 'queries', threshold: 100 },
    set_adoption_targets: { target: 80 },
  };

  return common[toolName] ?? {};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify that tool gating works correctly across all agents.
 *
 * For each write/admin tool: calls it under community tier and verifies a
 * structured error is returned with an upgrade message.
 *
 * For each read tool: calls it under community tier and verifies success.
 *
 * @param servers - Map of agent name to MCP server instance
 * @returns GatingVerificationResult with counts and per-tool details
 */
export async function verifyToolGating(
  servers: Record<string, MCPServer>,
): Promise<GatingVerificationResult> {
  const writeToolsByAgent = getWriteToolsByAgent();
  const adminToolSet = new Set(getAdminTools());
  const details: ToolGatingDetail[] = [];

  let gatedCorrectly = 0;
  let totalWriteTools = 0;
  let readToolsWork = 0;
  let totalReadTools = 0;
  let messagingHits = 0;
  let messagingChecks = 0;

  // ---- Verify write/admin tools are gated under community ----
  for (const [agent, tools] of Object.entries(writeToolsByAgent)) {
    const server = servers[agent];
    if (!server) {
      // Agent not available (e.g., dw-ml in OSS). Record as skipped.
      for (const tool of tools) {
        details.push({
          agent,
          tool,
          category: adminToolSet.has(tool) ? 'admin' : 'write',
          communityAllowed: false,
          returnedError: false,
          mentionsUpgrade: false,
          discoverable: false,
          note: `Agent "${agent}" server not provided (expected if OSS)`,
        });
      }
      continue;
    }

    for (const tool of tools) {
      totalWriteTools++;
      const category = adminToolSet.has(tool) ? 'admin' : 'write';

      // Check discoverability — tool should still be listed
      const listedTools = server.listTools();
      const discoverable = listedTools.some((t) => t.name === tool);

      // Call tool under community tier
      const tierResult = await runUnderTier('community', async () => {
        return server.callTool(tool, getDefaultArgs(tool));
      });

      const callResult = tierResult.result as RawToolResult | undefined;
      const returned = callResult ?? { isError: false, content: [] };
      const gotError = isErrorResult(returned);
      const gotUpgradeMsg = mentionsUpgrade(returned);

      if (gotError) gatedCorrectly++;
      messagingChecks++;
      if (gotUpgradeMsg) messagingHits++;

      details.push({
        agent,
        tool,
        category,
        communityAllowed: !gotError,
        returnedError: gotError,
        mentionsUpgrade: gotUpgradeMsg,
        discoverable,
        note: gotError
          ? gotUpgradeMsg
            ? 'Correctly gated with clear upgrade message'
            : 'Gated but upgrade message missing/unclear'
          : 'NOT GATED — write tool accessible under community tier',
      });
    }
  }

  // ---- Verify read tools work under community ----
  for (const [agent, server] of Object.entries(servers)) {
    const listedTools = server.listTools();

    for (const { name: tool } of listedTools) {
      const cat = classifyTool(tool);
      if (cat !== 'read') continue;

      totalReadTools++;

      const tierResult = await runUnderTier('community', async () => {
        return server.callTool(tool, getDefaultArgs(tool));
      });

      const callResult = tierResult.result as RawToolResult | undefined;
      // A read tool "works" if it does not return a gating error.
      // It may still fail for other reasons (missing infra, etc.) — that's ok.
      const returned = callResult ?? { isError: false, content: [] };
      const looksGated = mentionsUpgrade(returned) && isErrorResult(returned);

      if (!looksGated) readToolsWork++;

      details.push({
        agent,
        tool,
        category: 'read',
        communityAllowed: !looksGated,
        returnedError: isErrorResult(returned),
        mentionsUpgrade: mentionsUpgrade(returned),
        discoverable: true,
        note: looksGated
          ? 'READ TOOL INCORRECTLY GATED — should be available in community'
          : tierResult.error
            ? `Read tool returned infra error (not a gating issue): ${tierResult.error}`
            : 'Read tool accessible under community tier',
      });
    }
  }

  const messagingScore =
    messagingChecks > 0 ? Math.round((messagingHits / messagingChecks) * 100) : 100;

  return {
    gatedCorrectly,
    totalWriteTools,
    readToolsWork,
    totalReadTools,
    messagingScore,
    details,
  };
}
