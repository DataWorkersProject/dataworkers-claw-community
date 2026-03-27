/**
 * ab_test_models — Configure an A/B test between two model versions.
 *
 * Enterprise/write tool. Requires Data Workers Enterprise upgrade.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const abTestModelsDefinition: ToolDefinition = {
  name: 'ab_test_models',
  description:
    'Configure an A/B test between two model versions with traffic split, success metric, and duration. Returns test status and statistical significance. (Enterprise tier, write operation)',
  inputSchema: {
    type: 'object',
    properties: {
      model_a_id: { type: 'string', description: 'ID of model A (control).' },
      model_b_id: { type: 'string', description: 'ID of model B (treatment).' },
      traffic_split: {
        type: 'number',
        description: 'Fraction of traffic to model B (0-1). Default: 0.5.',
      },
      metric: { type: 'string', description: 'Success metric to compare. Default: accuracy.' },
      min_sample_size: { type: 'number', description: 'Minimum samples before evaluating. Default: 1000.' },
      duration_hours: { type: 'number', description: 'Test duration in hours. Default: 24.' },
    },
    required: ['model_a_id', 'model_b_id'],
  },
};

export const abTestModelsHandler: ToolHandler = async (_args) => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: 'pro_feature',
        message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing',
        tool: 'ab_test_models'
      })
    }]
  };
};
