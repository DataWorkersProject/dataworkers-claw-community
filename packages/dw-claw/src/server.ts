/**
 * dw-claw unified MCP server.
 *
 * Registers ALL tools from every Community Edition agent onto a single
 * DataWorkersMCPServer instance. When launched via `npx dw-claw` (piped
 * stdin or --stdio flag), the CLI delegates here to start a stdio
 * transport that any MCP client can connect to.
 *
 * This eliminates the need to clone the 375MB monorepo — a single
 * `npx dw-claw` gives you every agent tool in one server.
 *
 * Community Edition scope only: this server must never import from the
 * Pro-tier agents (dw-cost, dw-insights, dw-migration, dw-streaming) —
 * those directories are not part of this repository.
 */

import {
  DataWorkersMCPServer,
  startStdioServer,
} from '@data-workers/mcp-framework';

// ── Import tool arrays from each agent ────────────────────────────────
import { pipelinesTools } from '../../../agents/dw-pipelines/src/tools.js';
import { incidentsTools } from '../../../agents/dw-incidents/src/tools.js';
import { contextCatalogTools } from '../../../agents/dw-context-catalog/src/tools.js';
import { governanceTools } from '../../../agents/dw-governance/src/tools.js';
import { observabilityTools } from '../../../agents/dw-observability/src/tools.js';
import { schemaTools } from '../../../agents/dw-schema/src/tools.js';
import { qualityTools } from '../../../agents/dw-quality/src/tools.js';
import { connectorsTools } from '../../../agents/dw-connectors/src/tools.js';
import { usageIntelligenceTools } from '../../../agents/dw-usage-intelligence/src/tools.js';
import { mlTools } from '../../../agents/dw-ml/src/tools.js';

// ── Aggregate all tool arrays ─────────────────────────────────────────
const allToolSets = [
  { name: 'pipelines', tools: pipelinesTools },
  { name: 'incidents', tools: incidentsTools },
  { name: 'context-catalog', tools: contextCatalogTools },
  { name: 'governance', tools: governanceTools },
  { name: 'observability', tools: observabilityTools },
  { name: 'schema', tools: schemaTools },
  { name: 'quality', tools: qualityTools },
  { name: 'connectors', tools: connectorsTools },
  { name: 'usage-intelligence', tools: usageIntelligenceTools },
  { name: 'ml', tools: mlTools },
];

// ── Create and populate the unified server ────────────────────────────
const totalTools = allToolSets.reduce((sum, s) => sum + s.tools.length, 0);

const server = new DataWorkersMCPServer({
  name: 'data-workers',
  version: '0.2.0',
  description: `Data Workers — ${allToolSets.length} agents, ${totalTools} tools. Autonomous AI agent swarm for data engineering.`,
});

const registered = new Set<string>();
for (const { name: agentName, tools } of allToolSets) {
  for (const { definition, handler } of tools) {
    if (registered.has(definition.name)) {
      // Skip duplicate — first agent to register a tool name wins
      continue;
    }
    registered.add(definition.name);
    server.registerTool(definition, handler);
  }
}

/**
 * Start the unified MCP server on stdio transport.
 * Called by the CLI when stdin is piped or --stdio is passed.
 */
export function startUnifiedServer(): void {
  startStdioServer(server);
}

export { server };
export default server;
