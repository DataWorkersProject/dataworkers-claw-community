#!/usr/bin/env node
/**
 * dw-claw standalone CLI — works via npx without the full monorepo.
 *
 * Supports: init, setup, --list, --help, --version, opencode
 * Agent startup requires the cloned monorepo (use `npx tsx packages/cli/src/claw.ts`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import * as readline from 'node:readline/promises';

const VERSION = '0.2.0';

// ── Agent Registry ──────────────────────────────────────────────────────────

interface AgentEntry {
  name: string;
  displayName: string;
  description: string;
  port: number;
  toolCount: number;
}

const AGENTS: AgentEntry[] = [
  { name: 'dw-pipelines', displayName: 'Pipeline Builder', description: 'NL-to-pipeline generation, validation, deployment', port: 3001, toolCount: 4 },
  { name: 'dw-incidents', displayName: 'Incident Debugger', description: 'Anomaly detection, root cause analysis, auto-remediation', port: 3002, toolCount: 4 },
  { name: 'dw-context-catalog', displayName: 'Context & Catalog', description: 'Cross-catalog search, lineage, asset classification', port: 3003, toolCount: 8 },
  { name: 'dw-governance', displayName: 'Governance', description: 'Compliance checking, data classification, policy enforcement', port: 3005, toolCount: 5 },
  { name: 'dw-observability', displayName: 'Observability', description: 'Metrics collection, SLA monitoring, pipeline tracing', port: 3008, toolCount: 6 },
  { name: 'dw-schema', displayName: 'Schema Evolution', description: 'Schema diffing, evolution, snapshots, compatibility', port: 3011, toolCount: 4 },
  { name: 'dw-quality', displayName: 'Data Quality', description: 'Data profiling, quality scoring, anomaly detection', port: 3012, toolCount: 4 },
  { name: 'dw-connectors', displayName: 'Connectors', description: 'Catalog & enterprise connector management', port: 3013, toolCount: 139 },
  { name: 'dw-usage-intelligence', displayName: 'Usage Intelligence', description: 'Usage analysis, query tracking, index recommendations', port: 3014, toolCount: 13 },
];

const TOTAL_AGENTS = AGENTS.length;
const TOTAL_TOOLS = AGENTS.reduce((sum, a) => sum + a.toolCount, 0);

// ── ANSI helpers ────────────────────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

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
  console.log(`    ${cyan('dw-claw')} ${yellow('init')}                Auto-detect MCP client & write config`);
  console.log(`    ${cyan('dw-claw')} ${yellow('init --client cursor')} Force a specific client`);
  console.log(`    ${cyan('dw-claw')} ${yellow('init --dry-run')}      Preview config without writing`);
  console.log(`    ${cyan('dw-claw')} ${yellow('claude-code')}         Print the Claude Code one-liner`);
  console.log(`    ${cyan('dw-claw')} ${yellow('codex')}               Print the Codex CLI one-liner`);
  console.log(`    ${cyan('dw-claw')} ${yellow('setup')}               Interactive data source credential wizard`);
  console.log(`    ${cyan('dw-claw')} ${yellow('--stdio')}              Start unified MCP server on stdin/stdout`);
  console.log(`    ${cyan('dw-claw')} ${yellow('--list')}              List available agents and tool counts`);
  console.log(`    ${cyan('dw-claw')} ${yellow('--version')}           Show version`);
  console.log(`    ${cyan('dw-claw')} ${yellow('--help')}              Show this help message`);
  console.log('');
  console.log(bold('  SUPPORTED CLIENTS'));
  console.log('');
  console.log(`    Claude Code, Cursor, GitHub Copilot, Continue, Windsurf, OpenCode, Codex CLI, Gemini CLI`);
  console.log('');
  console.log(bold('  QUICK START'));
  console.log('');
  console.log(`    ${dim('$')} npx dw-claw init              ${dim('# Auto-detect your MCP client')}`);
  console.log(`    ${dim('$')} claude mcp add data-workers -- npx -y dw-claw`);
  console.log(`    ${dim('$')} npx dw-claw setup             ${dim('# Connect to Snowflake/BigQuery/Databricks')}`);
  console.log('');
  console.log(bold('  AGENTS'));
  console.log('');
  for (const agent of AGENTS) {
    const shortName = agent.name.replace('dw-', '');
    console.log(`    ${cyan(shortName.padEnd(22))} ${agent.description}`);
  }
  console.log('');
}

function showList(): void {
  printBanner();
  console.log(bold('  AVAILABLE AGENTS'));
  console.log('');
  console.log(`  ${dim('Agent'.padEnd(26))} ${dim('Tools'.padEnd(8))} ${dim('Port'.padEnd(8))} ${dim('Description')}`);
  console.log(`  ${dim('-'.repeat(80))}`);

  for (const agent of AGENTS) {
    const tools = String(agent.toolCount).padEnd(8);
    const port = String(agent.port).padEnd(8);
    console.log(`  ${cyan(agent.name.padEnd(26))} ${tools} ${port} ${agent.description}`);
  }

  console.log('');
  console.log(`  ${bold('Total:')} ${TOTAL_AGENTS} agents, ${TOTAL_TOOLS} tools`);
  console.log('');
}

// ── Init Command ────────────────────────────────────────────────────────────

interface MCPConfig {
  mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
}

export type MCPClient = 'cursor' | 'claude-code' | 'github-copilot' | 'continue' | 'windsurf' | 'opencode' | 'codex' | 'gemini' | 'generic';

function generateMCPConfig(): MCPConfig {
  const mcpServers: MCPConfig['mcpServers'] = {};
  for (const agent of AGENTS) {
    mcpServers[agent.name] = {
      command: 'node',
      args: [`agents/${agent.name}/dist/index.js`],
      env: { DW_AGENT_PORT: String(agent.port) },
    };
  }
  return { mcpServers };
}

function generateNpxConfig(): MCPConfig {
  return {
    mcpServers: {
      'data-workers': { command: 'npx', args: ['-y', 'dw-claw'] },
    },
  };
}

/**
 * Auto-detect which MCP client the user is running.
 *
 * Detection order:
 * 1. Claude Code — `which claude` succeeds OR ~/.claude exists
 * 2. Cursor — .cursor/ in cwd or home
 * 3. GitHub Copilot — .github/copilot/ exists OR ~/.config/github-copilot/ OR .vscode/settings.json contains mcp.servers
 * 4. Continue — ~/.continue/config.json exists
 * 5. Windsurf — .windsurf/ in cwd or home, OR windsurf binary on PATH
 * 6. OpenCode — opencode.json in cwd
 * 7. Codex CLI — .codex/ in cwd or home, OR codex binary on PATH
 * 8. Gemini CLI — .gemini/ in cwd or home, OR gemini binary on PATH
 * 9. Fallback → generic
 *
 * If multiple clients are detected, returns all of them so the caller can prompt.
 */
export function detectClients(cwd: string): MCPClient[] {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const detected: MCPClient[] = [];

  // Claude Code
  let hasClaude = fs.existsSync(path.join(home, '.claude'));
  if (!hasClaude) {
    try { execSync('which claude', { stdio: 'ignore' }); hasClaude = true; } catch {}
  }
  if (hasClaude) detected.push('claude-code');

  // Cursor
  if (fs.existsSync(path.join(cwd, '.cursor')) || fs.existsSync(path.join(home, '.cursor'))) {
    detected.push('cursor');
  }

  // GitHub Copilot
  const hasGHCopilot =
    fs.existsSync(path.join(cwd, '.github', 'copilot')) ||
    fs.existsSync(path.join(home, '.config', 'github-copilot')) ||
    (() => {
      try {
        const vscodeSettings = path.join(cwd, '.vscode', 'settings.json');
        if (fs.existsSync(vscodeSettings)) {
          const content = fs.readFileSync(vscodeSettings, 'utf-8');
          return content.includes('mcp.servers') || content.includes('mcp-servers');
        }
      } catch {}
      return false;
    })();
  if (hasGHCopilot) detected.push('github-copilot');

  // Continue
  if (fs.existsSync(path.join(home, '.continue', 'config.json'))) {
    detected.push('continue');
  }

  // Windsurf
  const hasWindsurf =
    fs.existsSync(path.join(cwd, '.windsurf')) ||
    fs.existsSync(path.join(home, '.windsurf')) ||
    (() => { try { execSync('which windsurf', { stdio: 'ignore' }); return true; } catch { return false; } })();
  if (hasWindsurf) detected.push('windsurf');

  // OpenCode
  if (fs.existsSync(path.join(cwd, 'opencode.json'))) {
    detected.push('opencode');
  }

  // Codex CLI
  const hasCodex =
    fs.existsSync(path.join(cwd, '.codex')) ||
    fs.existsSync(path.join(home, '.codex')) ||
    (() => { try { execSync('which codex', { stdio: 'ignore' }); return true; } catch { return false; } })();
  if (hasCodex) detected.push('codex');

  // Gemini CLI
  const hasGemini =
    fs.existsSync(path.join(cwd, '.gemini')) ||
    fs.existsSync(path.join(home, '.gemini')) ||
    (() => { try { execSync('which gemini', { stdio: 'ignore' }); return true; } catch { return false; } })();
  if (hasGemini) detected.push('gemini');

  return detected;
}

/**
 * Get the config output path for a given MCP client.
 */
export function getConfigPath(client: MCPClient, cwd: string): string {
  switch (client) {
    case 'cursor': return path.resolve(cwd, '.cursor', 'mcp.json');
    case 'github-copilot': return path.resolve(cwd, '.github', 'copilot', 'mcp.json');
    case 'continue': {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      return path.resolve(home, '.continue', 'config.json');
    }
    case 'windsurf': return path.resolve(cwd, '.windsurf', 'mcp.json');
    case 'opencode': return path.resolve(cwd, 'opencode.json');
    case 'codex': return path.resolve(cwd, '.codex', 'config.toml');
    case 'gemini': return path.resolve(cwd, '.gemini', 'settings.json');
    case 'claude-code':
    case 'generic':
    default:
      return path.resolve(cwd, '.mcp.json');
  }
}

export function clientDisplayName(client: MCPClient): string {
  const names: Record<MCPClient, string> = {
    cursor: 'Cursor',
    'claude-code': 'Claude Code',
    'github-copilot': 'GitHub Copilot',
    'continue': 'Continue',
    'windsurf': 'Windsurf',
    opencode: 'OpenCode',
    codex: 'Codex CLI',
    gemini: 'Gemini CLI',
    generic: 'MCP',
  };
  return names[client];
}

/**
 * Generate the correct JSON config for a given MCP client.
 * Each client has a slightly different format.
 */
export function generateClientConfig(client: MCPClient): Record<string, unknown> {
  switch (client) {
    case 'claude-code':
    case 'cursor':
    case 'windsurf':
    case 'gemini':
      // All four use the same { mcpServers: { name: { command, args } } } format
      // (Gemini CLI reads mcpServers from .gemini/settings.json)
      return {
        mcpServers: {
          'data-workers': {
            command: 'npx',
            args: ['-y', 'dw-claw'],
          },
        },
      };

    case 'github-copilot':
      // GitHub Copilot uses an array-based format
      return {
        servers: [
          {
            name: 'data-workers',
            command: 'npx',
            args: ['-y', 'dw-claw'],
          },
        ],
      };

    case 'continue':
      // Continue uses an array under mcpServers key
      return {
        mcpServers: [
          {
            name: 'data-workers',
            command: 'npx',
            args: ['-y', 'dw-claw'],
          },
        ],
      };

    case 'opencode':
      // OpenCode config schema: local servers use type "local" with a single
      // command array (https://opencode.ai/docs/mcp-servers/)
      return {
        mcp: {
          'data-workers': {
            type: 'local',
            command: ['npx', '-y', 'dw-claw'],
            enabled: true,
          },
        },
      };

    case 'codex':
      // Codex CLI uses TOML ([mcp_servers.*] tables); this object form is
      // rendered by renderCodexToml() rather than JSON.stringify.
      return {
        mcp_servers: {
          'data-workers': {
            command: 'npx',
            args: ['-y', 'dw-claw'],
          },
        },
      };

    case 'generic':
    default:
      return {
        mcpServers: {
          'data-workers': {
            command: 'npx',
            args: ['-y', 'dw-claw'],
          },
        },
      };
  }
}

/**
 * Merge data-workers entry into an existing config file without overwriting
 * other servers. Handles each client's format correctly.
 */
export function mergeConfig(existing: Record<string, unknown>, client: MCPClient): Record<string, unknown> {
  const newConfig = generateClientConfig(client);
  const merged = { ...existing };

  switch (client) {
    case 'claude-code':
    case 'cursor':
    case 'windsurf':
    case 'gemini':
    case 'generic': {
      // Merge into mcpServers object
      const existingServers = (merged.mcpServers as Record<string, unknown>) || {};
      merged.mcpServers = {
        ...existingServers,
        ...(newConfig.mcpServers as Record<string, unknown>),
      };
      return merged;
    }

    case 'github-copilot': {
      // Merge into servers array — replace existing data-workers entry or append
      const existingServers = (Array.isArray(merged.servers) ? merged.servers : []) as Array<{ name: string;[k: string]: unknown }>;
      const filtered = existingServers.filter(s => s.name !== 'data-workers');
      const newServers = (newConfig.servers as Array<{ name: string }>) || [];
      merged.servers = [...filtered, ...newServers];
      return merged;
    }

    case 'continue': {
      // Merge into mcpServers array
      const existingServers = (Array.isArray(merged.mcpServers) ? merged.mcpServers : []) as Array<{ name: string;[k: string]: unknown }>;
      const filtered = existingServers.filter(s => s.name !== 'data-workers');
      const newServers = (newConfig.mcpServers as Array<{ name: string }>) || [];
      merged.mcpServers = [...filtered, ...newServers];
      return merged;
    }

    case 'opencode': {
      // Merge into mcp object
      const existingMcp = (merged.mcp as Record<string, unknown>) || {};
      merged.mcp = {
        ...existingMcp,
        ...(newConfig.mcp as Record<string, unknown>),
      };
      return merged;
    }

    default:
      return { ...merged, ...newConfig };
  }
}

// ── Codex TOML handling ─────────────────────────────────────────────────────
// Codex CLI reads TOML, not JSON. Rather than pull in a TOML parser, we treat
// the config as text: a fresh file is rendered whole, and an existing file is
// extended by appending the [mcp_servers.data-workers] table (appending a new
// top-level table is always valid TOML). We never rewrite user content.

export const CODEX_SERVER_TABLE = '[mcp_servers.data-workers]';

export function renderCodexServerBlock(): string {
  return [
    CODEX_SERVER_TABLE,
    'command = "npx"',
    'args = ["-y", "dw-claw"]',
  ].join('\n');
}

export function renderCodexToml(): string {
  return [
    '# Data Workers — project-scoped Codex CLI config',
    '# Loaded automatically (additively) once you trust this project in Codex.',
    '# Docs: https://developers.openai.com/codex/config-reference',
    '',
    renderCodexServerBlock(),
    '',
  ].join('\n');
}

export function upsertCodexToml(existing: string | null): { content: string; action: 'created' | 'appended' | 'unchanged' } {
  if (existing === null) {
    return { content: renderCodexToml(), action: 'created' };
  }
  if (existing.includes(CODEX_SERVER_TABLE)) {
    return { content: existing, action: 'unchanged' };
  }
  const sep = existing.endsWith('\n') ? '\n' : '\n\n';
  return { content: existing + sep + renderCodexServerBlock() + '\n', action: 'appended' };
}

function initCodex(configPath: string, dryRun: boolean): void {
  const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : null;
  const result = upsertCodexToml(existing);

  if (dryRun) {
    console.log(`Client: ${clientDisplayName('codex')}`);
    console.log(`Would write to: ${configPath} (${result.action})`);
    console.log('');
    console.log(result.content);
    return;
  }

  if (result.action === 'unchanged') {
    console.log(`${green('✓')} data-workers already configured in ${configPath}`);
  } else {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, result.content);
    console.log(`Detected client: ${clientDisplayName('codex')}`);
    console.log(`${green('✓')} Config ${result.action === 'created' ? 'written to' : 'extended at'} ${configPath}`);
  }
  printNextSteps('codex', configPath);
}

function printNextSteps(client: MCPClient, configPath: string): void {
  console.log('\nNext steps:');
  switch (client) {
    case 'claude-code':
      console.log('  Restart Claude Code or run: claude mcp add data-workers -- npx -y dw-claw');
      break;
    case 'cursor':
      console.log('  Restart Cursor to activate, then check Settings > MCP Servers');
      break;
    case 'github-copilot':
      console.log('  Restart VS Code / GitHub Copilot to activate');
      break;
    case 'continue':
      console.log('  Restart Continue to pick up the new server');
      break;
    case 'windsurf':
      console.log('  Restart Windsurf to activate');
      break;
    case 'opencode':
      console.log('  Run: opencode');
      break;
    case 'codex':
      console.log('  Run codex in this project and trust it when prompted — the project config loads additively.');
      console.log('  For a global install instead: codex mcp add data-workers -- npx -y dw-claw');
      break;
    case 'gemini':
      console.log('  Restart Gemini CLI to activate (check /mcp for the data-workers server)');
      break;
    default:
      console.log(`  Point your MCP client at ${configPath}`);
      break;
  }
}

async function promptClientSelection(clients: MCPClient[]): Promise<MCPClient> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (clients.length === 0) {
      console.log(yellow('  No MCP client detected. Using generic config (.mcp.json).'));
      console.log(dim('  Override with --client <name>'));
      return 'generic';
    }

    if (clients.length === 1) return clients[0];

    console.log(bold('  Multiple MCP clients detected:'));
    console.log('');
    for (let i = 0; i < clients.length; i++) {
      console.log(`  ${cyan(String(i + 1) + ')')} ${clientDisplayName(clients[i])}`);
    }
    console.log('');

    while (true) {
      const answer = await rl.question(`  ${cyan('Choose client')} [1-${clients.length}]: `);
      const idx = parseInt(answer.trim(), 10) - 1;
      if (idx >= 0 && idx < clients.length) return clients[idx];
      console.log(red('  Invalid choice. Try again.'));
    }
  } finally {
    rl.close();
  }
}

async function initCommand(args: string[]): Promise<void> {
  const useNpx = args.includes('--npx');
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  const clientIdx = args.indexOf('--client');
  let clientOverride: MCPClient | undefined;
  if (clientIdx !== -1 && clientIdx + 1 < args.length) {
    const v = args[clientIdx + 1].toLowerCase();
    const map: Record<string, MCPClient> = {
      cursor: 'cursor',
      'claude-code': 'claude-code',
      claude: 'claude-code',
      'github-copilot': 'github-copilot',
      copilot: 'github-copilot',
      continue: 'continue',
      windsurf: 'windsurf',
      opencode: 'opencode',
      codex: 'codex',
      'codex-cli': 'codex',
      gemini: 'gemini',
      'gemini-cli': 'gemini',
    };
    clientOverride = map[v];
  }

  const cwd = process.cwd();
  let client: MCPClient;

  if (clientOverride) {
    client = clientOverride;
  } else {
    const detected = detectClients(cwd);
    client = await promptClientSelection(detected);
  }

  const configPath = getConfigPath(client, cwd);

  // Codex is TOML — handled by text-level upsert, never the JSON merge path
  if (client === 'codex') {
    initCodex(configPath, dryRun);
    return;
  }

  // Generate config — either per-agent monorepo or single npx entry
  let finalConfig: Record<string, unknown>;
  if (useNpx || ['claude-code', 'cursor', 'github-copilot', 'continue', 'windsurf', 'opencode', 'gemini'].includes(client)) {
    // For all known clients, generate the client-specific npx config
    finalConfig = generateClientConfig(client);
  } else {
    // Generic: use the full monorepo config
    finalConfig = { ...generateMCPConfig() } as Record<string, unknown>;
  }

  // If file exists and not --force, try to merge
  if (fs.existsSync(configPath) && !force) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      finalConfig = mergeConfig(existing, client);
      console.log(`Merging data-workers into existing ${path.basename(configPath)}`);
    } catch {
      console.log(`${path.basename(configPath)} exists but could not be parsed.`);
      console.log('Use --force to overwrite.');
      return;
    }
  }

  // --dry-run: print config to stdout and exit
  if (dryRun) {
    console.log(`Client: ${clientDisplayName(client)}`);
    console.log(`Would write to: ${configPath}`);
    console.log('');
    console.log(JSON.stringify(finalConfig, null, 2));
    return;
  }

  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2) + '\n');

  console.log(`Detected client: ${clientDisplayName(client)}`);
  console.log(`${green('✓')} Config written to ${configPath}`);
  printNextSteps(client, configPath);
}

// ── Setup Command ───────────────────────────────────────────────────────────

interface DataSourceConfig {
  provider: string;
  envVars: Record<string, string>;
}

async function promptLine(rl: readline.Interface, prompt: string, required = true): Promise<string> {
  while (true) {
    const answer = (await rl.question(prompt)).trim();
    if (answer || !required) return answer;
    console.log(red('  This field is required.'));
  }
}

async function setupSnowflake(rl: readline.Interface): Promise<DataSourceConfig> {
  console.log('\n' + bold('  Snowflake Configuration'));
  console.log(dim('  Find your account identifier at: Organization > Accounts\n'));

  const account = await promptLine(rl, `  ${cyan('Account identifier')} (e.g., xy12345.us-east-1): `);
  const username = await promptLine(rl, `  ${cyan('Username')}: `);
  const password = await promptLine(rl, `  ${cyan('Password')}: `);
  const warehouse = await promptLine(rl, `  ${cyan('Warehouse')} (default: COMPUTE_WH): `, false) || 'COMPUTE_WH';

  return {
    provider: 'snowflake',
    envVars: {
      SNOWFLAKE_ACCOUNT: account,
      SNOWFLAKE_USERNAME: username,
      SNOWFLAKE_PASSWORD: password,
      SNOWFLAKE_WAREHOUSE: warehouse,
    },
  };
}

async function setupBigQuery(rl: readline.Interface): Promise<DataSourceConfig> {
  console.log('\n' + bold('  BigQuery Configuration'));
  console.log(dim('  Find your project ID in the Google Cloud Console\n'));

  const project = await promptLine(rl, `  ${cyan('GCP Project ID')}: `);
  const credsPath = await promptLine(rl, `  ${cyan('Service account JSON path')} (Enter for ADC): `, false);

  const envVars: Record<string, string> = { GOOGLE_CLOUD_PROJECT: project };
  if (credsPath) {
    envVars.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(credsPath);
  }

  return { provider: 'bigquery', envVars };
}

async function setupDatabricks(rl: readline.Interface): Promise<DataSourceConfig> {
  console.log('\n' + bold('  Databricks Configuration'));
  console.log(dim('  Find your workspace URL and generate a PAT in User Settings\n'));

  const host = await promptLine(rl, `  ${cyan('Workspace URL')} (e.g., https://dbc-xxxxx.cloud.databricks.com): `);
  const token = await promptLine(rl, `  ${cyan('Personal Access Token')}: `);

  return {
    provider: 'databricks',
    envVars: { DATABRICKS_HOST: host, DATABRICKS_TOKEN: token },
  };
}

function writeEnvFile(config: DataSourceConfig, cwd: string): void {
  const envPath = path.join(cwd, '.env');
  let existing = '';
  if (fs.existsSync(envPath)) {
    existing = fs.readFileSync(envPath, 'utf-8');
  }

  const lines: string[] = [];
  if (!existing.includes(`# ${config.provider}`)) {
    lines.push(`\n# ${config.provider}`);
  }
  for (const [key, value] of Object.entries(config.envVars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(existing)) {
      existing = existing.replace(regex, `${key}=${value}`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  const content = existing + lines.join('\n') + '\n';
  fs.writeFileSync(envPath, content);
}

function maskValue(key: string, value: string): string {
  if (/password|token|secret|key/i.test(key)) {
    return value.slice(0, 3) + '***' + value.slice(-2);
  }
  return value;
}

function showDetectedCredentials(): void {
  try {
    // Inline credential discovery — same logic as credential-discovery.ts
    // but lightweight: just check if config files exist and show status.
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const sources: Array<{ name: string; path: string; envHint: string }> = [
      { name: 'Snowflake (snowsql)', path: path.join(home, '.snowsql', 'config'), envHint: 'SNOWFLAKE_ACCOUNT' },
      { name: 'Databricks', path: path.join(home, '.databrickscfg'), envHint: 'DATABRICKS_HOST' },
      { name: 'Google Cloud ADC', path: path.join(home, '.config', 'gcloud', 'application_default_credentials.json'), envHint: 'GOOGLE_APPLICATION_CREDENTIALS' },
      { name: 'dbt profiles', path: path.join(home, '.dbt', 'profiles.yml'), envHint: 'DBT_PROFILES_DIR' },
    ];

    const detected: string[] = [];
    const notFound: string[] = [];

    for (const src of sources) {
      if (fs.existsSync(src.path)) {
        detected.push(src.name);
      } else {
        notFound.push(src.name);
      }
    }

    // Also check explicit env vars
    const envSources: Array<{ name: string; envVar: string }> = [
      { name: 'Snowflake (env)', envVar: 'SNOWFLAKE_ACCOUNT' },
      { name: 'BigQuery (env)', envVar: 'GOOGLE_CLOUD_PROJECT' },
      { name: 'Databricks (env)', envVar: 'DATABRICKS_HOST' },
    ];
    for (const src of envSources) {
      if (process.env[src.envVar]) {
        detected.push(src.name);
      }
    }

    console.log(bold('  Detected Credentials'));
    console.log('');
    if (detected.length > 0) {
      for (const name of detected) {
        console.log(`  ${green('✓')} ${name}`);
      }
    }
    if (notFound.length > 0) {
      for (const name of notFound) {
        console.log(`  ${dim('·')} ${name} ${dim('(not found)')}`);
      }
    }
    if (detected.length === 0) {
      console.log(`  ${dim('No credentials detected. Configure below or use demo data.')}`);
    }
    console.log('');
  } catch {
    // Non-critical — don't break setup if detection fails
  }
}

async function setupCommand(args: string[]): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    printBanner();
    showDetectedCredentials();
    console.log(bold('  Data Source Setup Wizard'));
    console.log('');
    console.log(`  ${cyan('1)')} Snowflake`);
    console.log(`  ${cyan('2)')} BigQuery`);
    console.log(`  ${cyan('3)')} Databricks`);
    console.log(`  ${cyan('4)')} Skip (use demo data)`);
    console.log('');

    const directProvider = args[0]?.toLowerCase();
    let choice: string;

    if (['snowflake', 'bigquery', 'databricks'].includes(directProvider)) {
      choice = directProvider === 'snowflake' ? '1' : directProvider === 'bigquery' ? '2' : '3';
    } else {
      choice = await promptLine(rl, `  ${cyan('Choose data source')} [1-4]: `);
    }

    let config: DataSourceConfig | undefined;

    switch (choice) {
      case '1': case 'snowflake': config = await setupSnowflake(rl); break;
      case '2': case 'bigquery': config = await setupBigQuery(rl); break;
      case '3': case 'databricks': config = await setupDatabricks(rl); break;
      case '4': case 'skip':
        console.log('\n' + green('  Using demo data (InMemory stubs). No credentials needed.'));
        console.log(dim('  Run dw-claw setup later to connect a real data source.\n'));
        return;
      default:
        console.log(red(`\n  Unknown choice: "${choice}"\n`));
        return;
    }

    if (config) {
      writeEnvFile(config, process.cwd());
      console.log('\n' + green(bold('  Credentials saved to .env')));
      console.log('');
      for (const [key, value] of Object.entries(config.envVars)) {
        console.log(`  ${dim(key + '=')}${maskValue(key, value)}`);
      }
      console.log('');
      console.log(dim('  The factory will auto-detect these on next agent startup.'));
      console.log('');
    }
  } finally {
    rl.close();
  }
}

// ── OpenCode Config ─────────────────────────────────────────────────────────

function generateOpenCodeConfig(force = false): void {
  const mcp: Record<string, { type: string; command: string[]; enabled: boolean }> = {};
  for (const agent of AGENTS) {
    const key = agent.name === 'dw-context-catalog' ? 'dw-catalog' : agent.name;
    mcp[key] = { type: 'local', command: ['npx', '-y', `@data-workers/${agent.name}`], enabled: true };
  }
  const config = { $schema: 'https://opencode.ai/config.json', mcp };
  const configPath = path.resolve(process.cwd(), 'opencode.json');

  if (!force && fs.existsSync(configPath)) {
    console.log(`\n  ${yellow('Warning:')} opencode.json already exists at ${configPath}`);
    console.log(`  ${dim('Use --force to overwrite.')}\n`);
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('\n' + green(bold('  Created opencode.json')));
  console.log(`  ${dim('Agents:')} ${AGENTS.length} | ${dim('Tools:')} ${TOTAL_TOOLS}\n`);
}

// ── Stdio Detection ────────────────────────────────────────────────────────

/**
 * Returns true when the process should act as an MCP stdio server:
 * - stdin is piped (not a TTY) — e.g. launched by an MCP client
 * - OR the --stdio flag is explicitly passed
 */
function shouldRunStdio(args: string[]): boolean {
  if (args.includes('--stdio')) return true;
  if (!process.stdin.isTTY) return true;
  return false;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check explicit CLI flags BEFORE stdio detection — when launched from a
  // non-TTY shell (e.g. CI, piped env) the user may still want --help/--version.
  if (args.includes('--version') || args.includes('-v')) { showVersion(); return; }
  if (args.includes('--help') || args.includes('-h')) { showHelp(); return; }
  if (args.includes('--list') || args.includes('-l')) { showList(); return; }

  const positional = args.filter(a => !a.startsWith('-'));

  // If stdin is piped or --stdio flag is present, start the unified MCP server
  // immediately — no CLI chrome needed. Explicit subcommands (init, setup, …)
  // always win over stdin detection so scripts/CI can run them with piped stdin.
  if (positional.length === 0 && shouldRunStdio(args)) {
    const { startUnifiedServer } = await import('./server.js');
    startUnifiedServer();
    return;
  }

  if (positional.length > 0) {
    const subcommand = positional[0];

    if (subcommand === 'init') {
      await initCommand(args.slice(1));
      return;
    }

    if (subcommand === 'setup') {
      await setupCommand(args.slice(1));
      return;
    }

    if (subcommand === 'opencode') {
      generateOpenCodeConfig(args.includes('--force'));
      return;
    }

    if (subcommand === 'codex') {
      console.log('');
      console.log(bold('  Add Data Workers to Codex CLI:'));
      console.log('');
      console.log(`  ${cyan('codex mcp add data-workers -- npx -y dw-claw')}`);
      console.log('');
      console.log(dim('  Or write a project-scoped .codex/config.toml:'));
      console.log(`  ${dim('$')} npx dw-claw init --client codex`);
      console.log('');
      return;
    }

    if (subcommand === 'claude-code' || subcommand === 'claude') {
      console.log('');
      console.log(bold('  Add Data Workers to Claude Code:'));
      console.log('');
      console.log(`  ${cyan('claude mcp add data-workers -- npx -y dw-claw')}`);
      console.log('');
      console.log(dim('  Or auto-detect and write .mcp.json:'));
      console.log(`  ${dim('$')} npx dw-claw init --client claude-code`);
      console.log('');
      return;
    }

    // Unknown subcommand — show help
    console.error(`\n  Unknown command: "${subcommand}"\n`);
    showHelp();
    process.exit(1);
  }

  // No args + TTY: show help
  showHelp();
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
