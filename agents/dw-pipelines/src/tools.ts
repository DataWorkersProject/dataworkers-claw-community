/**
 * dw-pipelines — Exported tool definitions and handlers.
 *
 * Used by the unified dw-claw MCP server to register all pipeline tools
 * on a single server instance, and by the standalone agent index.ts.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

import { generatePipelineDefinition, generatePipelineHandler } from './tools/generate-pipeline.js';
import { validatePipelineDefinition, validatePipelineHandler } from './tools/validate-pipeline.js';
import { deployPipelineDefinition, deployPipelineHandler } from './tools/deploy-pipeline.js';
import { listTemplatesDefinition, listTemplatesHandler } from './tools/list-templates.js';

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const pipelinesTools: ToolEntry[] = [
  { definition: generatePipelineDefinition, handler: generatePipelineHandler },
  { definition: validatePipelineDefinition, handler: validatePipelineHandler },
  { definition: deployPipelineDefinition, handler: deployPipelineHandler },
  { definition: listTemplatesDefinition, handler: listTemplatesHandler },
];
