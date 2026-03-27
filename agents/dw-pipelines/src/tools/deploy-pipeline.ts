/**
 * deploy_pipeline — STRIPPED (OSS).
 *
 * Pipeline deployment requires Data Workers Pro.
 * The tool registration is preserved so the MCP server can advertise
 * the capability, but the handler returns an upgrade CTA.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const deployPipelineDefinition: ToolDefinition = {
  name: 'deploy_pipeline',
  description: 'Deploy a validated pipeline to the target orchestrator. Requires Data Workers Pro — upgrade at https://dataworkers.dev/pricing',
  inputSchema: {
    type: 'object',
    properties: {
      pipelineSpec: {
        type: 'object',
        description: 'The validated pipeline specification to deploy.',
      },
      customerId: {
        type: 'string',
        description: 'Customer ID for tenant context.',
      },
      environment: {
        type: 'string',
        enum: ['staging', 'production'],
        description: 'Deployment target environment.',
      },
      gitCommit: {
        type: 'boolean',
        description: 'Whether to commit the spec to Git.',
      },
    },
    required: ['pipelineSpec', 'customerId', 'environment'],
  },
};

export const deployPipelineHandler: ToolHandler = async (_args) => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: 'pro_feature',
        message: 'Pipeline deployment requires Data Workers Pro. Visit https://dataworkers.dev/pricing to upgrade.',
        tool: 'deploy_pipeline',
        agent: 'dw-pipelines',
        upgrade_url: 'https://dataworkers.dev/pricing',
      }, null, 2),
    }],
  };
};
