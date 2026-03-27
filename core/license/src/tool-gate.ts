/**
 * CLAW-002: License tier gating for MCP tool operations.
 *
 * Community Edition (default) = read-only tools only.
 * Pro Edition                 = read + write tools.
 * Enterprise Edition          = all tools including admin/platform ops.
 *
 * This module does NOT modify agent code. Agents import `isToolAllowed`
 * and check it before executing a tool handler.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LicenseTier = 'community' | 'pro' | 'enterprise';

export type ToolCategory = 'read' | 'write' | 'admin';

export interface ToolGateResult {
  allowed: boolean;
  tool: string;
  tier: LicenseTier;
  category: ToolCategory;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Write-operation tools (sorted by agent)
// ---------------------------------------------------------------------------

/**
 * Comprehensive registry of every write-operation tool across all agents.
 * Grouped by source agent for maintainability — the runtime uses the flat
 * Set built at the bottom of this section.
 */
const WRITE_TOOLS_BY_AGENT: Record<string, readonly string[]> = {
  // -- dw-pipelines ----------------------------------------------------------
  'dw-pipelines': [
    'deploy_pipeline',
    'generate_pipeline',      // generates AND can persist pipeline definitions
    'run_quality_tests',
  ],

  // -- dw-schema -------------------------------------------------------------
  'dw-schema': [
    'apply_migration',
    'generate_migration',
    'rollback_migration',
  ],

  // -- dw-quality ------------------------------------------------------------
  'dw-quality': [
    'set_sla',
    // run_quality_check reclassified as read — it profiles data without mutations
  ],

  // -- dw-governance ---------------------------------------------------------
  'dw-governance': [
    'provision_access',
    'enforce_rbac',
  ],

  // -- dw-connectors (enterprise tools) --------------------------------------
  'dw-connectors': [
    // Orchestration triggers
    'trigger_airflow_dag',
    'trigger_dagster_job',
    'trigger_prefect_flow',
    'trigger_step_function',
    'trigger_adf_pipeline',
    'trigger_dbt_cloud_job',
    'trigger_composer_dag',

    // Alerting / notifications
    'send_pagerduty_alert',
    'send_slack_alert',
    'send_teams_alert',
    'send_opsgenie_alert',
    'send_newrelic_alert',

    // Schema registry writes
    'register_kafka_schema',

    // Quality suite runs (write results)
    'run_gx_suite',
    'run_soda_suite',
    'run_monte_carlo_suite',

    // ITSM ticket mutations
    'create_servicenow_ticket',
    'update_servicenow_ticket',
    'create_jira_sm_ticket',
    'update_jira_sm_ticket',

    // Lineage emission
    'emit_lineage_event',

    // Nessie catalog branching
    'create_nessie_branch',

    // Alert resolution (state mutation)
    'resolve_pagerduty_alert',
    'resolve_opsgenie_alert',
    'resolve_newrelic_alert',
    'resolve_slack_alert',
    'resolve_teams_alert',

    // Kafka Connect / Schema Registry
    'get_connector_status',
    'register_stream_schema',
  ],

  // -- dw-context-catalog ----------------------------------------------------
  'dw-context-catalog': [
    'scan_pii',               // writes PII scan results
    'auto_tag_dataset',       // auto-classify datasets with tags
    'update_lineage',         // additive lineage edge management
    'generate_documentation', // generate/persist documentation for assets
    'flag_documentation_gap', // flag missing/stale documentation
    'define_business_rule',   // create business rules
    'import_tribal_knowledge', // import tribal knowledge
    'update_business_rule',   // update existing rules
    'mark_authoritative',     // mark asset as authoritative
    'revoke_authority',       // revoke authority designation
    'correct_response',       // submit corrections (Pro write)
    'flag_stale_context',     // flag stale context
    'ingest_unstructured_context', // ingest unstructured context
    'run_data_steward',       // enterprise data steward workflow
  ],

  // -- dw-ml (Pro + Enterprise tools) ---------------------------------------
  'dw-ml': [
    'train_model',
    'deploy_model',
    'create_experiment',
    'log_metrics',
    'register_model',
    'create_feature_pipeline',
    'compare_experiments',      // Enterprise
    'detect_model_drift',       // Enterprise
    'ab_test_models',           // Enterprise
  ],

  // -- dw-usage-intelligence (Pro tools) ------------------------------------
  'dw-usage-intelligence': [
    'schedule_anomaly_scan',
    'export_usage_report',
    'configure_usage_alerts',
    'set_adoption_targets',
  ],
} as const;

// ---------------------------------------------------------------------------
// Admin-only tools (enterprise tier required)
// ---------------------------------------------------------------------------

/**
 * Tools that require the enterprise tier — these perform platform-level
 * administrative operations beyond normal write access.
 */
const ADMIN_TOOLS: ReadonlySet<string> = new Set([
  'resolve_pagerduty_alert',
  'resolve_opsgenie_alert',
  'resolve_newrelic_alert',
  'resolve_slack_alert',
  'resolve_teams_alert',
  'run_data_steward',         // enterprise data steward workflow
  'ingest_unstructured_context', // enterprise unstructured context
]);

// ---------------------------------------------------------------------------
// Derived sets (computed once at module load)
// ---------------------------------------------------------------------------

const WRITE_TOOL_SET: ReadonlySet<string> = new Set(
  Object.values(WRITE_TOOLS_BY_AGENT).flat(),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current license tier (OSS edition).
 *
 * Priority:
 *   1. DW_LICENSE_TIER env var (dev/test)
 *   2. Defaults to 'community' (read-only)
 */
export function getCurrentTier(): LicenseTier {
  const raw = process.env.DW_LICENSE_TIER?.toLowerCase().trim();
  if (raw === 'pro' || raw === 'enterprise') {
    return raw;
  }
  return 'community';
}

/**
 * Classify a tool into its operation category.
 */
export function classifyTool(toolName: string): ToolCategory {
  if (ADMIN_TOOLS.has(toolName)) return 'admin';
  if (WRITE_TOOL_SET.has(toolName)) return 'write';
  return 'read';
}

/**
 * Check whether a specific tool is allowed under the given license tier.
 *
 * | Tier        | read | write | admin |
 * |-------------|------|-------|-------|
 * | community   |  Y   |  N    |   N   |
 * | pro         |  Y   |  Y    |   N   |
 * | enterprise  |  Y   |  Y    |   Y   |
 */
export function isToolAllowed(toolName: string, tier?: LicenseTier): boolean {
  const effectiveTier = tier ?? getCurrentTier();
  const category = classifyTool(toolName);

  switch (effectiveTier) {
    case 'enterprise':
      return true;
    case 'pro':
      return category !== 'admin';
    case 'community':
    default:
      return category === 'read';
  }
}

/**
 * Full gate check with structured result — useful for logging / error messages.
 */
export function gateCheck(toolName: string, tier?: LicenseTier): ToolGateResult {
  const effectiveTier = tier ?? getCurrentTier();
  const category = classifyTool(toolName);
  const allowed = isToolAllowed(toolName, effectiveTier);

  const result: ToolGateResult = { allowed, tool: toolName, tier: effectiveTier, category };

  if (!allowed) {
    const requiredTier = category === 'admin' ? 'enterprise' : 'pro';
    result.reason =
      `Tool "${toolName}" is a ${category} operation and requires the ` +
      `${requiredTier} tier or higher. Current tier: ${effectiveTier}. ` +
      `Set DW_LICENSE_TIER=${requiredTier} or upgrade your license.`;
  }

  return result;
}

/**
 * Returns the flat list of all registered write-operation tool names.
 */
export function getWriteTools(): string[] {
  return [...WRITE_TOOL_SET];
}

/**
 * Returns the flat list of all registered admin-operation tool names.
 */
export function getAdminTools(): string[] {
  return [...ADMIN_TOOLS];
}

/**
 * Returns the write-tools registry grouped by agent — useful for auditing.
 */
export function getWriteToolsByAgent(): Record<string, readonly string[]> {
  return { ...WRITE_TOOLS_BY_AGENT };
}

/**
 * Filter a list of tool names down to only those allowed for the given tier.
 * Useful for building the MCP manifest that gets served to the client.
 */
export function filterAllowedTools(toolNames: string[], tier?: LicenseTier): string[] {
  const effectiveTier = tier ?? getCurrentTier();
  return toolNames.filter((t) => isToolAllowed(t, effectiveTier));
}
