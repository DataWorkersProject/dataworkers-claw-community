/**
 * VS Code extension for Data Workers.
 *
 * Provides agent discovery, status monitoring, and initialization commands.
 */

// VS Code types are only available at design-time.
// At runtime, this module is loaded by VS Code which provides the vscode module.
// Using dynamic import pattern for non-VS Code environments (e.g., tests).

/** Agent metadata. */
export interface AgentInfo {
  name: string;
  description: string;
  port: number;
  status: 'running' | 'stopped' | 'unknown';
}

/** All known Data Workers agents. */
export const AGENT_DEFINITIONS: Omit<AgentInfo, 'status'>[] = [
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

/**
 * Discover agents by checking port availability.
 * Works without VS Code dependency.
 */
export async function discoverAgents(host: string = 'localhost', timeoutMs: number = 2000): Promise<AgentInfo[]> {
  const net = await import('node:net');

  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeoutMs);

      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      });
    });
  };

  const results: AgentInfo[] = [];
  for (const agent of AGENT_DEFINITIONS) {
    const running = await checkPort(agent.port);
    results.push({ ...agent, status: running ? 'running' : 'stopped' });
  }
  return results;
}

/**
 * Generate MCP configuration JSON.
 */
export function generateMCPConfig(): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = {};
  for (const agent of AGENT_DEFINITIONS) {
    mcpServers[agent.name] = {
      command: 'node',
      args: [`agents/${agent.name}/dist/index.js`],
      env: { DW_AGENT_PORT: String(agent.port) },
    };
  }
  return { mcpServers };
}

/**
 * VS Code extension activation function.
 * Called by VS Code when the extension is activated.
 *
 * Note: This function references the vscode module which is only available
 * in the VS Code runtime. For standalone use, use discoverAgents() directly.
 */
export function activate(context: { subscriptions: { dispose(): void }[] }): void {
  // Extension activation logic would register commands here.
  // The actual VS Code API calls are deferred to commands.ts and sidebar.ts.
  console.log('Data Workers extension activated');

  // Store context for deactivation cleanup
  void context;
}

export function deactivate(): void {
  console.log('Data Workers extension deactivated');
}
