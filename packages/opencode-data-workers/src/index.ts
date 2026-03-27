/**
 * opencode-data-workers — OpenCode plugin for Data Workers
 *
 * Registers all 9 Data Workers MCP agents with OpenCode.
 * Install: add "opencode-data-workers" to your opencode.json plugins array.
 *
 * @see https://dataworkers.dev/docs/setup/opencode
 */

/**
 * Agent registry — all Community Edition agents with their npm package names.
 */
const AGENTS = [
  { key: 'dw-pipelines', pkg: '@data-workers/dw-pipelines', description: 'NL-to-pipeline generation, validation, deployment' },
  { key: 'dw-incidents', pkg: '@data-workers/dw-incidents', description: 'Anomaly detection, root cause analysis, auto-remediation' },
  { key: 'dw-catalog', pkg: '@data-workers/dw-context-catalog', description: 'Cross-catalog search, lineage, asset classification' },
  { key: 'dw-quality', pkg: '@data-workers/dw-quality', description: 'Data profiling, quality scoring, anomaly detection' },
  { key: 'dw-schema', pkg: '@data-workers/dw-schema', description: 'Schema diffing, evolution, snapshots, compatibility' },
  { key: 'dw-governance', pkg: '@data-workers/dw-governance', description: 'Compliance checking, data classification, policy enforcement' },
  { key: 'dw-observability', pkg: '@data-workers/dw-observability', description: 'Metrics collection, SLA monitoring, pipeline tracing' },
  { key: 'dw-connectors', pkg: '@data-workers/dw-connectors', description: 'Catalog & enterprise connector management' },
  { key: 'dw-usage-intelligence', pkg: '@data-workers/dw-usage-intelligence', description: 'Usage analysis, query tracking, index recommendations' },
] as const;

/**
 * Default agents enabled on first install (low context overhead).
 * Users can enable all agents in opencode.json.
 */
const DEFAULT_ENABLED = new Set([
  'dw-catalog',
  'dw-quality',
  'dw-pipelines',
]);

/**
 * Generate MCP server configuration for all Data Workers agents.
 *
 * @param enableAll - If true, enables all agents. Default: only enable top 3.
 * @returns MCP server config entries for opencode.json
 */
export function getMCPServers(enableAll = false): Record<string, {
  type: string;
  command: string[];
  enabled: boolean;
}> {
  const servers: Record<string, { type: string; command: string[]; enabled: boolean }> = {};

  for (const agent of AGENTS) {
    servers[agent.key] = {
      type: 'local',
      command: ['npx', '-y', agent.pkg],
      enabled: enableAll || DEFAULT_ENABLED.has(agent.key),
    };
  }

  return servers;
}

/**
 * Get agent metadata for display or registration.
 */
export function getAgents() {
  return AGENTS.map(a => ({
    ...a,
    defaultEnabled: DEFAULT_ENABLED.has(a.key),
  }));
}

/**
 * Plugin entry point for OpenCode.
 * OpenCode calls this when the plugin is loaded.
 */
export default {
  name: 'data-workers',
  version: '0.1.0',
  description: 'Data Workers — 9 autonomous AI agents for data engineering',

  /**
   * Register MCP servers with OpenCode.
   */
  mcpServers: getMCPServers(false),

  /**
   * Custom agents provided by this plugin.
   */
  agents: [
    {
      name: 'Data Engineer',
      file: '../.opencode/agents/data-engineer.md',
    },
  ],
};
