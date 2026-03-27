/**
 * create_experiment — Create an MLflow-compatible experiment to group training runs.
 *
 * Pro/write tool. Requires Data Workers Pro upgrade.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const createExperimentDefinition: ToolDefinition = {
  name: 'create_experiment',
  description:
    'Create an MLflow-compatible experiment to group training runs. Stores experiment name, description, and tags. (Pro tier, write operation)',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Experiment name.' },
      description: { type: 'string', description: 'Experiment description.' },
      tags: {
        type: 'object',
        description: 'Key-value tags for the experiment.',
      },
    },
    required: ['name'],
  },
};

export const createExperimentHandler: ToolHandler = async (_args) => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: 'pro_feature',
        message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing',
        tool: 'create_experiment'
      })
    }]
  };
};
