/**
 * generate_pipeline — STRIPPED (OSS).
 *
 * Pipeline generation requires Data Workers Pro.
 * The tool registration is preserved so the MCP server can advertise
 * the capability, but the handler returns an upgrade CTA.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const generatePipelineDefinition: ToolDefinition = {
  name: 'generate_pipeline',
  description: 'Generate a data pipeline from a natural language description. Requires Data Workers Pro — upgrade at https://dataworkers.io/pricing',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Natural language description of the desired pipeline.',
      },
      orchestrator: {
        type: 'string',
        enum: ['airflow', 'dagster', 'prefect'],
        description: 'Target orchestrator. Defaults to airflow.',
      },
      codeLanguage: {
        type: 'string',
        enum: ['sql', 'python', 'dbt'],
        description: 'Primary code language. Defaults to sql.',
      },
      templateId: {
        type: 'string',
        description: 'Optional template ID to base the pipeline on.',
      },
      customerId: {
        type: 'string',
        description: 'Customer ID for tenant context.',
      },
    },
    required: ['description', 'customerId'],
  },
};

export const generatePipelineHandler: ToolHandler = async (_args) => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: 'pro_feature',
        message: 'Pipeline generation requires Data Workers Pro. Visit https://dataworkers.io/pricing to upgrade.',
        tool: 'generate_pipeline',
        agent: 'dw-pipelines',
        upgrade_url: 'https://dataworkers.io/pricing',
      }, null, 2),
    }],
  };
};
