/**
 * get_ml_status — Check training/deployment status for a model.
 *
 * Community/read tool. Retrieves status from the KV store and enriches it
 * with model and deployment data from the relational store.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { MLStatus } from '../types.js';
import { relationalStore, kvStore, seeded } from '../backends.js';

export const getMLStatusDefinition: ToolDefinition = {
  name: 'get_ml_status',
  description:
    'Check training or deployment status for a model. Returns stage, progress, and any associated metrics or errors.',
  inputSchema: {
    type: 'object',
    properties: {
      model_id: { type: 'string', description: 'ID of the model to check status for.' },
    },
    required: ['model_id'],
  },
};

export const getMLStatusHandler: ToolHandler = async (args) => {
  await seeded;

  const modelId = args.model_id as string;

  try {
    // Check KV store for cached status
    const statusJson = await kvStore.get(`ml_status:${modelId}`);

    let status: MLStatus | null = null;
    if (statusJson) {
      try {
        status = JSON.parse(statusJson) as MLStatus;
      } catch { /* ignore corrupt data */ }
    }

    // Try to enrich from relational store
    const models = await relationalStore.query('ml_models', (r) => r.id === modelId);
    const deployments = await relationalStore.query('ml_deployments', (r) => r.modelId === modelId);

    if (!status && models.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Model "${modelId}" not found` }) }],
        isError: true,
      };
    }

    const model = models[0] ?? null;
    const deployment = deployments.length > 0 ? deployments[0] : null;

    // Build comprehensive status
    const result: Record<string, unknown> = {
      modelId,
      stage: status?.stage ?? (deployment ? 'deployed' : model ? 'completed' : 'unknown'),
      progress: status?.progress ?? 100,
      startedAt: status?.startedAt ? new Date(status.startedAt).toISOString() : undefined,
      completedAt: status?.completedAt ? new Date(status.completedAt).toISOString() : undefined,
      message: status?.message,
      error: status?.error,
    };

    if (model) {
      result.model = {
        algorithm: model.algorithm,
        taskType: model.taskType,
        targetColumn: model.targetColumn,
        metrics: JSON.parse(model.metrics as string),
        trainingTimeMs: model.trainingTimeMs,
        trainedAt: new Date(model.trainedAt as number).toISOString(),
      };
    }

    if (deployment) {
      result.deployment = {
        deploymentId: deployment.id,
        endpoint: deployment.endpoint,
        environment: deployment.environment,
        status: deployment.status,
        scalingConfig: JSON.parse(deployment.scalingConfig as string),
        createdAt: new Date(deployment.createdAt as number).toISOString(),
      };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
