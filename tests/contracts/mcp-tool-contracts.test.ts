/**
 * MCP Tool Contract Tests
 *
 * Verifies all 48 MCP tools across 12 agents have correct tool registration,
 * input schemas, and produce valid output.
 */

import { describe, it, expect } from 'vitest';
import { server as catalogServer } from '../../agents/dw-context-catalog/src/index.js';
import { server as governanceServer } from '../../agents/dw-governance/src/index.js';
import { server as incidentsServer } from '../../agents/dw-incidents/src/index.js';
import { server as observabilityServer } from '../../agents/dw-observability/src/index.js';
import { server as pipelinesServer } from '../../agents/dw-pipelines/src/index.js';
import { server as qualityServer } from '../../agents/dw-quality/src/index.js';
import { server as schemaServer } from '../../agents/dw-schema/src/index.js';
import { server as usageServer } from '../../agents/dw-usage-intelligence/src/index.js';

// ── Minimal valid args per tool ──

const toolArgs: Record<string, Record<string, unknown>> = {
  // dw-context-catalog
  search_datasets: { customerId: 'cust-1' },
  get_lineage: { datasetId: 'orders', customerId: 'cust-1' },
  resolve_metric: { metricName: 'revenue', customerId: 'cust-1' },
  list_semantic_definitions: { customerId: 'cust-1' },
  get_documentation: { datasetId: 'orders', customerId: 'cust-1' },
  check_freshness: { datasetId: 'orders', customerId: 'cust-1' },
  get_context: { customerId: 'cust-1' },
  assess_impact: { datasetId: 'orders', customerId: 'cust-1' },

  // dw-cost
  find_unused_data: { customerId: 'cust-1' },
  estimate_savings: { customerId: 'cust-1' },
  recommend_archival: { customerId: 'cust-1' },
  get_cost_dashboard: { customerId: 'cust-1' },

  // dw-governance
  check_policy: { action: 'read', resource: 'orders', agentId: 'dw-pipelines', customerId: 'cust-1' },
  provision_access: { userId: 'user-1', resource: 'orders', accessLevel: 'read', justification: 'test', customerId: 'cust-1' },
  scan_pii: { datasetId: 'customer_notes', customerId: 'cust-1' },
  generate_audit_report: { customerId: 'cust-1' },
  enforce_rbac: { resource: 'orders', userId: 'user-1', role: 'viewer', customerId: 'cust-1' },

  // dw-incidents
  diagnose_incident: { incidentId: 'test', customerId: 'cust-1' },
  get_root_cause: { incidentId: 'test', incidentType: 'schema_change', affectedResources: ['orders'], customerId: 'cust-1' },
  remediate: { incidentId: 'test', customerId: 'cust-1' },
  get_incident_history: { customerId: 'cust-1' },

  // dw-insights
  query_data_nl: { customerId: 'cust-1' },
  generate_insight: { customerId: 'cust-1' },
  explain_anomaly: { customerId: 'cust-1' },

  // dw-migration
  assess_migration: { sourceSystem: 'postgres', targetSystem: 'snowflake', customerId: 'cust-1' },
  translate_sql: { sql: 'SELECT 1', sourceDialect: 'postgres', targetDialect: 'snowflake', customerId: 'cust-1' },
  validate_migration: { migrationId: 'test', customerId: 'cust-1' },
  run_parallel_comparison: { migrationId: 'test', customerId: 'cust-1' },

  // dw-observability
  get_agent_metrics: { customerId: 'cust-1' },
  get_audit_trail: { customerId: 'cust-1' },
  check_agent_health: { customerId: 'cust-1' },
  detect_drift: { customerId: 'cust-1' },
  get_evaluation_report: { customerId: 'cust-1' },
  list_active_agents: { customerId: 'cust-1' },

  // dw-pipelines
  generate_pipeline: { description: 'ETL from postgres to snowflake', customerId: 'cust-1' },
  validate_pipeline: { pipelineSpec: { name: 'test', tasks: [], dag: { nodes: [], edges: [] } }, customerId: 'cust-1' },
  deploy_pipeline: { pipelineId: 'test-pipe', customerId: 'cust-1' },
  list_pipeline_templates: { customerId: 'cust-1' },

  // dw-quality
  run_quality_check: { datasetId: 'orders', customerId: 'cust-1' },
  get_quality_score: { datasetId: 'orders', customerId: 'cust-1' },
  set_sla: { datasetId: 'orders', customerId: 'cust-1', rules: [{ metric: 'freshness', operator: 'lte', threshold: 24, severity: 'warning', description: 'test' }] },
  get_anomalies: { customerId: 'cust-1' },

  // dw-schema
  detect_schema_change: { datasetId: 'orders', customerId: 'cust-1' },
  assess_impact: { datasetId: 'orders', customerId: 'cust-1' },
  generate_migration: { datasetId: 'orders', customerId: 'cust-1' },
  apply_migration: { migrationId: 'test', customerId: 'cust-1' },

  // dw-streaming
  configure_stream: { streamId: 'test', customerId: 'cust-1' },
  monitor_lag: { customerId: 'cust-1' },
  get_stream_health: { customerId: 'cust-1' },
  get_recommendations: { customerId: 'cust-1' },

  // dw-usage-intelligence
  get_tool_usage_metrics: { customerId: 'cust-1' },
  get_usage_activity_log: { customerId: 'cust-1' },
  get_adoption_dashboard: { customerId: 'cust-1' },
  detect_usage_anomalies: { customerId: 'cust-1' },
  get_workflow_patterns: { customerId: 'cust-1' },
  get_usage_heatmap: { customerId: 'cust-1' },
  get_session_analytics: { customerId: 'cust-1' },
};

// ── Helper to get args for a tool ──

function argsFor(toolName: string): Record<string, unknown> {
  return toolArgs[toolName] ?? { customerId: 'cust-1' };
}

// ── Helper to run contract tests for one agent ──

function describeAgentContract(
  agentName: string,
  server: { listTools: () => { name: string; description: string; inputSchema: Record<string, unknown> }[]; callTool: (name: string, args: Record<string, unknown>) => Promise<{ content: { type: string; text?: string }[]; isError?: boolean }> },
  expectedTools: string[],
) {
  describe(`${agentName} contracts`, () => {
    it('registers all expected tools', () => {
      const tools = server.listTools();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toEqual(expect.arrayContaining(expectedTools));
    });

    for (const toolName of expectedTools) {
      describe(toolName, () => {
        it('has a non-empty description', () => {
          const tools = server.listTools();
          const tool = tools.find((t) => t.name === toolName);
          expect(tool).toBeDefined();
          expect(tool!.description.length).toBeGreaterThan(0);
        });

        it('has an inputSchema with type object', () => {
          const tools = server.listTools();
          const tool = tools.find((t) => t.name === toolName);
          expect(tool).toBeDefined();
          expect(tool!.inputSchema.type).toBe('object');
        });

        it('returns valid response', async () => {
          const args = argsFor(toolName);
          const result = await server.callTool(toolName, args);
          expect(result.content).toBeDefined();
          expect(result.content.length).toBeGreaterThan(0);
          expect(result.content[0].type).toBe('text');
          // Should be parseable JSON (or isError)
          const parsed = JSON.parse(result.content[0].text!);
          expect(parsed).toBeDefined();
        });
      });
    }
  });
}

// ── 1. dw-context-catalog (8 tools) ──

describeAgentContract('dw-context-catalog', catalogServer, [
  'search_datasets',
  'get_lineage',
  'resolve_metric',
  'list_semantic_definitions',
  'get_documentation',
  'check_freshness',
  'get_context',
  'assess_impact',
]);

// ── 2. dw-governance (5 tools) ──

describeAgentContract('dw-governance', governanceServer, [
  'check_policy',
  'provision_access',
  'scan_pii',
  'generate_audit_report',
  'enforce_rbac',
]);

// ── 4. dw-incidents (4 tools) ──

describeAgentContract('dw-incidents', incidentsServer, [
  'diagnose_incident',
  'get_root_cause',
  'remediate',
  'get_incident_history',
]);

// ── 5. dw-observability (6 tools) ──

describeAgentContract('dw-observability', observabilityServer, [
  'get_agent_metrics',
  'get_audit_trail',
  'check_agent_health',
  'detect_drift',
  'get_evaluation_report',
  'list_active_agents',
]);

// ── 8. dw-pipelines (4 tools) ──

describeAgentContract('dw-pipelines', pipelinesServer, [
  'generate_pipeline',
  'validate_pipeline',
  'deploy_pipeline',
  'list_pipeline_templates',
]);

// ── 9. dw-quality (4 tools) ──

describeAgentContract('dw-quality', qualityServer, [
  'run_quality_check',
  'get_quality_score',
  'set_sla',
  'get_anomalies',
]);

// ── 10. dw-schema (4 tools) ──

describeAgentContract('dw-schema', schemaServer, [
  'detect_schema_change',
  'assess_impact',
  'generate_migration',
  'apply_migration',
]);

// ── 9. dw-usage-intelligence (13 tools) ──

describeAgentContract('dw-usage-intelligence', usageServer, [
  'get_tool_usage_metrics',
  'get_usage_activity_log',
  'get_adoption_dashboard',
  'detect_usage_anomalies',
  'get_workflow_patterns',
  'get_usage_heatmap',
  'get_session_analytics',
  'get_agent_metrics',
  'get_audit_trail',
  'check_agent_health',
  'detect_drift',
  'get_evaluation_report',
  'list_active_agents',
]);
