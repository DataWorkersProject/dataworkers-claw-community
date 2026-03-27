/**
 * dw-pipelines — Pipeline Building Agent
 *
 * MCP server exposing 4 pipeline building tools:
 * - generate_pipeline: NL description -> structured pipeline spec
 * - validate_pipeline: Syntax, schema, semantic layer, sandbox validation
 * - deploy_pipeline: Deploy to orchestrator + Git commit
 * - list_pipeline_templates: Available templates for common patterns
 *
 * See REQ-PIPE-001 through REQ-PIPE-008.
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';
import { generatePipelineDefinition, generatePipelineHandler } from './tools/generate-pipeline.js';
import { validatePipelineDefinition, validatePipelineHandler } from './tools/validate-pipeline.js';
import { deployPipelineDefinition, deployPipelineHandler } from './tools/deploy-pipeline.js';
import { listTemplatesDefinition, listTemplatesHandler } from './tools/list-templates.js';

const AGENT_ID = 'dw-pipelines';

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.1.0',
  description: 'Pipeline Building Agent — NL-to-pipeline generation, validation, deployment',
});

// Register all 4 tools (REQ-PIPE-007)
server.registerTool(generatePipelineDefinition, withMiddleware(AGENT_ID, 'generate_pipeline', generatePipelineHandler));
server.registerTool(validatePipelineDefinition, withMiddleware(AGENT_ID, 'validate_pipeline', validatePipelineHandler));
server.registerTool(deployPipelineDefinition, withMiddleware(AGENT_ID, 'deploy_pipeline', deployPipelineHandler));
server.registerTool(listTemplatesDefinition, withMiddleware(AGENT_ID, 'list_pipeline_templates', listTemplatesHandler));

// Capture initial capabilities for version tracking
server.captureCapabilities();

export { server };
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
