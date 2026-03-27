/**
 * get_anomalies — Detect and list data quality anomalies.
 *
 * Uses statistical anomaly detection (z-score) on historical metrics
 * from the relational store. Requires 14+ data points for baseline.
 * Returns bootstrap mode message if insufficient data.
 * Supports deduplication by metric+value grouping.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { QualityAnomaly, AnomalySeverity } from '../types.js';
import { relationalStore } from '../backends.js';
import { QUALITY_THRESHOLDS } from '../config.js';

export const getAnomaliesDefinition: ToolDefinition = {
  name: 'get_anomalies',
  description: 'List detected data quality anomalies with classification. Supports filtering by severity, dataset, and time range. Anomalies are deduplicated (50-100 raw -> 5-10 actionable).',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      datasetId: { type: 'string', description: 'Filter by dataset.' },
      severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
      fromTimestamp: { type: 'number', description: 'Only return anomalies detected after this timestamp (epoch ms).' },
      limit: { type: 'number', description: 'Max results. Default: 20.' },
      deduplicatedOnly: { type: 'boolean', description: 'Only show deduplicated (actionable). Default: true.' },
    },
    required: ['customerId'],
  },
};

/**
 * Simple statistical anomaly detection using z-score.
 * Inlined to avoid cross-agent dependency on dw-incidents.
 */
function detectAnomaly(
  historicalValues: number[],
  currentValue: number,
  threshold: number = 3.0,
): { isAnomaly: boolean; zScore: number; mean: number; stdDev: number } {
  if (historicalValues.length === 0) {
    return { isAnomaly: false, zScore: 0, mean: currentValue, stdDev: 0 };
  }

  const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const variance = historicalValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / historicalValues.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    // All values identical — any deviation is anomalous
    const isAnomaly = currentValue !== mean;
    return { isAnomaly, zScore: isAnomaly ? Infinity : 0, mean, stdDev: 0 };
  }

  const zScore = (currentValue - mean) / stdDev;
  return {
    isAnomaly: Math.abs(zScore) > threshold,
    zScore,
    mean,
    stdDev,
  };
}

/**
 * Deduplicate anomalies by metric+value grouping.
 * Groups anomalies with the same metric and similar values, keeping the
 * most recent one from each group.
 */
function deduplicateAnomalies(anomalies: QualityAnomaly[]): QualityAnomaly[] {
  const groups = new Map<string, QualityAnomaly>();

  for (const anomaly of anomalies) {
    // Group key: metric name + rounded value (to 4 decimal places)
    const valueKey = Math.round(anomaly.value * 10000) / 10000;
    const groupKey = `${anomaly.metric}:${valueKey}`;

    const existing = groups.get(groupKey);
    if (!existing || anomaly.detectedAt > existing.detectedAt) {
      groups.set(groupKey, { ...anomaly, deduplicated: true });
    }
  }

  return Array.from(groups.values());
}

export const getAnomaliesHandler: ToolHandler = async (args) => {
  const customerId = args.customerId as string;
  const datasetId = args.datasetId as string | undefined;
  const severity = args.severity as AnomalySeverity | undefined;
  const fromTimestamp = args.fromTimestamp as number | undefined;
  const limit = (args.limit as number) ?? 20;

  try {
    const metricTypes = ['null_rate', 'row_count', 'uniqueness', 'freshness_hours'];
    const minDataPoints = QUALITY_THRESHOLDS.anomalyMinDataPoints;

    // Query historical metrics from the relational store
    const allMetrics = await relationalStore.query(
      'quality_metrics',
      (row) => {
        if (row.customerId !== customerId) return false;
        if (datasetId && row.datasetId !== datasetId) return false;
        // Apply fromTimestamp filter
        if (fromTimestamp && (row.timestamp as number) < fromTimestamp) return false;
        return true;
      },
      { column: 'timestamp', direction: 'asc' },
    );

    if (allMetrics.length === 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalAnomalies: 0,
            actionableAnomalies: 0,
            anomalies: [],
            message: `No metrics found for customer '${customerId}'.`,
          }, null, 2),
        }],
      };
    }

    // Group metrics by dataset + metric type
    const grouped: Map<string, { datasetId: string; metric: string; values: number[]; timestamps: number[] }> = new Map();
    for (const row of allMetrics) {
      const key = `${row.datasetId}:${row.metric}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          datasetId: row.datasetId as string,
          metric: row.metric as string,
          values: [],
          timestamps: [],
        });
      }
      const group = grouped.get(key)!;
      group.values.push(row.value as number);
      group.timestamps.push(row.timestamp as number);
    }

    // Check each metric group for anomalies
    let anomalies: QualityAnomaly[] = [];

    for (const [, group] of grouped) {
      if (!metricTypes.includes(group.metric)) continue;

      // Need at least minDataPoints for baseline
      if (group.values.length < minDataPoints) {
        continue; // Will return bootstrapMode below if ALL are insufficient
      }

      // Historical = all but last, current = last
      const historical = group.values.slice(0, -1);
      const currentValue = group.values[group.values.length - 1];
      const currentTimestamp = group.timestamps[group.timestamps.length - 1];

      const result = detectAnomaly(historical, currentValue, QUALITY_THRESHOLDS.anomalyZScoreThreshold);

      if (result.isAnomaly) {
        const absZ = Math.abs(result.zScore);
        const anomalySeverity: AnomalySeverity = absZ > 5 ? 'critical' : absZ > 3 ? 'warning' : 'info';

        anomalies.push({
          id: `anom-${group.datasetId}-${group.metric}-${currentTimestamp}`,
          metric: `${group.metric}_${group.datasetId}`,
          severity: anomalySeverity,
          value: currentValue,
          expected: result.mean,
          deviation: result.zScore,
          description: `${group.metric} for ${group.datasetId}: value ${currentValue} deviates ${absZ.toFixed(1)} std devs from mean ${result.mean.toFixed(4)}`,
          detectedAt: currentTimestamp,
          deduplicated: false,
        });
      }
    }

    // Check if we're in bootstrap mode (no group has enough data)
    const sufficientGroups = Array.from(grouped.values()).filter((g) => g.values.length >= minDataPoints);
    if (sufficientGroups.length === 0 && grouped.size > 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            bootstrapMode: true,
            message: 'Collecting baseline data... Need at least 14 data points per metric for anomaly detection.',
            totalAnomalies: 0,
            actionableAnomalies: 0,
            anomalies: [],
            dataPointsCollected: Math.max(...Array.from(grouped.values()).map((g) => g.values.length)),
            dataPointsRequired: minDataPoints,
          }, null, 2),
        }],
      };
    }

    // Filter by severity if requested
    if (severity) {
      anomalies = anomalies.filter((a) => a.severity === severity);
    }

    // Deduplicate anomalies by metric+value grouping
    const deduped = deduplicateAnomalies(anomalies);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalAnomalies: anomalies.length,
          actionableAnomalies: deduped.length,
          anomalies: deduped.slice(0, limit),
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Anomaly detection failed: ${error instanceof Error ? error.message : String(error)}`,
          customerId,
        }, null, 2),
      }],
      isError: true,
    };
  }
};
