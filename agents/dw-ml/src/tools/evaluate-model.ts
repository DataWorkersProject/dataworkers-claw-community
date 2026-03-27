/**
 * evaluate_model — Return metrics for a trained model. Optionally compare multiple models.
 *
 * Community/read tool. Retrieves stored metrics and can rank multiple models
 * on a leaderboard by a chosen metric.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ModelMetrics } from '../types.js';
import { relationalStore, seeded } from '../backends.js';

export const evaluateModelDefinition: ToolDefinition = {
  name: 'evaluate_model',
  description:
    'Return evaluation metrics for a trained model. Optionally compare multiple models by providing a dataset_id to get a leaderboard.',
  inputSchema: {
    type: 'object',
    properties: {
      model_id: { type: 'string', description: 'ID of a specific model to evaluate.' },
      dataset_id: { type: 'string', description: 'ID of a dataset to compare all models trained on it.' },
      metric: {
        type: 'string',
        enum: ['accuracy', 'f1', 'auc', 'rmse', 'mae', 'r2'],
        description: 'Metric to rank models by (for comparison). Default: accuracy for classification, rmse for regression.',
      },
    },
    // At least one of model_id or dataset_id is required, but we handle this in the handler
  },
};

export const evaluateModelHandler: ToolHandler = async (args) => {
  await seeded;

  const modelId = args.model_id as string | undefined;
  const datasetId = args.dataset_id as string | undefined;
  const sortMetric = args.metric as string | undefined;

  try {
    if (!modelId && !datasetId) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Provide model_id or dataset_id (or both)' }) }],
        isError: true,
      };
    }

    // Single model evaluation
    if (modelId && !datasetId) {
      const models = await relationalStore.query('ml_models', (r) => r.id === modelId);

      if (models.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Model "${modelId}" not found` }) }],
          isError: true,
        };
      }

      const model = models[0];
      const metrics: ModelMetrics = JSON.parse(model.metrics as string);
      const taskType = model.taskType as string;

      const result = {
        modelId: model.id,
        algorithm: model.algorithm,
        taskType,
        targetColumn: model.targetColumn,
        features: JSON.parse(model.features as string),
        metrics,
        trainingTimeMs: model.trainingTimeMs,
        trainedAt: new Date(model.trainedAt as number).toISOString(),
      };

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    // Multi-model comparison (leaderboard)
    const models = await relationalStore.query('ml_models', datasetId ? (r) => r.datasetId === datasetId : undefined);

    if (models.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `No models found${datasetId ? ` for dataset "${datasetId}"` : ''}` }) }],
        isError: true,
      };
    }

    // If a specific model_id was also given, filter to include it
    const filteredModels = modelId
      ? models.filter((m) => m.id === modelId || m.datasetId === datasetId)
      : models;

    const taskType = filteredModels[0].taskType as string;
    const defaultMetric = taskType === 'classification' ? 'accuracy' : 'rmse';
    const rankMetric = sortMetric ?? defaultMetric;
    const lowerIsBetter = ['rmse', 'mae'].includes(rankMetric);

    const leaderboard = filteredModels.map((m) => {
      const metrics: ModelMetrics = JSON.parse(m.metrics as string);
      return {
        modelId: m.id,
        algorithm: m.algorithm,
        taskType: m.taskType,
        metrics,
        trainingTimeMs: m.trainingTimeMs,
        trainedAt: new Date(m.trainedAt as number).toISOString(),
        rankValue: (metrics as Record<string, unknown>)[rankMetric] as number | undefined,
      };
    });

    // Sort by rank metric
    leaderboard.sort((a, b) => {
      const aVal = a.rankValue ?? (lowerIsBetter ? Infinity : -Infinity);
      const bVal = b.rankValue ?? (lowerIsBetter ? Infinity : -Infinity);
      return lowerIsBetter ? aVal - bVal : bVal - aVal;
    });

    const result = {
      datasetId: datasetId ?? 'all',
      rankMetric,
      lowerIsBetter,
      modelCount: leaderboard.length,
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        ...entry,
      })),
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
