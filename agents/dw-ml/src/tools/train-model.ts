/**
 * train_model — Orchestrate model training with selected algorithm and hyperparameters.
 *
 * Pro/write tool. Requires Data Workers Pro upgrade.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const trainModelDefinition: ToolDefinition = {
  name: 'train_model',
  description:
    'Train a model with a selected algorithm and hyperparameters. Stores the trained model and metrics. (Pro tier, write operation)',
  inputSchema: {
    type: 'object',
    properties: {
      dataset_id: { type: 'string', description: 'ID of the dataset to train on.' },
      algorithm: {
        type: 'string',
        enum: ['xgboost', 'lightgbm', 'random_forest', 'linear_regression', 'logistic_regression', 'gradient_boosting', 'decision_tree'],
        description: 'Algorithm to train.',
      },
      hyperparameters: {
        type: 'object',
        description: 'Algorithm-specific hyperparameters.',
      },
      time_budget_seconds: {
        type: 'number',
        description: 'Maximum training time in seconds. Default: 120.',
      },
    },
    required: ['dataset_id', 'algorithm'],
  },
};

export const trainModelHandler: ToolHandler = async (_args) => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: 'pro_feature',
        message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing',
        tool: 'train_model'
      })
    }]
  };
};
