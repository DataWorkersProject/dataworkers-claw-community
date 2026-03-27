#!/usr/bin/env node
/**
 * CLAW-006 — dw-claw CLI entry point.
 *
 * The primary CLI for starting Data Workers Community Edition agents.
 *
 * Usage:
 *   npx dw-claw             - Start all Community Edition agents
 *   dw-claw catalog         - Start only the catalog agent
 *   dw-claw --list          - Show available agents and tool counts
 *   dw-claw --version       - Show version
 *   dw-claw --help          - Show help
 *
 * No heavy dependencies — uses raw process.argv parsing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const VERSION = '0.1.0';

// ── Agent Registry ──────────────────────────────────────────────────────────

interface AgentEntry {
  name: string;
  displayName: string;
  description: string;
  port: number;
  modulePath: string;
  toolCount: number;
  tools: string[];
}

/**
 * All Community Edition agents with their metadata.
 * modulePath is relative to the monorepo root (agents/<name>/src/index.ts).
 */
const AGENTS: AgentEntry[] = [
  {
    name: 'dw-pipelines',
    displayName: 'Pipeline Builder',
    description: 'NL-to-pipeline generation, validation, deployment',
    port: 3001,
    modulePath: 'agents/dw-pipelines/src/index.ts',
    toolCount: 4,
    tools: ['generate_pipeline', 'validate_pipeline', 'deploy_pipeline', 'list_pipeline_templates'],
  },
  {
    name: 'dw-incidents',
    displayName: 'Incident Debugger',
    description: 'Anomaly detection, root cause analysis, auto-remediation',
    port: 3002,
    modulePath: 'agents/dw-incidents/src/index.ts',
    toolCount: 4,
    tools: ['detect_anomaly', 'diagnose_incident', 'remediate_incident', 'get_incident_history'],
  },
  {
    name: 'dw-context-catalog',
    displayName: 'Context & Catalog',
    description: 'Cross-catalog search, lineage, asset classification',
    port: 3003,
    modulePath: 'agents/dw-context-catalog/src/index.ts',
    toolCount: 8,
    tools: [
      'search_catalog', 'get_lineage', 'get_column_lineage', 'classify_asset',
      'register_asset', 'get_asset', 'list_assets', 'discover_schema',
    ],
  },
  {
    name: 'dw-governance',
    displayName: 'Governance',
    description: 'Compliance checking, data classification, policy enforcement',
    port: 3005,
    modulePath: 'agents/dw-governance/src/index.ts',
    toolCount: 5,
    tools: ['check_compliance', 'classify_data', 'audit_access', 'enforce_policy', 'list_policies'],
  },
  {
    name: 'dw-observability',
    displayName: 'Observability',
    description: 'Metrics collection, SLA monitoring, pipeline tracing',
    port: 3008,
    modulePath: 'agents/dw-observability/src/index.ts',
    toolCount: 6,
    tools: ['get_metrics', 'check_sla', 'trace_pipeline', 'alert_status', 'list_dashboards', 'query_logs'],
  },
  {
    name: 'dw-schema',
    displayName: 'Schema Evolution',
    description: 'Schema diffing, evolution, snapshots, compatibility',
    port: 3011,
    modulePath: 'agents/dw-schema/src/index.ts',
    toolCount: 4,
    tools: ['diff_schema', 'evolve_schema', 'snapshot_schema', 'validate_compatibility'],
  },
  {
    name: 'dw-quality',
    displayName: 'Data Quality',
    description: 'Data profiling, quality scoring, anomaly detection',
    port: 3012,
    modulePath: 'agents/dw-quality/src/index.ts',
    toolCount: 4,
    tools: ['profile_dataset', 'score_quality', 'detect_anomalies', 'validate_rules'],
  },
  {
    name: 'dw-connectors',
    displayName: 'Connectors',
    description: 'Catalog & enterprise connector management',
    port: 3013,
    modulePath: 'agents/dw-connectors/src/index.ts',
    toolCount: 139,
    tools: ['connect_iceberg', 'connect_polaris', 'list_connectors', 'test_connection'],
  },
  {
    name: 'dw-usage-intelligence',
    displayName: 'Usage Intelligence',
    description: 'Usage analysis, query tracking, index recommendations',
    port: 3014,
    modulePath: 'agents/dw-usage-intelligence/src/index.ts',
    toolCount: 13,
    tools: [
      'analyze_usage', 'track_queries', 'recommend_indexes', 'identify_unused',
      'get_query_patterns', 'get_table_usage', 'get_user_activity',
      'get_cost_attribution', 'get_performance_insights', 'get_optimization_opportunities',
      'get_usage_trends', 'get_access_patterns', 'get_data_freshness',
    ],
  },
];

// Note: dw-orchestration is an internal service (not MCP), excluded from agent list.

const TOTAL_AGENTS = AGENTS.length;
const TOTAL_TOOLS = AGENTS.reduce((sum, a) => sum + a.toolCount, 0);

// ── ANSI helpers ────────────────────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

// ── Banner ──────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log('');
  console.log(bold('  ____    _    _____  _      __        _____  ____  _  _______ ____  ____'));
  console.log(bold('  |  _ \\  / \\  |_   _|/ \\     \\ \\      / / _ \\|  _ \\| |/ / ____|  _ \\/ ___|'));
  console.log(bold('  | | | |/ _ \\   | | / _ \\     \\ \\ /\\ / / | | | |_) | \' /|  _| | |_) \\___ \\'));
  console.log(bold('  | |_| / ___ \\  | |/ ___ \\     \\ V  V /| |_| |  _ <| . \\| |___|  _ < ___) |'));
  console.log(bold('  |____/_/   \\_\\ |_/_/   \\_\\     \\_/\\_/  \\___/|_| \\_\\_|\\_\\_____|_| \\_\\____/'));
  console.log('');
  console.log(`  ${cyan('dw-claw')} ${dim('v' + VERSION)} ${dim('|')} ${TOTAL_AGENTS} agents ${dim('|')} ${TOTAL_TOOLS} tools`);
  console.log(`  ${dim('Community Edition — Open-source autonomous agent swarm for data engineering')}`);
  console.log('');
}

// ── Commands ────────────────────────────────────────────────────────────────

function showVersion(): void {
  console.log(`dw-claw v${VERSION}`);
}

function showHelp(): void {
  printBanner();
  console.log(bold('  USAGE'));
  console.log('');
  console.log(`    ${cyan('dw-claw')}                     Start all Community Edition agents`);
  console.log(`    ${cyan('dw-claw')} ${yellow('<agent>')}             Start a specific agent`);
  console.log(`    ${cyan('dw-claw')} ${yellow('--list')}              List available agents and tool counts`);
  console.log(`    ${cyan('dw-claw')} ${yellow('opencode')}             Generate opencode.json for OpenCode integration`);
  console.log(`    ${cyan('dw-claw')} ${yellow('--version')}           Show version`);
  console.log(`    ${cyan('dw-claw')} ${yellow('--help')}              Show this help message`);
  console.log('');
  console.log(bold('  AGENTS'));
  console.log('');
  for (const agent of AGENTS) {
    const shortName = agent.name.replace('dw-', '');
    console.log(`    ${cyan(shortName.padEnd(22))} ${agent.description}`);
  }
  console.log('');
  console.log(bold('  EXAMPLES'));
  console.log('');
  console.log(`    ${dim('$')} npx dw-claw                  ${dim('# Start all agents')}`);
  console.log(`    ${dim('$')} npx dw-claw catalog           ${dim('# Start only the catalog agent')}`);
  console.log(`    ${dim('$')} npx dw-claw --list            ${dim('# Show agents and tool counts')}`);
  console.log(`    ${dim('$')} npx dw-claw opencode             ${dim('# Generate OpenCode config')}`);
  console.log('');
}

function showList(): void {
  printBanner();
  console.log(bold('  AVAILABLE AGENTS'));
  console.log('');
  console.log(`  ${dim('Agent'.padEnd(26))} ${dim('Tools'.padEnd(8))} ${dim('Port'.padEnd(8))} ${dim('Description')}`);
  console.log(`  ${dim('-'.repeat(80))}`);

  for (const agent of AGENTS) {
    const name = agent.name;
    const tools = String(agent.toolCount).padEnd(8);
    const port = String(agent.port).padEnd(8);
    console.log(`  ${cyan(name.padEnd(26))} ${tools} ${port} ${agent.description}`);
  }

  console.log('');
  console.log(`  ${bold('Total:')} ${TOTAL_AGENTS} agents, ${TOTAL_TOOLS} tools`);
  console.log('');
}

/**
 * Resolve an agent by short name (e.g. "catalog" -> "dw-context-catalog")
 * or full name (e.g. "dw-pipelines").
 */
function resolveAgent(nameArg: string): AgentEntry | undefined {
  // Exact match on full name
  const exact = AGENTS.find(a => a.name === nameArg);
  if (exact) return exact;

  // Match on short name (strip "dw-" prefix)
  const byShort = AGENTS.find(a => a.name.replace('dw-', '') === nameArg);
  if (byShort) return byShort;

  // Special aliases
  const aliases: Record<string, string> = {
    'catalog': 'dw-context-catalog',
    'context': 'dw-context-catalog',
    'observe': 'dw-observability',
    'usage': 'dw-usage-intelligence',
    'pipe': 'dw-pipelines',
    'pipeline': 'dw-pipelines',
    'incident': 'dw-incidents',
    'govern': 'dw-governance',
    'connect': 'dw-connectors',
    'connector': 'dw-connectors',
    'quality': 'dw-quality',
    'schema': 'dw-schema',
  };

  const aliasedName = aliases[nameArg];
  if (aliasedName) return AGENTS.find(a => a.name === aliasedName);

  return undefined;
}

/**
 * Start agent(s) by dynamically importing their MCP server module
 * and calling captureCapabilities() (the closest to "connect" in the framework).
 */
async function startAgents(agentsToStart: AgentEntry[]): Promise<void> {
  printBanner();

  const agentLabel = agentsToStart.length === TOTAL_AGENTS ? 'all' : agentsToStart.length.toString();
  const toolsInScope = agentsToStart.reduce((sum, a) => sum + a.toolCount, 0);

  console.log(bold(`  Starting ${agentLabel} agent(s) (${toolsInScope} tools)...`));
  console.log('');

  const results: { agent: AgentEntry; ok: boolean; error?: string }[] = [];

  for (const agent of agentsToStart) {
    const tag = `  [${cyan(agent.displayName)}]`;
    process.stdout.write(`${tag} Loading ${agent.name}...`);

    try {
      // Dynamic import of the agent module — each exports a `server` instance
      const mod = await import(`../../../${agent.modulePath}`);
      const server = mod.server || mod.default;

      if (server && typeof server.captureCapabilities === 'function') {
        server.captureCapabilities();
      }

      console.log(` ${green('OK')} (${agent.toolCount} tools on :${agent.port})`);
      results.push({ agent, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(` ${yellow('SKIP')} — ${dim(message)}`);
      results.push({ agent, ok: false, error: message });
    }
  }

  console.log('');

  const loaded = results.filter(r => r.ok).length;
  const skipped = results.filter(r => !r.ok).length;

  if (loaded > 0) {
    console.log(green(bold(`  Ready.`)) + ` ${loaded} agent(s) loaded.`);
  }
  if (skipped > 0) {
    console.log(yellow(`  ${skipped} agent(s) skipped`) + dim(' (missing dependencies or build artifacts).'));
  }

  console.log('');
  console.log(dim('  Agents are registered as MCP servers. Connect your MCP client to use them.'));
  console.log(dim(`  Run ${cyan('dw-claw --list')} to see all available agents and tools.`));
  console.log(dim(`  Run ${cyan('dw-claw --help')} for more options.`));
  console.log('');
}

// ── OpenCode Config Generation ──────────────────────────────────────────────

function generateOpenCodeConfig(force = false): void {
  const mcp: Record<string, { type: string; command: string[]; enabled: boolean }> = {};

  for (const agent of AGENTS) {
    const key = agent.name === 'dw-context-catalog' ? 'dw-catalog' : agent.name;
    mcp[key] = {
      type: 'local',
      command: ['npx', '-y', `@data-workers/${agent.name}`],
      enabled: true,
    };
  }

  const config = {
    $schema: 'https://opencode.ai/config.json',
    mcp,
  };

  const configPath = path.resolve(process.cwd(), 'opencode.json');

  // Check if file exists (unless --force)
  if (!force && fs.existsSync(configPath)) {
    console.log(`\n  ${yellow('Warning:')} opencode.json already exists at ${configPath}`);
    console.log(`  ${dim('Use --force to overwrite, or manually merge the MCP entries.')}`);
    console.log('');

    // Still print the config so user can copy-paste
    console.log(bold('  Generated config:'));
    console.log('');
    console.log(JSON.stringify(config, null, 2));
    console.log('');
    return;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log('');
  console.log(green(bold('  ✓ Created opencode.json')));
  console.log('');
  console.log(`  ${dim('File:')} ${configPath}`);
  console.log(`  ${dim('Agents:')} ${AGENTS.length}`);
  console.log(`  ${dim('Tools:')} ${TOTAL_TOOLS}`);
  console.log('');
  console.log(bold('  Next steps:'));
  console.log(`    1. Run ${cyan('opencode')} in this directory`);
  console.log(`    2. Use the ${cyan('Data Engineer')} agent or ask naturally:`);
  console.log(`       ${dim('"Search my catalog for customer revenue tables"')}`);
  console.log(`       ${dim('"Why did my nightly ETL pipeline fail?"')}`);
  console.log(`       ${dim('"Run a quality check on staging.events"')}`);
  console.log('');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Flag handling
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--list') || args.includes('-l')) {
    showList();
    return;
  }

  // Positional argument: specific agent name
  const positional = args.filter(a => !a.startsWith('-'));

  if (positional.length > 0) {
    const subcommand = positional[0];

    // Subcommands
    if (subcommand === 'opencode') {
      const forceFlag = args.includes('--force');
      generateOpenCodeConfig(forceFlag);
      return;
    }

    const agentName = positional[0];
    const agent = resolveAgent(agentName);

    if (!agent) {
      console.error(`\n  Unknown agent: "${agentName}"\n`);
      console.error(`  Available agents:`);
      for (const a of AGENTS) {
        console.error(`    ${a.name.replace('dw-', '').padEnd(22)} ${a.name}`);
      }
      console.error('');
      process.exit(1);
    }

    await startAgents([agent]);
    return;
  }

  // No arguments: start all agents
  await startAgents(AGENTS);
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

export { AGENTS, TOTAL_AGENTS, TOTAL_TOOLS, resolveAgent, startAgents, showList, showHelp, showVersion, generateOpenCodeConfig };
