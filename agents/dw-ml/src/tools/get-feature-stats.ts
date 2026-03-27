/**
 * get_feature_stats — Compute feature distribution stats for a dataset.
 *
 * Community/read tool. Returns mean, std, min, max, percentiles, null rate,
 * and histogram bins for numeric features.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ColumnInfo } from '../types.js';
import { relationalStore, seeded } from '../backends.js';

export const getFeatureStatsDefinition: ToolDefinition = {
  name: 'get_feature_stats',
  description:
    'Compute feature distribution statistics (mean, std, min, max, percentiles, null rate) for a dataset\'s features.',
  inputSchema: {
    type: 'object',
    properties: {
      dataset_id: { type: 'string', description: 'ID of the dataset to analyze.' },
      features: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific features to analyze. If omitted, analyzes all features.',
      },
    },
    required: ['dataset_id'],
  },
};

/**
 * Simulate feature stats based on column metadata.
 */
function computeStats(col: ColumnInfo): Record<string, unknown> {
  if (col.type === 'numeric') {
    const samples = col.sampleValues as number[];
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const std = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length);

    return {
      type: 'numeric',
      mean: Number(mean.toFixed(4)),
      std: Number(std.toFixed(4)),
      min,
      max,
      p25: Number((min + (max - min) * 0.25).toFixed(4)),
      p50: Number((min + (max - min) * 0.50).toFixed(4)),
      p75: Number((min + (max - min) * 0.75).toFixed(4)),
      nullRate: col.nullRate,
      cardinality: col.cardinality,
    };
  }

  if (col.type === 'categorical') {
    return {
      type: 'categorical',
      uniqueValues: col.cardinality,
      sampleValues: col.sampleValues,
      nullRate: col.nullRate,
    };
  }

  if (col.type === 'boolean') {
    return {
      type: 'boolean',
      uniqueValues: col.cardinality,
      sampleValues: col.sampleValues,
      nullRate: col.nullRate,
    };
  }

  if (col.type === 'datetime') {
    return {
      type: 'datetime',
      sampleValues: col.sampleValues,
      nullRate: col.nullRate,
      cardinality: col.cardinality,
    };
  }

  return {
    type: col.type,
    nullRate: col.nullRate,
    cardinality: col.cardinality,
  };
}

export const getFeatureStatsHandler: ToolHandler = async (args) => {
  await seeded;

  const datasetId = args.dataset_id as string;
  const featureFilter = args.features as string[] | undefined;

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

    const targetColumns = featureFilter
      ? columns.filter((c) => featureFilter.includes(c.name))
      : columns;

    if (featureFilter && targetColumns.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `None of the specified features found in dataset "${datasetId}"` }) }],
        isError: true,
      };
    }

    const stats = targetColumns.map((col) => ({
      feature: col.name,
      ...computeStats(col),
    }));

    const result = {
      datasetId,
      datasetName: dataset.name,
      rowCount: dataset.rowCount,
      featureCount: stats.length,
      stats,
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
