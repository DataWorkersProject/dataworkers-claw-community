/**
 * explain_model — Generate SHAP-style feature importance explanations.
 *
 * Community/read tool. Returns global feature importance ranking and
 * per-feature contribution scores.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { relationalStore, seeded } from '../backends.js';

export const explainModelDefinition: ToolDefinition = {
  name: 'explain_model',
  description:
    'Generate SHAP-style feature importance explanations for a trained model. Returns global feature importance ranking and contribution scores.',
  inputSchema: {
    type: 'object',
    properties: {
      model_id: { type: 'string', description: 'ID of the trained model to explain.' },
      method: {
        type: 'string',
        enum: ['shap', 'permutation', 'gain'],
        description: 'Explanation method. Default: shap.',
      },
      top_n: { type: 'number', description: 'Number of top features to include. Default: all features.' },
    },
    required: ['model_id'],
  },
};

/**
 * Simulate SHAP-like feature importance values.
 * In a real implementation, this would invoke a Python subprocess.
 */
function simulateFeatureImportance(
  features: string[],
  _algorithm: string,
  _method: string,
): { feature: string; importance: number; direction: 'positive' | 'negative' | 'mixed' }[] {
  // Deterministic importance based on feature name hash
  const importances = features.map((f, i) => {
    const hash = f.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const base = 1 / (i + 1); // earlier features tend to be more important
    const noise = (hash % 100) / 1000;
    const importance = Number((base * 0.8 + noise).toFixed(4));
    const directionSeed = hash % 3;
    const direction = directionSeed === 0 ? 'positive' as const : directionSeed === 1 ? 'negative' as const : 'mixed' as const;
    return { feature: f, importance, direction };
  });

  // Normalize to sum to 1
  const total = importances.reduce((s, v) => s + v.importance, 0);
  return importances.map((v) => ({
    ...v,
    importance: Number((v.importance / total).toFixed(4)),
  })).sort((a, b) => b.importance - a.importance);
}

export const explainModelHandler: ToolHandler = async (args) => {
  await seeded;

  const modelId = args.model_id as string;
  const method = (args.method as string) ?? 'shap';
  const topN = args.top_n as number | undefined;

  try {
    const models = await relationalStore.query('ml_models', (r) => r.id === modelId);
    if (models.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Model "${modelId}" not found` }) }],
        isError: true,
      };
    }

    const model = models[0];
    const features: string[] = JSON.parse(model.features as string);
    const algorithm = model.algorithm as string;

    let importances = simulateFeatureImportance(features, algorithm, method);

    if (topN !== undefined) {
      importances = importances.slice(0, topN);
    }

    const result = {
      modelId,
      algorithm,
      method,
      taskType: model.taskType,
      featureCount: features.length,
      explanations: importances,
      summary: `Top feature: "${importances[0].feature}" (importance: ${importances[0].importance}, direction: ${importances[0].direction})`,
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
