/**
 * log_metrics — Log training metrics per run within an experiment.
 *
 * Pro/write tool. Requires Data Workers Pro upgrade.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const logMetricsDefinition: ToolDefinition = {
  name: 'log_metrics',
  description:
    'Log training metrics (loss, accuracy, custom) per run within an experiment. Supports step-level logging for training curves. (Pro tier, write operation)',
  inputSchema: {
    type: 'object',
    properties: {
      experiment_id: { type: 'string', description: 'ID of the experiment.' },
      model_id: { type: 'string', description: 'Optional model ID to associate with this run.' },
      metrics: {
        type: 'object',
        description: 'Key-value metrics to log (e.g., { accuracy: 0.94, loss: 0.15 }).',
      },
      step: { type: 'number', description: 'Training step number. Default: auto-incremented.' },
    },
    required: ['experiment_id', 'metrics'],
  },
};

export const logMetricsHandler: ToolHandler = async (_args) => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: 'pro_feature',
        message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing',
        tool: 'log_metrics'
      })
    }]
  };
};
