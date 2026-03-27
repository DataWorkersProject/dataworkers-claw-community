/**
 * get_quality_summary — Returns a quality summary for a dataset.
 *
 * Provides overall quality score and dimension breakdown from cached
 * quality data or seed defaults. Used by cross-agent requests from
 * dw-insights for anomaly correlation.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { kvStore } from '../backends.js';

export const getQualitySummaryDefinition: ToolDefinition = {
  name: 'get_quality_summary',
  description: 'Get a quality summary for a dataset, including overall score and dimension breakdown (completeness, accuracy, consistency, freshness, uniqueness).',
  inputSchema: {
    type: 'object',
    properties: {
      datasetId: { type: 'string', description: 'Dataset or metric name to get quality summary for.' },
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['datasetId'],
  },
};

export const getQualitySummaryHandler: ToolHandler = async (args) => {
  const datasetId = args.datasetId as string;
  const customerId = (args.customerId as string) || 'default';

  try {
    // Try to get cached quality score
    const cacheKey = `quality_score:${customerId}:${datasetId}`;
    const cached = await kvStore.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            datasetId,
            score: parsed.score ?? parsed.overallScore ?? 85,
            dimensions: parsed.dimensions ?? {
              completeness: 92,
              accuracy: 88,
              consistency: 85,
              freshness: 80,
              uniqueness: 95,
            },
            status: 'cached',
          }, null, 2),
        }],
      };
    }

    // Return seed defaults when no cached data is available
    const seedScores: Record<string, number> = {
      revenue_daily: 92,
      user_metrics: 88,
      orders: 85,
      customers: 90,
    };

    const score = seedScores[datasetId] ?? 75;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          datasetId,
          score,
          dimensions: {
            completeness: Math.min(100, score + 5),
            accuracy: Math.max(60, score - 2),
            consistency: Math.max(60, score - 5),
            freshness: Math.max(60, score - 8),
            uniqueness: Math.min(100, score + 8),
          },
          status: 'seed',
        }, null, 2),
      }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
