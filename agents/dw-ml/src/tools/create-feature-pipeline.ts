/**
 * create_feature_pipeline — Define a reusable feature engineering pipeline.
 *
 * Pro/write tool. Requires Data Workers Pro upgrade.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const createFeaturePipelineDefinition: ToolDefinition = {
  name: 'create_feature_pipeline',
  description:
    'Define a reusable feature engineering pipeline with transforms (one-hot, normalization, log, etc.) and column mappings. (Pro tier, write operation)',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Pipeline name.' },
      dataset_id: { type: 'string', description: 'ID of the dataset this pipeline applies to.' },
      transforms: {
        type: 'array',
        description: 'List of feature transforms. Each has column, transformationType, and outputColumn.',
        items: {
          type: 'object',
          properties: {
            column: { type: 'string' },
            transformationType: {
              type: 'string',
              enum: ['one_hot_encoding', 'label_encoding', 'normalization', 'standardization', 'date_decomposition', 'text_embedding', 'binning', 'log_transform', 'polynomial', 'interaction'],
            },
            outputColumn: { type: 'string' },
            params: { type: 'object' },
          },
          required: ['column', 'transformationType', 'outputColumn'],
        },
      },
    },
    required: ['name', 'dataset_id', 'transforms'],
  },
};

export const createFeaturePipelineHandler: ToolHandler = async (_args) => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: 'pro_feature',
        message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing',
        tool: 'create_feature_pipeline'
      })
    }]
  };
};
