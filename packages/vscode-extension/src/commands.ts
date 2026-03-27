/**
 * VS Code command handlers for Data Workers extension.
 *
 * These functions implement the logic behind each command.
 * In a real VS Code extension, they would be registered via
 * vscode.commands.registerCommand().
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AGENT_DEFINITIONS, discoverAgents, generateMCPConfig } from './extension.js';
import { agentsToTreeItems, summarizeAgentStatus } from './sidebar.js';

/**
 * Initialize MCP config in the workspace.
 */
export async function handleInit(workspacePath: string): Promise<{
  success: boolean;
  configPath: string;
  agentCount: number;
}> {
  const configPath = path.join(workspacePath, '.mcp.json');
  const config = generateMCPConfig();

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  return {
    success: true,
    configPath,
    agentCount: AGENT_DEFINITIONS.length,
  };
}

/**
 * List all available agents with their tools.
 */
export function handleListAgents(): Array<{
  name: string;
  description: string;
  port: number;
}> {
  return AGENT_DEFINITIONS.map((a) => ({
    name: a.name,
    description: a.description,
    port: a.port,
  }));
}

/**
 * Check the status of all agents and return tree items for display.
 */
export async function handleCheckStatus(host?: string): Promise<{
  items: ReturnType<typeof agentsToTreeItems>;
  summary: ReturnType<typeof summarizeAgentStatus>;
}> {
  const agents = await discoverAgents(host);
  return {
    items: agentsToTreeItems(agents),
    summary: summarizeAgentStatus(agents),
  };
}
