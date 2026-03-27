/**
 * init command - Initialize data-workers MCP config.
 *
 * Generates a .mcp.json file that configures all agents as MCP servers.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** All available Data Workers agents. */
export const AGENTS = [
  { name: 'dw-pipelines', description: 'Pipeline Building Agent', port: 3001 },
  { name: 'dw-incidents', description: 'Incident Debugging Agent', port: 3002 },
  { name: 'dw-context-catalog', description: 'Context & Catalog Agent', port: 3003 },
  { name: 'dw-governance', description: 'Governance Agent', port: 3005 },
  { name: 'dw-observability', description: 'Observability Agent', port: 3008 },
  { name: 'dw-orchestration', description: 'Orchestration Agent', port: 3010 },
  { name: 'dw-schema', description: 'Schema Evolution Agent', port: 3011 },
  { name: 'dw-quality', description: 'Data Quality Agent', port: 3012 },
  { name: 'dw-connectors', description: 'Connectors Agent', port: 3013 },
  { name: 'dw-usage-intelligence', description: 'Usage Intelligence Agent', port: 3014 },
];

export interface MCPConfig {
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
}

export function generateMCPConfig(): MCPConfig {
  const mcpServers: MCPConfig['mcpServers'] = {};

  for (const agent of AGENTS) {
    mcpServers[agent.name] = {
      command: 'node',
      args: [`agents/${agent.name}/dist/index.js`],
      env: {
        DW_AGENT_PORT: String(agent.port),
      },
    };
  }

  return { mcpServers };
}

export async function initCommand(args: string[]): Promise<void> {
  const outputDir = args[0] || '.';
  const outputPath = path.resolve(outputDir, '.mcp.json');

  if (fs.existsSync(outputPath) && !args.includes('--force')) {
    console.log(`.mcp.json already exists at ${outputPath}`);
    console.log('Use --force to overwrite.');
    return;
  }

  const config = generateMCPConfig();
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n');

  console.log(`Generated .mcp.json at ${outputPath}`);
  console.log(`Configured ${AGENTS.length} agents:`);
  for (const agent of AGENTS) {
    console.log(`  - ${agent.name} (port ${agent.port})`);
  }
}
