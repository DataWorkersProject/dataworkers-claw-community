/**
 * Eval script: Runs all tools from dw-streaming, dw-observability,
 * dw-usage-intelligence, and dw-connectors and captures output.
 *
 * Run with: npx vitest run scripts/eval-all-agents.test.ts
 */
import { describe, it, expect } from 'vitest';

// Collect all results for final summary
const allResults: Array<{
  agent: string;
  tool: string;
  args: Record<string, unknown>;
  output: string;
  isError: boolean;
  truncated: boolean;
}> = [];

async function runTool(
  agentName: string,
  server: any,
  toolName: string,
  args: Record<string, unknown>,
) {
  const result = await server.callTool(toolName, args);
  const json = JSON.stringify(result, null, 2);
  const lines = json.split('\n');
  const truncated = lines.length > 50;
  const output = truncated ? lines.slice(0, 50).join('\n') + `\n... (${lines.length - 50} more lines)` : json;

  allResults.push({
    agent: agentName,
    tool: toolName,
    args,
    output,
    isError: !!result.isError,
    truncated,
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log(`[${agentName}] ${toolName}`);
  console.log(`ARGS: ${JSON.stringify(args)}`);
  console.log('='.repeat(70));
  console.log(output);

  return result;
}

// ── dw-observability ──────────────────────────────────────────────
describe('dw-observability', () => {
  let server: any;

  it('imports server', async () => {
    const mod = await import('../agents/dw-observability/src/index.js');
    server = mod.server ?? mod.default;
    expect(server).toBeTruthy();
  });

  it('check_agent_health', async () => {
    const r = await runTool('dw-observability', server, 'check_agent_health', { agentName: 'dw-pipelines' });
    expect(r).toBeTruthy();
  });

  it('detect_drift', async () => {
    const r = await runTool('dw-observability', server, 'detect_drift', { agentName: 'dw-pipelines', customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('get_agent_metrics', async () => {
    const r = await runTool('dw-observability', server, 'get_agent_metrics', { agentName: 'dw-pipelines' });
    expect(r).toBeTruthy();
  });

  it('get_audit_trail', async () => {
    const r = await runTool('dw-observability', server, 'get_audit_trail', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('get_evaluation_report', async () => {
    const r = await runTool('dw-observability', server, 'get_evaluation_report', { agentName: 'dw-pipelines' });
    expect(r).toBeTruthy();
  });

  it('list_active_agents', async () => {
    const r = await runTool('dw-observability', server, 'list_active_agents', {});
    expect(r).toBeTruthy();
  });
});

// ── dw-usage-intelligence ─────────────────────────────────────────
describe('dw-usage-intelligence', () => {
  let server: any;

  it('imports server', async () => {
    const mod = await import('../agents/dw-usage-intelligence/src/index.js');
    server = mod.server ?? mod.default;
    expect(server).toBeTruthy();
  });

  it('get_adoption_dashboard', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_adoption_dashboard', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('detect_drift', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'detect_drift', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('get_agent_metrics', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_agent_metrics', { agentName: 'dw-pipelines' });
    expect(r).toBeTruthy();
  });

  it('get_audit_trail', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_audit_trail', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('get_evaluation_report', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_evaluation_report', { agentName: 'dw-pipelines' });
    expect(r).toBeTruthy();
  });

  it('get_session_analytics', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_session_analytics', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('get_tool_usage_metrics', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_tool_usage_metrics', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('get_usage_activity_log', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_usage_activity_log', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('get_usage_heatmap', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_usage_heatmap', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('get_workflow_patterns', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'get_workflow_patterns', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });

  it('list_active_agents', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'list_active_agents', {});
    expect(r).toBeTruthy();
  });

  it('check_agent_health', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'check_agent_health', { agentName: 'dw-pipelines' });
    expect(r).toBeTruthy();
  });

  it('detect_usage_anomalies', async () => {
    const r = await runTool('dw-usage-intelligence', server, 'detect_usage_anomalies', { customerId: 'test-customer-1' });
    expect(r).toBeTruthy();
  });
});

// ── dw-connectors ─────────────────────────────────────────────────
describe('dw-connectors', () => {
  let server: any;

  it('imports server', async () => {
    const mod = await import('../agents/dw-connectors/src/index.js');
    server = mod.server ?? mod.default;
    expect(server).toBeTruthy();
  });

  it('list_snowflake_databases', async () => {
    const r = await runTool('dw-connectors', server, 'list_snowflake_databases', {});
    expect(r).toBeTruthy();
  });

  it('list_snowflake_tables', async () => {
    const r = await runTool('dw-connectors', server, 'list_snowflake_tables', { database: 'ANALYTICS', schema: 'PUBLIC' });
    expect(r).toBeTruthy();
  });

  it('list_bigquery_datasets', async () => {
    const r = await runTool('dw-connectors', server, 'list_bigquery_datasets', {});
    expect(r).toBeTruthy();
  });

  it('list_bigquery_tables', async () => {
    const r = await runTool('dw-connectors', server, 'list_bigquery_tables', { dataset: 'analytics' });
    expect(r).toBeTruthy();
  });

  it('list_databricks_catalogs', async () => {
    const r = await runTool('dw-connectors', server, 'list_databricks_catalogs', {});
    expect(r).toBeTruthy();
  });

  it('list_dbt_models', async () => {
    const r = await runTool('dw-connectors', server, 'list_dbt_models', {});
    expect(r).toBeTruthy();
  });

  it('get_dbt_model_lineage', async () => {
    const r = await runTool('dw-connectors', server, 'get_dbt_model_lineage', { model: 'orders' });
    expect(r).toBeTruthy();
  });

  it('search_datahub_datasets', async () => {
    const r = await runTool('dw-connectors', server, 'search_datahub_datasets', { query: 'orders' });
    expect(r).toBeTruthy();
  });
});
