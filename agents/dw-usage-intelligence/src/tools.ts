/**
 * dw-usage-intelligence — Exported tool definitions and handlers.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

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

// Pro-tier tools
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

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const usageIntelligenceTools: ToolEntry[] = [
  // Usage Analytics (7)
  { definition: getToolUsageMetricsDefinition, handler: getToolUsageMetricsHandler },
  { definition: getUsageActivityLogDefinition, handler: getUsageActivityLogHandler },
  { definition: getAdoptionDashboardDefinition, handler: getAdoptionDashboardHandler },
  { definition: detectUsageAnomaliesDefinition, handler: detectUsageAnomaliesHandler },
  { definition: getWorkflowPatternsDefinition, handler: getWorkflowPatternsHandler },
  { definition: getUsageHeatmapDefinition, handler: getUsageHeatmapHandler },
  { definition: getSessionAnalyticsDefinition, handler: getSessionAnalyticsHandler },

  // Agent Observability (6)
  { definition: getAgentMetricsDefinition, handler: getAgentMetricsHandler },
  { definition: getAuditTrailDefinition, handler: getAuditTrailHandler },
  { definition: checkAgentHealthDefinition, handler: checkAgentHealthHandler },
  { definition: detectDriftDefinition, handler: detectDriftHandler },
  { definition: getEvaluationReportDefinition, handler: getEvaluationReportHandler },
  { definition: listActiveAgentsDefinition, handler: listActiveAgentsHandler },

  // Pro-tier (4)
  { definition: scheduleAnomalyScanDefinition, handler: scheduleAnomalyScanHandler },
  { definition: exportUsageReportDefinition, handler: exportUsageReportHandler },
  { definition: configureUsageAlertsDefinition, handler: configureUsageAlertsHandler },
  { definition: setAdoptionTargetsDefinition, handler: setAdoptionTargetsHandler },

  // P3
  { definition: verifyGlobalHashChainDefinition, handler: verifyGlobalHashChainHandler },

  // P4
  { definition: crossAgentQueryDefinition, handler: crossAgentQueryHandler },
  { definition: getMeteringSummaryDefinition, handler: getMeteringSummaryHandler },
  { definition: getCostEnrichmentDefinition, handler: getCostEnrichmentHandler },
  { definition: publishUsageEventsDefinition, handler: publishUsageEventsHandler },
  { definition: getAnomalyContextDefinition, handler: getAnomalyContextHandler },
  { definition: registerUsageDatasetsDefinition, handler: registerUsageDatasetsHandler },
  { definition: ingestOtelSpansDefinition, handler: ingestOtelSpansHandler },
  { definition: exportOtelSpansDefinition, handler: exportOtelSpansHandler },
];
