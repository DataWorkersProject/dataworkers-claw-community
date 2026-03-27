/**
 * dw-usage-intelligence — Usage Intelligence Agent
 *
 * "See how your data team actually works."
 *
 * MCP server exposing 13 tools for practitioner usage analytics + agent observability:
 *
 * Usage Analytics (7 new tools):
 * - get_tool_usage_metrics: usage volume, unique users, trends per tool/agent
 * - get_usage_activity_log: SHA-256 hash-chained practitioner activity log
 * - get_adoption_dashboard: which agents are adopted vs. shelfware
 * - detect_usage_anomalies: drops, spikes, behavior shifts in usage patterns
 * - get_workflow_patterns: common multi-tool sequences, cross-agent flows
 * - get_usage_heatmap: usage by time-of-day, day-of-week, user
 * - get_session_analytics: session depth, duration, power user identification
 *
 * Agent Observability (6 retained tools from dw-observability):
 * - get_agent_metrics: p50/p95/p99 latency, error rates, token consumption
 * - get_audit_trail: SHA-256 hash-chain audit log
 * - check_agent_health: per-agent health status
 * - detect_drift: threshold-based behavioral drift detection
 * - get_evaluation_report: human evaluation scores
 * - list_active_agents: all active agent instances
 *
 * CRITICAL: All processing is deterministic — NO LLM in the collection path.
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';
import { createMessageBus } from '@data-workers/infrastructure-stubs';
import type { MessageBusEvent } from '@data-workers/infrastructure-stubs';
import { EventIngester } from './event-ingester.js';

// Usage Analytics tools
import { getToolUsageMetricsDefinition, getToolUsageMetricsHandler } from './tools/get-tool-usage-metrics.js';
import { getUsageActivityLogDefinition, getUsageActivityLogHandler } from './tools/get-usage-activity-log.js';
import { getAdoptionDashboardDefinition, getAdoptionDashboardHandler } from './tools/get-adoption-dashboard.js';
import { detectUsageAnomaliesDefinition, detectUsageAnomaliesHandler } from './tools/detect-usage-anomalies.js';
import { getWorkflowPatternsDefinition, getWorkflowPatternsHandler } from './tools/get-workflow-patterns.js';
import { getUsageHeatmapDefinition, getUsageHeatmapHandler } from './tools/get-usage-heatmap.js';
import { getSessionAnalyticsDefinition, getSessionAnalyticsHandler } from './tools/get-session-analytics.js';

// Retained Agent Observability tools
import { getAgentMetricsDefinition, getAgentMetricsHandler } from './tools/get-agent-metrics.js';
import { getAuditTrailDefinition, getAuditTrailHandler } from './tools/get-audit-trail.js';
import { checkAgentHealthDefinition, checkAgentHealthHandler } from './tools/check-agent-health.js';
import { detectDriftDefinition, detectDriftHandler } from './tools/detect-drift.js';
import { getEvaluationReportDefinition, getEvaluationReportHandler } from './tools/get-evaluation-report.js';
import { listActiveAgentsDefinition, listActiveAgentsHandler } from './tools/list-active-agents.js';

// Pro-tier tools (P2)
import { scheduleAnomalyScanDefinition, scheduleAnomalyScanHandler } from './tools/schedule-anomaly-scan.js';
import { exportUsageReportDefinition, exportUsageReportHandler } from './tools/export-usage-report.js';
import { configureUsageAlertsDefinition, configureUsageAlertsHandler } from './tools/configure-usage-alerts.js';
import { setAdoptionTargetsDefinition, setAdoptionTargetsHandler } from './tools/set-adoption-targets.js';

// P3 tools
import { verifyGlobalHashChainDefinition, verifyGlobalHashChainHandler } from './tools/verify-global-hash-chain.js';

// P4 tools
import { crossAgentQueryDefinition, crossAgentQueryHandler } from './tools/cross-agent-query.js';
import { getMeteringSummaryDefinition, getMeteringSummaryHandler } from './tools/get-metering-summary.js';
import { getCostEnrichmentDefinition, getCostEnrichmentHandler } from './tools/get-cost-enrichment.js';
import { publishUsageEventsDefinition, publishUsageEventsHandler } from './tools/publish-usage-events.js';
import { getAnomalyContextDefinition, getAnomalyContextHandler } from './tools/get-anomaly-context.js';
import { registerUsageDatasetsDefinition, registerUsageDatasetsHandler } from './tools/register-usage-datasets.js';
import { ingestOtelSpansDefinition, ingestOtelSpansHandler } from './tools/ingest-otel-spans.js';
import { exportOtelSpansDefinition, exportOtelSpansHandler } from './tools/export-otel-spans.js';

import { messageBus as sharedMessageBus, getCurrentTimestamp } from './backends.js';
import type { ToolHandler } from '@data-workers/mcp-framework';

const AGENT_ID = 'dw-usage-intelligence';

/**
 * Wraps a tool handler to emit a tool_invoked event after execution.
 * Uses messageBus to publish events that the EventIngester consumes.
 */
function withToolTracking(toolName: string, handler: ToolHandler): ToolHandler {
  return async (args: Record<string, unknown>) => {
    const start = getCurrentTimestamp();
    const result = await handler(args);
    const durationMs = getCurrentTimestamp() - start;

    // Emit tool_invoked event (fire-and-forget)
    sharedMessageBus.publish('tool_invoked', {
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'tool_invoked',
      timestamp: start,
      customerId: (args._teamId as string) ?? 'system',
      payload: {
        agentName: AGENT_ID,
        toolName,
        userId: (args._userId as string) ?? 'system',
        teamId: (args._teamId as string) ?? 'system',
        inputSummary: `tool=${toolName}`,
        outcome: result.isError ? 'error' : 'success',
        durationMs,
        tokenCount: 0,
        sessionId: (args._sessionId as string) ?? `sess-${start}`,
        sequenceIndex: 0,
      },
    }).catch(() => { /* best-effort emission */ });

    return result;
  };
}

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.1.0',
  description: 'Usage Intelligence Agent — See how your data team actually works. Practitioner usage analytics, workflow patterns, adoption metrics, and full agent observability.',
});

// Usage Analytics tools (7 new) — wrapped with withToolTracking
server.registerTool(getToolUsageMetricsDefinition, withMiddleware(AGENT_ID, 'get_tool_usage_metrics', withToolTracking('get_tool_usage_metrics', getToolUsageMetricsHandler)));
server.registerTool(getUsageActivityLogDefinition, withMiddleware(AGENT_ID, 'get_usage_activity_log', withToolTracking('get_usage_activity_log', getUsageActivityLogHandler)));
server.registerTool(getAdoptionDashboardDefinition, withMiddleware(AGENT_ID, 'get_adoption_dashboard', withToolTracking('get_adoption_dashboard', getAdoptionDashboardHandler)));
server.registerTool(detectUsageAnomaliesDefinition, withMiddleware(AGENT_ID, 'detect_usage_anomalies', withToolTracking('detect_usage_anomalies', detectUsageAnomaliesHandler)));
server.registerTool(getWorkflowPatternsDefinition, withMiddleware(AGENT_ID, 'get_workflow_patterns', withToolTracking('get_workflow_patterns', getWorkflowPatternsHandler)));
server.registerTool(getUsageHeatmapDefinition, withMiddleware(AGENT_ID, 'get_usage_heatmap', withToolTracking('get_usage_heatmap', getUsageHeatmapHandler)));
server.registerTool(getSessionAnalyticsDefinition, withMiddleware(AGENT_ID, 'get_session_analytics', withToolTracking('get_session_analytics', getSessionAnalyticsHandler)));

// Retained Agent Observability tools (6 from dw-observability)
server.registerTool(getAgentMetricsDefinition, withMiddleware(AGENT_ID, 'get_agent_metrics', withToolTracking('get_agent_metrics', getAgentMetricsHandler)));
server.registerTool(getAuditTrailDefinition, withMiddleware(AGENT_ID, 'get_audit_trail', withToolTracking('get_audit_trail', getAuditTrailHandler)));
server.registerTool(checkAgentHealthDefinition, withMiddleware(AGENT_ID, 'check_agent_health', withToolTracking('check_agent_health', checkAgentHealthHandler)));
server.registerTool(detectDriftDefinition, withMiddleware(AGENT_ID, 'detect_drift', withToolTracking('detect_drift', detectDriftHandler)));
server.registerTool(getEvaluationReportDefinition, withMiddleware(AGENT_ID, 'get_evaluation_report', withToolTracking('get_evaluation_report', getEvaluationReportHandler)));
server.registerTool(listActiveAgentsDefinition, withMiddleware(AGENT_ID, 'list_active_agents', withToolTracking('list_active_agents', listActiveAgentsHandler)));

// Pro-tier tools (4 new — require Pro license)
server.registerTool(scheduleAnomalyScanDefinition, withMiddleware(AGENT_ID, 'schedule_anomaly_scan', withToolTracking('schedule_anomaly_scan', scheduleAnomalyScanHandler)));
server.registerTool(exportUsageReportDefinition, withMiddleware(AGENT_ID, 'export_usage_report', withToolTracking('export_usage_report', exportUsageReportHandler)));
server.registerTool(configureUsageAlertsDefinition, withMiddleware(AGENT_ID, 'configure_usage_alerts', withToolTracking('configure_usage_alerts', configureUsageAlertsHandler)));
server.registerTool(setAdoptionTargetsDefinition, withMiddleware(AGENT_ID, 'set_adoption_targets', withToolTracking('set_adoption_targets', setAdoptionTargetsHandler)));

// P3 tools
server.registerTool(verifyGlobalHashChainDefinition, withMiddleware(AGENT_ID, 'verify_global_hash_chain', withToolTracking('verify_global_hash_chain', verifyGlobalHashChainHandler)));

// P4 tools (.., , )
server.registerTool(crossAgentQueryDefinition, withMiddleware(AGENT_ID, 'cross_agent_query', withToolTracking('cross_agent_query', crossAgentQueryHandler)));
server.registerTool(getMeteringSummaryDefinition, withMiddleware(AGENT_ID, 'get_metering_summary', withToolTracking('get_metering_summary', getMeteringSummaryHandler)));
server.registerTool(getCostEnrichmentDefinition, withMiddleware(AGENT_ID, 'get_cost_enrichment', withToolTracking('get_cost_enrichment', getCostEnrichmentHandler)));
server.registerTool(publishUsageEventsDefinition, withMiddleware(AGENT_ID, 'publish_usage_events', withToolTracking('publish_usage_events', publishUsageEventsHandler)));
server.registerTool(getAnomalyContextDefinition, withMiddleware(AGENT_ID, 'get_anomaly_context', withToolTracking('get_anomaly_context', getAnomalyContextHandler)));
server.registerTool(registerUsageDatasetsDefinition, withMiddleware(AGENT_ID, 'register_usage_datasets', withToolTracking('register_usage_datasets', registerUsageDatasetsHandler)));
server.registerTool(ingestOtelSpansDefinition, withMiddleware(AGENT_ID, 'ingest_otel_spans', withToolTracking('ingest_otel_spans', ingestOtelSpansHandler)));
server.registerTool(exportOtelSpansDefinition, withMiddleware(AGENT_ID, 'export_otel_spans', withToolTracking('export_otel_spans', exportOtelSpansHandler)));

server.captureCapabilities();

// ── Event Ingester + Message Bus ────────────────────────────────────
const eventIngester = new EventIngester();
const messageBus = await createMessageBus();

await messageBus.subscribe('tool_invoked', (event: MessageBusEvent) => {
  eventIngester.ingest({
    userId: event.payload.userId as string,
    agentName: event.payload.agentName as string,
    toolName: event.payload.toolName as string,
    teamId: event.payload.teamId as string,
    inputSummary: (event.payload.inputSummary as string) ?? '',
    outcome: (event.payload.outcome as 'success' | 'error') ?? 'success',
    durationMs: (event.payload.durationMs as number) ?? 0,
    tokenCount: (event.payload.tokenCount as number) ?? 0,
    sessionId: (event.payload.sessionId as string) ?? `sess-${Date.now()}`,
    sequenceIndex: (event.payload.sequenceIndex as number) ?? 0,
    timestamp: event.timestamp,
  });
});

export { server, eventIngester, messageBus };
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
