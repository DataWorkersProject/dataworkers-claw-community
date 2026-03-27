/**
 * list command - List all available agents and their tools.
 */

import { AGENTS } from './init.js';

/** Known tools per agent (from codebase analysis). */
const AGENT_TOOLS: Record<string, string[]> = {
  'dw-pipelines': ['generate_pipeline', 'validate_pipeline', 'deploy_pipeline', 'list_pipeline_templates'],
  'dw-incidents': ['detect_anomaly', 'diagnose_incident', 'remediate_incident', 'get_incident_history'],
  'dw-context-catalog': ['search_catalog', 'get_lineage', 'get_column_lineage', 'classify_asset'],
  'dw-governance': ['check_compliance', 'classify_data', 'audit_access', 'enforce_policy'],
  'dw-observability': ['get_metrics', 'check_sla', 'trace_pipeline', 'alert_status'],
  'dw-orchestration': ['schedule_task', 'get_task_status', 'register_agent', 'redistribute_tasks'],
  'dw-schema': ['diff_schema', 'evolve_schema', 'snapshot_schema', 'validate_compatibility'],
  'dw-quality': ['profile_dataset', 'score_quality', 'detect_anomalies', 'validate_rules'],
  'dw-connectors': ['connect_iceberg', 'connect_polaris', 'list_connectors', 'test_connection'],
  'dw-usage-intelligence': ['analyze_usage', 'track_queries', 'recommend_indexes', 'identify_unused'],
};

export function listCommand(_args: string[]): void {
  console.log('\nData Workers Agent Swarm\n');
  console.log(`${AGENTS.length} agents available:\n`);

  for (const agent of AGENTS) {
    const tools = AGENT_TOOLS[agent.name] || [];
    console.log(`  ${agent.name}`);
    console.log(`    ${agent.description}`);
    console.log(`    Port: ${agent.port}`);
    if (tools.length > 0) {
      console.log(`    Tools: ${tools.join(', ')}`);
    }
    console.log('');
  }

  const totalTools = Object.values(AGENT_TOOLS).reduce((sum, t) => sum + t.length, 0);
  console.log(`Total: ${AGENTS.length} agents, ${totalTools} tools`);
}
