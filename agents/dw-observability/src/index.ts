/**
 * dw-observability — Agent Observability (Trust Layer)
 *
 * MCP server exposing 6 observability tools:
 * - get_agent_metrics: p50/p95/p99 latency, error rates, token consumption
 * - get_audit_trail: SHA-256 hash-chain audit log
 * - check_agent_health: per-agent health status
 * - detect_drift: threshold-based behavioral drift detection
 * - get_evaluation_report: human evaluation scores
 * - list_active_agents: all active agent instances
 *
 * CRITICAL: All monitoring is deterministic — NO LLM in the collection path.
 *
 * See (epic), (J1), (J2), (J3), (J4).
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';
import { getAgentMetricsDefinition, getAgentMetricsHandler } from './tools/get-agent-metrics.js';
import { getAuditTrailDefinition, getAuditTrailHandler } from './tools/get-audit-trail.js';
import { checkAgentHealthDefinition, checkAgentHealthHandler } from './tools/check-agent-health.js';
import { detectDriftDefinition, detectDriftHandler } from './tools/detect-drift.js';
import { getEvaluationReportDefinition, getEvaluationReportHandler } from './tools/get-evaluation-report.js';
import { listActiveAgentsDefinition, listActiveAgentsHandler } from './tools/list-active-agents.js';

const AGENT_ID = 'dw-observability';

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.1.0',
  description: 'Agent Observability (Trust Layer) — deterministic metrics, audit trails, health checks, drift detection',
});

server.registerTool(getAgentMetricsDefinition, withMiddleware(AGENT_ID, 'get_agent_metrics', getAgentMetricsHandler));
server.registerTool(getAuditTrailDefinition, withMiddleware(AGENT_ID, 'get_audit_trail', getAuditTrailHandler));
server.registerTool(checkAgentHealthDefinition, withMiddleware(AGENT_ID, 'check_agent_health', checkAgentHealthHandler));
server.registerTool(detectDriftDefinition, withMiddleware(AGENT_ID, 'detect_drift', detectDriftHandler));
server.registerTool(getEvaluationReportDefinition, withMiddleware(AGENT_ID, 'get_evaluation_report', getEvaluationReportHandler));
server.registerTool(listActiveAgentsDefinition, withMiddleware(AGENT_ID, 'list_active_agents', listActiveAgentsHandler));

server.captureCapabilities();

export { server };
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
