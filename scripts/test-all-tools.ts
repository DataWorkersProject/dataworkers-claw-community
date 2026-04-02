#!/usr/bin/env npx tsx
/**
 * Comprehensive MCP Tool Testing Script
 *
 * Imports every MCP agent, discovers all tools, invokes each one,
 * and produces a JSON + human-readable report.
 *
 * Usage: DW_LICENSE_TIER=enterprise npx tsx scripts/test-all-tools.ts
 */

// Must set env BEFORE any imports so tool gates + transports read them
process.env.DW_LICENSE_TIER = 'enterprise';
// Don't set DW_HEALTH_PORT — it starts a real HTTP server per agent and ports collide.
// Instead, agents will start stdio transport which is harmless in this context.
// Suppress stdio readline close → process.exit by patching process.exit temporarily.
const _origExit = process.exit;
(process as any).exit = (code?: number) => {
  // Swallow exit(0) from stdio transport readline close
  if (code === 0) return undefined as never;
  return _origExit(code);
};

interface ToolResult {
  name: string;
  hasDescription: boolean;
  hasInputSchema: boolean;
  callResult: 'pass' | 'fail' | 'error' | 'timeout';
  isError: boolean;
  responsePreview: string;
  error?: string;
  durationMs: number;
}

interface AgentResult {
  name: string;
  loaded: boolean;
  loadError?: string;
  toolCount: number;
  tools: ToolResult[];
}

interface Report {
  repoName: string;
  timestamp: string;
  summary: {
    totalAgents: number;
    loadedAgents: number;
    failedAgents: number;
    totalTools: number;
    passedTools: number;
    failedTools: number;
    errorTools: number;
    timeoutTools: number;
  };
  agents: AgentResult[];
}

const AGENTS = [
  'dw-context-catalog',
  'dw-connectors',
  'dw-cost',
  'dw-governance',
  'dw-incidents',
  'dw-insights',
  'dw-migration',
  'dw-ml',
  'dw-observability',
  'dw-pipelines',
  'dw-quality',
  'dw-schema',
  'dw-streaming',
  'dw-usage-intelligence',
  // dw-orchestration excluded: internal service, not an MCP agent
];

// Per-tool argument overrides — when a tool needs specific arg shapes
const TOOL_ARG_OVERRIDES: Record<string, Record<string, unknown>> = {
  // Schema tools
  assess_impact: { change: { id: 'chg-1', customerId: 'cust-1', source: 'snowflake', database: 'analytics', schema: 'public', table: 'orders', changeType: 'column_added', severity: 'non-breaking', details: { column: 'test_col', newType: 'TEXT' } } },
  apply_migration: { migration: { id: 'mig-1', changeId: 'chg-1', customerId: 'cust-1', status: 'pending', forwardSql: 'ALTER TABLE analytics.public.orders ADD COLUMN test_col TEXT', rollbackSql: 'ALTER TABLE analytics.public.orders DROP COLUMN test_col', affectedSystems: ['analytics'], backwardCompatible: true, estimatedEffortHours: 0.5 } },
  rollback_migration: { migration: { id: 'mig-1', changeId: 'chg-1', customerId: 'cust-1', status: 'deployed', forwardSql: 'ALTER TABLE analytics.public.orders ADD COLUMN test_col TEXT', rollbackSql: 'ALTER TABLE analytics.public.orders DROP COLUMN test_col', affectedSystems: ['analytics'], backwardCompatible: true, estimatedEffortHours: 0.5 } },
  get_schema_snapshot: { source: 'snowflake', database: 'ANALYTICS', schema: 'PUBLIC', table: 'ORDERS' },
  validate_schema_compatibility: { change: { id: 'chg-1', customerId: 'cust-1', source: 'snowflake', database: 'analytics', schema: 'public', table: 'orders', changeType: 'column_added', severity: 'non-breaking', details: { column: 'test_col', newType: 'TEXT' } } },
  // Insights tools
  query_data_nl: { question: 'What is total revenue by month?' },
  generate_insight: { sql: 'SELECT date, amount FROM revenue_daily', results: [{ date: '2025-01-01', amount: 1000 }, { date: '2025-02-01', amount: 1200 }, { date: '2025-03-01', amount: 1100 }] },
  export_insight: { results: [{ date: '2025-01-01', amount: 1000 }, { date: '2025-02-01', amount: 1200 }], format: 'csv' },
  // Context Catalog tools
  explain_table: { tableIdentifier: 'orders' },
  blast_radius_analysis: { assetId: 'tbl-1', changeType: 'column_drop', columnName: 'status' },
  correlate_metadata: { assetId: 'tbl-1' },
  import_tribal_knowledge: { entries: [{ content: 'The orders table is the source of truth for all order data', tags: ['orders', 'sot'] }] },
  update_business_rule: { ruleId: 'rule-1', description: 'Updated rule for testing' },
  // ML tools
  evaluate_model: { model_id: 'model-churn-xgb-001', dataset_id: 'ds-churn-001' },
  compare_experiments: { experiment_ids: ['exp-churn-001'] },
  log_metrics: { experiment_id: 'exp-churn-001', run_id: 'run-001', metrics: [{ name: 'accuracy', value: 0.95 }] },
  create_feature_pipeline: { name: 'test-pipeline', dataset_id: 'ds-churn-001', transforms: [{ column: 'age', type: 'normalize', outputColumn: 'age_normalized' }] },
  materialize_features: { pipeline_id: 'fp-churn-001' },
  detect_model_drift: { model_id: 'model-churn-xgb-001', baseline_dataset_id: 'ds-churn-001' },
  ab_test_models: { model_a_id: 'model-churn-xgb-001', model_b_id: 'model-revenue-lgbm-001', dataset_id: 'ds-churn-001' },
  model_serve: { model_id: 'model-churn-xgb-001', platform: 'seldon' },
  get_model_versions: { model_name: 'churn-predictor' },
  // Streaming
  get_stream_health: { topology: 'topo-orders-cdc' },
  // Connector-specific database overrides
  list_glue_tables: { database: 'analytics_db' },
  get_glue_table: { database: 'analytics_db', table: 'orders' },
  list_hive_tables: { database: 'default' },
  get_hive_table_schema: { database: 'default', table: 'customers' },
  list_om_tables: { database: 'warehouse_db' },
  get_om_table: { tableId: 'tbl-001' },
  // Nessie
  list_nessie_tables: { ref: 'main' },
  get_nessie_content: { ref: 'main', key: 'analytics.customers' },
  create_nessie_branch: { name: 'test-branch', from: 'main' },
  diff_nessie_refs: { from: 'main', to: 'develop' },
  // Dataplex
  list_dataplex_entities: { zone: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone' },
  get_dataplex_entity: { name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone/entities/orders' },
  // DataHub
  get_datahub_dataset: { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)' },
  get_datahub_lineage: { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)', direction: 'downstream' },
  // Purview
  get_purview_entity: { guid: 'pv-001' },
  // OpenLineage
  get_lineage_graph: { namespace: 'default', jobName: 'etl_orders' },
  list_lineage_datasets: { namespace: 'default' },
  // Catalog registry
  get_table_from_any_catalog: { provider: 'snowflake', database: 'ANALYTICS', schema: 'PUBLIC', table: 'ORDERS' },
};

// Default args for common required fields
function generateArgs(toolName: string, inputSchema: Record<string, unknown>): Record<string, unknown> {
  const overrides = TOOL_ARG_OVERRIDES[toolName] || {};
  const args: Record<string, unknown> = { customerId: 'cust-1', ...overrides };
  const properties = (inputSchema as any)?.properties || {};
  const required: string[] = (inputSchema as any)?.required || [];

  for (const field of required) {
    if (args[field] !== undefined) continue;
    const prop = properties[field] || {};
    switch (prop.type) {
      case 'string':
        // Smart defaults for known field names — matched to actual seed data IDs
        if (field === 'datasetId') args[field] = 'orders';
        else if (field === 'pipelineId') args[field] = 'test-pipe';
        else if (field === 'incidentId') args[field] = 'inc-test';
        else if (field === 'migrationId') args[field] = 'mig-test';
        else if (field === 'streamId') args[field] = 'topo-orders-cdc';
        else if (field === 'metricName') args[field] = 'revenue';
        else if (field === 'resource') args[field] = 'orders';
        else if (field === 'action') args[field] = 'read';
        else if (field === 'agentId') args[field] = 'dw-pipelines';
        else if (field === 'userId') args[field] = 'user-001';
        else if (field === 'accessLevel') args[field] = 'read';
        else if (field === 'justification') args[field] = 'testing';
        else if (field === 'role') args[field] = 'viewer';
        else if (field === 'description') args[field] = 'ETL from postgres to snowflake';
        else if (field === 'sql') args[field] = 'SELECT 1';
        else if (field === 'sourceDialect' || field === 'sourceSystem') args[field] = 'postgresql';
        else if (field === 'targetDialect' || field === 'targetSystem') args[field] = 'snowflake';
        else if (field === 'incidentType') args[field] = 'schema_change';
        else if (field === 'database') args[field] = 'ANALYTICS';
        else if (field === 'schema') args[field] = 'PUBLIC';
        else if (field === 'table') args[field] = 'orders';
        else if (field === 'connectorId') args[field] = 'snowflake';
        else if (field === 'tableIdentifier') args[field] = 'orders';
        else if (field === 'assetId') args[field] = 'tbl-1';
        else if (field === 'sourceDatasetId') args[field] = 'orders';
        else if (field === 'targetDatasetId') args[field] = 'customers';
        else if (field === 'changeType') args[field] = 'schema_change';
        else if (field === 'ruleId') args[field] = 'rule-1';
        else if (field === 'model_id' || field === 'modelId') args[field] = 'model-churn-xgb-001';
        else if (field === 'dataset_id') args[field] = 'ds-churn-001';
        else if (field === 'query') args[field] = 'SELECT * FROM orders LIMIT 10';
        else if (field === 'migrationSql') args[field] = 'ALTER TABLE orders ADD COLUMN test_col TEXT';
        else if (field === 'experimentId' || field === 'experiment_id') args[field] = 'exp-churn-001';
        else if (field === 'featurePipelineId') args[field] = 'fp-churn-001';
        else if (field === 'deploymentId') args[field] = 'deploy-churn-001';
        else if (field === 'dagId') args[field] = 'daily_pipeline';
        else if (field === 'runId') args[field] = 'run-001';
        else if (field === 'alertId') args[field] = 'alert-001';
        else if (field === 'subject') args[field] = 'orders-value';
        else if (field === 'traceId') args[field] = 'trace-001';
        else if (field === 'groupId') args[field] = 'group-001';
        else if (field === 'guid') args[field] = 'pv-001';
        else if (field === 'urn') args[field] = 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)';
        else if (field === 'direction') args[field] = 'downstream';
        else if (field === 'namespace') args[field] = 'default';
        else if (field === 'jobName') args[field] = 'etl_orders';
        else if (field === 'ref') args[field] = 'main';
        else if (field === 'from') args[field] = 'main';
        else if (field === 'to') args[field] = 'develop';
        else if (field === 'key') args[field] = 'analytics.customers';
        else if (field === 'catalog') args[field] = 'main';
        else if (field === 'provider') args[field] = 'snowflake';
        else if (field === 'tableId') args[field] = 'tbl-001';
        else if (field === 'topology') args[field] = 'topo-orders-cdc';
        else if (field === 'pipeline_id') args[field] = 'fp-churn-001';
        else if (field === 'baseline_dataset_id') args[field] = 'ds-churn-001';
        else if (field === 'model_a_id') args[field] = 'model-churn-xgb-001';
        else if (field === 'model_b_id') args[field] = 'model-revenue-lgbm-001';
        else if (field === 'model_name') args[field] = 'churn-predictor';
        else if (field === 'suiteId') args[field] = 'gx-suite-1';
        else if (field === 'dashboardId') args[field] = 'dash-001';
        else if (field === 'ticketId') args[field] = 'INC0001';
        else if (field === 'question') args[field] = 'What is total revenue by month?';
        else if (field === 'format') args[field] = 'csv';
        else if (field === 'platform') args[field] = 'seldon';
        else args[field] = 'test';
        break;
      case 'number':
      case 'integer':
        args[field] = 1;
        break;
      case 'boolean':
        args[field] = true;
        break;
      case 'array':
        if (field === 'affectedResources') args[field] = ['orders'];
        else if (field === 'rules') args[field] = [{ metric: 'freshness', operator: 'lte', threshold: 24, severity: 'warning', description: 'test' }];
        else if (field === 'metrics') args[field] = [{ name: 'accuracy', value: 0.95 }];
        else if (field === 'results') args[field] = [{ date: '2025-01-01', amount: 1000 }, { date: '2025-02-01', amount: 1200 }];
        else if (field === 'entries') args[field] = [{ content: 'The orders table is the source of truth', tags: ['orders'] }];
        else if (field === 'transforms') args[field] = [{ column: 'age', type: 'normalize', outputColumn: 'age_normalized' }];
        else if (field === 'experiment_ids') args[field] = ['exp-churn-001'];
        else args[field] = [];
        break;
      case 'object':
        if (field === 'pipelineSpec') args[field] = { name: 'test', tasks: [], dag: { nodes: [], edges: [] } };
        else if (field === 'config') args[field] = {};
        else if (field === 'change') args[field] = { id: 'chg-1', customerId: 'cust-1', source: 'snowflake', database: 'analytics', schema: 'public', table: 'orders', changeType: 'column_added', severity: 'non-breaking', details: { column: 'test_col', newType: 'TEXT' } };
        else if (field === 'migration') args[field] = { id: 'mig-1', changeId: 'chg-1', customerId: 'cust-1', status: 'pending', forwardSql: 'ALTER TABLE orders ADD COLUMN test_col TEXT', rollbackSql: 'ALTER TABLE orders DROP COLUMN test_col', affectedSystems: ['analytics'], backwardCompatible: true, estimatedEffortHours: 0.5 };
        else args[field] = {};
        break;
      default:
        args[field] = 'test';
    }
  }
  return args;
}

async function callWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function testAgent(agentName: string): Promise<AgentResult> {
  const result: AgentResult = {
    name: agentName,
    loaded: false,
    toolCount: 0,
    tools: [],
  };

  // Dynamic import — use absolute path resolved from this script's location
  let server: any;
  try {
    const agentPath = new URL(`../agents/${agentName}/src/index.js`, import.meta.url).href;
    const mod = await import(agentPath);
    server = mod.server || mod.default;
    if (!server || typeof server.listTools !== 'function') {
      result.loadError = 'No server export with listTools() found';
      return result;
    }
    result.loaded = true;
  } catch (e: any) {
    result.loadError = e.message?.slice(0, 300) || String(e);
    return result;
  }

  // Discover tools
  const tools = server.listTools();
  result.toolCount = tools.length;

  // Test each tool
  for (const tool of tools) {
    const toolResult: ToolResult = {
      name: tool.name,
      hasDescription: typeof tool.description === 'string' && tool.description.length > 0,
      hasInputSchema: tool.inputSchema?.type === 'object',
      callResult: 'error',
      isError: false,
      responsePreview: '',
      durationMs: 0,
    };

    const args = generateArgs(tool.name, tool.inputSchema || {});
    const start = performance.now();

    try {
      const response = await callWithTimeout(
        () => server.callTool(tool.name, args),
        10_000
      );
      toolResult.durationMs = Math.round(performance.now() - start);

      if (response?.content?.[0]?.type === 'text') {
        const text = response.content[0].text;
        try {
          JSON.parse(text);
          toolResult.callResult = response.isError ? 'fail' : 'pass';
          toolResult.isError = !!response.isError;
          toolResult.responsePreview = text.slice(0, 200);
        } catch {
          // Non-JSON text response — still a valid response
          toolResult.callResult = response.isError ? 'fail' : 'pass';
          toolResult.isError = !!response.isError;
          toolResult.responsePreview = text.slice(0, 200);
        }
      } else if (response?.content?.length > 0) {
        toolResult.callResult = 'pass';
        toolResult.responsePreview = JSON.stringify(response.content[0]).slice(0, 200);
      } else {
        toolResult.callResult = 'fail';
        toolResult.error = 'Empty response (no content)';
      }
    } catch (e: any) {
      toolResult.durationMs = Math.round(performance.now() - start);
      if (e.message?.includes('Timeout')) {
        toolResult.callResult = 'timeout';
        toolResult.error = e.message;
      } else {
        toolResult.callResult = 'error';
        toolResult.error = e.message?.slice(0, 300) || String(e);
      }
    }

    result.tools.push(toolResult);
  }

  return result;
}

async function main() {
  console.log('=== MCP Tool Testing Script ===');
  console.log(`Testing ${AGENTS.length} agents...\n`);

  const report: Report = {
    repoName: 'dw-claw-oss',
    timestamp: new Date().toISOString(),
    summary: {
      totalAgents: AGENTS.length,
      loadedAgents: 0,
      failedAgents: 0,
      totalTools: 0,
      passedTools: 0,
      failedTools: 0,
      errorTools: 0,
      timeoutTools: 0,
    },
    agents: [],
  };

  for (const agentName of AGENTS) {
    process.stderr.write(`Testing ${agentName}... `);
    const agentResult = await testAgent(agentName);
    report.agents.push(agentResult);

    if (agentResult.loaded) {
      report.summary.loadedAgents++;
      const passed = agentResult.tools.filter(t => t.callResult === 'pass').length;
      const failed = agentResult.tools.filter(t => t.callResult === 'fail').length;
      const errors = agentResult.tools.filter(t => t.callResult === 'error').length;
      const timeouts = agentResult.tools.filter(t => t.callResult === 'timeout').length;
      report.summary.totalTools += agentResult.toolCount;
      report.summary.passedTools += passed;
      report.summary.failedTools += failed;
      report.summary.errorTools += errors;
      report.summary.timeoutTools += timeouts;
      process.stderr.write(`${agentResult.toolCount} tools (${passed} pass, ${failed} fail, ${errors} error, ${timeouts} timeout)\n`);
    } else {
      report.summary.failedAgents++;
      process.stderr.write(`FAILED TO LOAD: ${agentResult.loadError?.slice(0, 100)}\n`);
    }
  }

  // Print human-readable summary
  console.log('\n' + '='.repeat(90));
  console.log('SUMMARY');
  console.log('='.repeat(90));
  console.log(`${'Agent'.padEnd(30)} ${'Tools'.padStart(6)} ${'Pass'.padStart(6)} ${'Fail'.padStart(6)} ${'Error'.padStart(6)} ${'T/O'.padStart(6)}`);
  console.log('-'.repeat(90));

  for (const agent of report.agents) {
    if (!agent.loaded) {
      console.log(`${agent.name.padEnd(30)} ${'LOAD FAILED'.padStart(6)}`);
      continue;
    }
    const passed = agent.tools.filter(t => t.callResult === 'pass').length;
    const failed = agent.tools.filter(t => t.callResult === 'fail').length;
    const errors = agent.tools.filter(t => t.callResult === 'error').length;
    const timeouts = agent.tools.filter(t => t.callResult === 'timeout').length;
    console.log(
      `${agent.name.padEnd(30)} ${String(agent.toolCount).padStart(6)} ${String(passed).padStart(6)} ${String(failed).padStart(6)} ${String(errors).padStart(6)} ${String(timeouts).padStart(6)}`
    );
  }

  console.log('-'.repeat(90));
  const s = report.summary;
  console.log(
    `${'TOTAL'.padEnd(30)} ${String(s.totalTools).padStart(6)} ${String(s.passedTools).padStart(6)} ${String(s.failedTools).padStart(6)} ${String(s.errorTools).padStart(6)} ${String(s.timeoutTools).padStart(6)}`
  );
  console.log(`\nAgents: ${s.loadedAgents} loaded, ${s.failedAgents} failed to load`);
  console.log(`Pass rate: ${s.totalTools > 0 ? ((s.passedTools / s.totalTools) * 100).toFixed(1) : 0}%`);

  // Print failures detail
  const failures = report.agents.flatMap(a =>
    a.tools.filter(t => t.callResult !== 'pass').map(t => ({ agent: a.name, ...t }))
  );
  if (failures.length > 0) {
    console.log('\n' + '='.repeat(90));
    console.log('FAILURES & ERRORS');
    console.log('='.repeat(90));
    for (const f of failures) {
      console.log(`[${f.callResult.toUpperCase()}] ${f.agent} → ${f.name}`);
      if (f.error) console.log(`  Error: ${f.error.slice(0, 200)}`);
      if (f.isError && f.responsePreview) console.log(`  Response: ${f.responsePreview.slice(0, 200)}`);
    }
  }

  // Print load failures
  const loadFailures = report.agents.filter(a => !a.loaded);
  if (loadFailures.length > 0) {
    console.log('\n' + '='.repeat(90));
    console.log('AGENT LOAD FAILURES');
    console.log('='.repeat(90));
    for (const a of loadFailures) {
      console.log(`${a.name}: ${a.loadError}`);
    }
  }

  // Write JSON report
  const fs = await import('fs');
  const reportPath = new URL('./test-report-oss.json', import.meta.url).pathname;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nJSON report saved to: ${reportPath}`);
}

main().catch(console.error);
