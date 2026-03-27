/**
 * dw-incidents — Incident Debugging Agent
 *
 * MCP server exposing 5 incident management tools:
 * - diagnose_incident: Classify and diagnose anomalies
 * - get_root_cause: Lineage-graph-powered RCA
 * - remediate: Auto-remediation playbooks + human escalation
 * - get_incident_history: Historical incident pattern matching
 * - monitor_metrics: Record metric data points and detect anomalies
 *
 * See REQ-INC-001 through REQ-INC-008.
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';
import { AgentRegistry } from '@data-workers/orchestrator';
import { diagnoseIncidentDefinition, diagnoseIncidentHandler } from './tools/diagnose-incident.js';
import { getRootCauseDefinition, getRootCauseHandler } from './tools/get-root-cause.js';
import { remediateDefinition, remediateHandler } from './tools/remediate.js';
import { getIncidentHistoryDefinition, getIncidentHistoryHandler } from './tools/get-incident-history.js';
import { monitorMetricsDefinition, monitorMetricsHandler } from './tools/monitor-metrics.js';

const AGENT_ID = 'dw-incidents';

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.1.0',
  description: 'Incident Debugging Agent — anomaly diagnosis, root cause analysis, auto-remediation',
});

// Register all 5 tools (REQ-INC-007)
server.registerTool(diagnoseIncidentDefinition, withMiddleware(AGENT_ID, 'diagnose_incident', diagnoseIncidentHandler));
server.registerTool(getRootCauseDefinition, withMiddleware(AGENT_ID, 'get_root_cause', getRootCauseHandler));
server.registerTool(remediateDefinition, withMiddleware(AGENT_ID, 'remediate', remediateHandler));
server.registerTool(getIncidentHistoryDefinition, withMiddleware(AGENT_ID, 'get_incident_history', getIncidentHistoryHandler));
server.registerTool(monitorMetricsDefinition, withMiddleware(AGENT_ID, 'monitor_metrics', monitorMetricsHandler));

server.captureCapabilities();

// Register dw-incidents agent with AgentRegistry
try {
  const registry = new AgentRegistry();
  registry.register({
    agentId: 'dw-incidents',
    name: 'Incident Debugging Agent',
    version: '0.1.0',
    status: 'active',
    mcpEndpoint: 'stdio://dw-incidents',
    toolCount: 5,
  });
} catch { /* AgentRegistry may not be available in all environments */ }

import './subscriptions.js';

export { server };
export { messageBus } from './backends.js';
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
