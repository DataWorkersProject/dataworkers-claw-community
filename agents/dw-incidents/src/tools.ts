/**
 * dw-incidents — Exported tool definitions and handlers.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

import { diagnoseIncidentDefinition, diagnoseIncidentHandler } from './tools/diagnose-incident.js';
import { getRootCauseDefinition, getRootCauseHandler } from './tools/get-root-cause.js';
import { remediateDefinition, remediateHandler } from './tools/remediate.js';
import { getIncidentHistoryDefinition, getIncidentHistoryHandler } from './tools/get-incident-history.js';
import { monitorMetricsDefinition, monitorMetricsHandler } from './tools/monitor-metrics.js';

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const incidentsTools: ToolEntry[] = [
  { definition: diagnoseIncidentDefinition, handler: diagnoseIncidentHandler },
  { definition: getRootCauseDefinition, handler: getRootCauseHandler },
  { definition: remediateDefinition, handler: remediateHandler },
  { definition: getIncidentHistoryDefinition, handler: getIncidentHistoryHandler },
  { definition: monitorMetricsDefinition, handler: monitorMetricsHandler },
];
