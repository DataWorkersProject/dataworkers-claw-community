/**
 * get_quality_score — Retrieve the real-time quality score for a dataset.
 *
 * Queries historical metrics from the relational store, uses the DataProfiler
 * to get current profile data, and computes a weighted score via ScoreCalculator.
 * Caches results in the KV store. Different datasets return different scores
 * based on actual data.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { DataProfiler } from '../profiler.js';
import { calculateQualityScore } from '../score-calculator.js';
import { warehouseConnector, kvStore, relationalStore } from '../backends.js';
import { QUALITY_THRESHOLDS } from '../config.js';

export const getQualityScoreDefinition: ToolDefinition = {
  name: 'get_quality_score',
  description: 'Retrieve the real-time data quality score (0-100) for a dataset. Includes breakdown by dimension (completeness, accuracy, consistency, freshness, uniqueness) and trend.',
  inputSchema: {
    type: 'object',
    properties: {
      datasetId: { type: 'string' },
      customerId: { type: 'string' },
      source: { type: 'string', description: 'Data source type (e.g. snowflake, bigquery). Default: snowflake.' },
      database: { type: 'string', description: 'Database name. Default: analytics.' },
      schema: { type: 'string', description: 'Schema name. Default: public.' },
    },
    required: ['datasetId', 'customerId'],
  },
};

export const getQualityScoreHandler: ToolHandler = async (args) => {
  const datasetId = args.datasetId as string;
  const customerId = args.customerId as string;
  const source = (args.source as string) ?? 'snowflake';
  const database = (args.database as string) ?? 'analytics';
  const schema = (args.schema as string) ?? 'public';

  try {
    // Check cache first
    const cacheKey = `quality_score:${customerId}:${datasetId}`;
    const cached = await kvStore.get(cacheKey);
    if (cached) {
      return { content: [{ type: 'text', text: cached }] };
    }

    // Profile the actual table
    const profiler = new DataProfiler(warehouseConnector);
    const profile = await profiler.profileTable(customerId, source, database, schema, datasetId);

    if (!profile) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            datasetId,
            score: null,
            message: 'No quality score computed yet',
          }, null, 2),
        }],
      };
    }

    // Query historical row counts for consistency scoring
    const historicalRows = await relationalStore.query(
      'quality_metrics',
      (row) => row.datasetId === datasetId && row.metric === 'row_count',
      { column: 'timestamp', direction: 'asc' },
    );
    const historicalRowCounts = historicalRows.map((r) => r.value as number);

    // Query historical scores for trend detection (from cached scores in KV store)
    const historicalScores: number[] = [];
    const scoreKeys = await kvStore.keys(`quality_score_history:${customerId}:${datasetId}:*`);
    for (const key of scoreKeys) {
      const val = await kvStore.get(key);
      if (val) {
        try {
          historicalScores.push(JSON.parse(val).score);
        } catch {
          // skip malformed entries
        }
      }
    }

    const score = calculateQualityScore(datasetId, profile, historicalRowCounts, historicalScores);

    // Add column-level quality breakdown when profile data is available
    const columnBreakdown = profile.columns.map((col) => {
      const completeness = Math.round((1 - col.nullRate) * 100 * 100) / 100;
      const uniqueness = Math.round(col.distinctRatio * 100 * 100) / 100;
      return {
        column: col.name,
        type: col.type,
        completeness,
        uniqueness,
        nullRate: col.nullRate,
        distinctRatio: col.distinctRatio,
      };
    });

    const scoreWithColumns = {
      ...score,
      ...(columnBreakdown.length > 0 ? { columnBreakdown } : {}),
    };

    // Cache the result with configurable TTL
    const scoreJson = JSON.stringify(scoreWithColumns, null, 2);
    await kvStore.set(cacheKey, scoreJson, QUALITY_THRESHOLDS.scoreCacheTtlMs);

    // Store in history for trend tracking
    await kvStore.set(
      `quality_score_history:${customerId}:${datasetId}:${Date.now()}`,
      JSON.stringify({ score: score.score }),
    );

    return { content: [{ type: 'text', text: scoreJson }] };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Score computation failed: ${error instanceof Error ? error.message : String(error)}`,
          datasetId,
          customerId,
        }, null, 2),
      }],
      isError: true,
    };
  }
};
