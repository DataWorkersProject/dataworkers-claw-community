/**
 * dw-quality — Exported tool definitions and handlers.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

import { runQualityCheckDefinition, runQualityCheckHandler } from './tools/run-quality-check.js';
import { getQualityScoreDefinition, getQualityScoreHandler } from './tools/get-quality-score.js';
import { setSLADefinition, setSLAHandler } from './tools/set-sla.js';
import { getAnomaliesDefinition, getAnomaliesHandler } from './tools/get-anomalies.js';
import { createQualityTestsForPipelineDefinition, createQualityTestsForPipelineHandler } from './tools/create-quality-tests-for-pipeline.js';
import { getQualitySummaryDefinition, getQualitySummaryHandler } from './tools/get-quality-summary.js';

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const qualityTools: ToolEntry[] = [
  { definition: runQualityCheckDefinition, handler: runQualityCheckHandler },
  { definition: getQualityScoreDefinition, handler: getQualityScoreHandler },
  { definition: setSLADefinition, handler: setSLAHandler },
  { definition: getAnomaliesDefinition, handler: getAnomaliesHandler },
  { definition: createQualityTestsForPipelineDefinition, handler: createQualityTestsForPipelineHandler },
  { definition: getQualitySummaryDefinition, handler: getQualitySummaryHandler },
];
