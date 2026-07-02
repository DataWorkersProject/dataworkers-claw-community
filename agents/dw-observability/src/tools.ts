/**
 * dw-observability — Exported tool definitions and handlers.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

import { getAgentMetricsDefinition, getAgentMetricsHandler } from './tools/get-agent-metrics.js';
import { getAuditTrailDefinition, getAuditTrailHandler } from './tools/get-audit-trail.js';
import { checkAgentHealthDefinition, checkAgentHealthHandler } from './tools/check-agent-health.js';
import { detectDriftDefinition, detectDriftHandler } from './tools/detect-drift.js';
import { getEvaluationReportDefinition, getEvaluationReportHandler } from './tools/get-evaluation-report.js';
import { listActiveAgentsDefinition, listActiveAgentsHandler } from './tools/list-active-agents.js';

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const observabilityTools: ToolEntry[] = [
  { definition: getAgentMetricsDefinition, handler: getAgentMetricsHandler },
  { definition: getAuditTrailDefinition, handler: getAuditTrailHandler },
  { definition: checkAgentHealthDefinition, handler: checkAgentHealthHandler },
  { definition: detectDriftDefinition, handler: detectDriftHandler },
  { definition: getEvaluationReportDefinition, handler: getEvaluationReportHandler },
  { definition: listActiveAgentsDefinition, handler: listActiveAgentsHandler },
];
