/**
 * suggest_features — Analyze dataset columns and suggest feature engineering transformations.
 *
 * Community/read tool. Inspects column types, cardinality, and null rates to
 * recommend transformations like one-hot encoding, normalization, date
 * decomposition, text embeddings, etc.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ColumnInfo, FeatureSuggestion } from '../types.js';
import { relationalStore, seeded } from '../backends.js';

export const suggestFeaturesDefinition: ToolDefinition = {
  name: 'suggest_features',
  description:
    'Analyze dataset columns and suggest feature engineering transformations (one-hot encoding, normalization, date decomposition, text embeddings).',
  inputSchema: {
    type: 'object',
    properties: {
      dataset_id: { type: 'string', description: 'ID of the dataset to analyze.' },
      max_suggestions: { type: 'number', description: 'Maximum number of suggestions to return. Default: 10.' },
    },
    required: ['dataset_id'],
  },
};

export const suggestFeaturesHandler: ToolHandler = async (args) => {
  await seeded;

  const datasetId = args.dataset_id as string;
  const maxSuggestions = (args.max_suggestions as number) ?? 10;

  try {
    const rows = await relationalStore.query('ml_datasets', (r) => r.id === datasetId);

    if (rows.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Dataset "${datasetId}" not found` }) }],
        isError: true,
      };
    }

    const dataset = rows[0];
    const columns: ColumnInfo[] = JSON.parse(dataset.columns as string);
    const targetColumn = dataset.targetColumn as string | undefined;

    const suggestions: FeatureSuggestion[] = [];

    for (const col of columns) {
      // Skip the target column
      if (col.name === targetColumn) continue;

      // Categorical columns with low cardinality -> one-hot encoding
      if (col.type === 'categorical' && col.cardinality <= 20) {
        suggestions.push({
          column: col.name,
          transformationType: 'one_hot_encoding',
          reason: `Categorical column with ${col.cardinality} unique values — ideal for one-hot encoding`,
          estimatedImpact: col.cardinality <= 5 ? 'high' : 'medium',
          newFeatureName: `${col.name}_onehot`,
        });
      }

      // Categorical columns with high cardinality -> label encoding
      if (col.type === 'categorical' && col.cardinality > 20) {
        suggestions.push({
          column: col.name,
          transformationType: 'label_encoding',
          reason: `High-cardinality categorical (${col.cardinality} values) — label encoding preserves information without explosion`,
          estimatedImpact: 'medium',
          newFeatureName: `${col.name}_encoded`,
        });
      }

      // Numeric columns with high range -> normalization
      if (col.type === 'numeric' && col.cardinality > 100) {
        suggestions.push({
          column: col.name,
          transformationType: 'normalization',
          reason: `Numeric column with wide range (${col.cardinality} distinct values) — normalization improves gradient-based model convergence`,
          estimatedImpact: 'medium',
          newFeatureName: `${col.name}_normalized`,
        });
      }

      // Numeric columns with skew potential -> log transform
      if (col.type === 'numeric' && col.cardinality > 500) {
        suggestions.push({
          column: col.name,
          transformationType: 'log_transform',
          reason: `High-cardinality numeric column likely has skewed distribution — log transform reduces impact of outliers`,
          estimatedImpact: 'medium',
          newFeatureName: `${col.name}_log`,
        });
      }

      // Datetime columns -> date decomposition
      if (col.type === 'datetime') {
        suggestions.push({
          column: col.name,
          transformationType: 'date_decomposition',
          reason: 'DateTime column can be decomposed into year, month, day_of_week, quarter for cyclical patterns',
          estimatedImpact: 'high',
          newFeatureName: `${col.name}_decomposed`,
        });
      }

      // Text columns -> embeddings
      if (col.type === 'text') {
        suggestions.push({
          column: col.name,
          transformationType: 'text_embedding',
          reason: 'Text column can be converted to dense embeddings for semantic feature representation',
          estimatedImpact: 'high',
          newFeatureName: `${col.name}_embedding`,
        });
      }

      // Columns with nulls -> note for imputation
      if (col.nullRate > 0.05) {
        suggestions.push({
          column: col.name,
          transformationType: 'binning',
          reason: `Column has ${(col.nullRate * 100).toFixed(1)}% null rate — binning with a "missing" bin handles nulls gracefully`,
          estimatedImpact: 'low',
          newFeatureName: `${col.name}_binned`,
        });
      }
    }

    // Limit and sort by impact
    const impactOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => impactOrder[a.estimatedImpact] - impactOrder[b.estimatedImpact]);
    const limited = suggestions.slice(0, maxSuggestions);

    const result = {
      datasetId,
      datasetName: dataset.name,
      totalColumns: columns.length,
      suggestionsCount: limited.length,
      suggestions: limited,
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
