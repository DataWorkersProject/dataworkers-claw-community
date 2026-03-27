/**
 * get_model_versions — List all versions of a registered model.
 *
 * Community/read tool. Returns version history with metadata, stage, and metrics.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { relationalStore, seeded } from '../backends.js';

export const getModelVersionsDefinition: ToolDefinition = {
  name: 'get_model_versions',
  description:
    'List all versions of a registered model with metadata, stage, metrics, and lineage to training dataset.',
  inputSchema: {
    type: 'object',
    properties: {
      model_name: { type: 'string', description: 'Logical model name to list versions for.' },
      stage: {
        type: 'string',
        enum: ['staging', 'production', 'archived'],
        description: 'Filter by stage. If omitted, returns all stages.',
      },
    },
    required: ['model_name'],
  },
};

export const getModelVersionsHandler: ToolHandler = async (args) => {
  await seeded;

  const modelName = args.model_name as string;
  const stageFilter = args.stage as string | undefined;

  try {
    let versions = await relationalStore.query('ml_model_registry', (r) => r.modelName === modelName);

    if (versions.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `No registered model named "${modelName}" found` }) }],
        isError: true,
      };
    }

    if (stageFilter) {
      versions = versions.filter((v) => v.stage === stageFilter);
    }

    // Enrich with model details
    const enriched = await Promise.all(
      versions.map(async (v) => {
        const models = await relationalStore.query('ml_models', (r) => r.id === v.modelId);
        const model = models[0] ?? null;

        return {
          registryId: v.id,
          version: v.version,
          modelId: v.modelId,
          stage: v.stage,
          description: v.description,
          algorithm: model?.algorithm ?? 'unknown',
          taskType: model?.taskType ?? 'unknown',
          datasetId: model?.datasetId ?? 'unknown',
          metrics: model ? JSON.parse(model.metrics as string) : {},
          registeredAt: new Date(v.registeredAt as number).toISOString(),
        };
      }),
    );

    // Sort by version descending
    enriched.sort((a, b) => (b.version as number) - (a.version as number));

    const result = {
      modelName,
      totalVersions: enriched.length,
      versions: enriched,
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
