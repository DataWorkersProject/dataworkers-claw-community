/**
 * Sidebar tree data provider for agent status panel.
 *
 * In a real VS Code extension, this would implement vscode.TreeDataProvider.
 * Here we provide the data model that the tree view would consume.
 */

import type { AgentInfo } from './extension.js';

export interface AgentTreeItem {
  label: string;
  description: string;
  tooltip: string;
  iconId: string;
  contextValue: string;
  port: number;
}

/**
 * Convert agent info into tree items for the sidebar.
 */
export function agentsToTreeItems(agents: AgentInfo[]): AgentTreeItem[] {
  return agents.map((agent) => ({
    label: agent.name,
    description: agent.status === 'running' ? `port ${agent.port}` : 'stopped',
    tooltip: `${agent.description}\nPort: ${agent.port}\nStatus: ${agent.status}`,
    iconId: agent.status === 'running' ? 'pass' : 'error',
    contextValue: agent.status,
    port: agent.port,
  }));
}

/**
 * Group agents by status for summary display.
 */
export function summarizeAgentStatus(agents: AgentInfo[]): {
  running: number;
  stopped: number;
  total: number;
} {
  const running = agents.filter((a) => a.status === 'running').length;
  return {
    running,
    stopped: agents.length - running,
    total: agents.length,
  };
}
