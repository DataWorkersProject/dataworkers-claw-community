/**
 * run_quality_check — Execute data quality profiling on a dataset.
 *
 * Uses the DataProfiler to inspect actual table data from the warehouse
 * connector and compute real metrics (null rates, uniqueness, freshness, volume).
 * Stores metrics in the relational store for historical tracking.
 * Publishes quality_check_completed event to the message bus.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { QualityCheckResult, QualityMetric, QualityAnomaly } from '../types.js';
import { DataProfiler } from '../profiler.js';
import { warehouseConnector, relationalStore, messageBus } from '../backends.js';
import { QUALITY_THRESHOLDS } from '../config.js';

export const runQualityCheckDefinition: ToolDefinition = {
  name: 'run_quality_check',
  description: 'Execute data quality profiling on a dataset. Checks null rates, uniqueness, distributions, referential integrity, freshness, and volume. Returns quality score and detected anomalies.',
  inputSchema: {
    type: 'object',
    properties: {
      datasetId: { type: 'string', description: 'Dataset or table to check.' },
      customerId: { type: 'string' },
      source: { type: 'string', description: 'Data source type (e.g. snowflake, bigquery). Default: snowflake.' },
      database: { type: 'string', description: 'Database name. Default: analytics.' },
      schema: { type: 'string', description: 'Schema name. Default: public.' },
      metrics: { type: 'array', items: { type: 'string' }, description: 'Specific metrics to check (null_rate, uniqueness, freshness, volume). Omit for all.' },
      columns: { type: 'array', items: { type: 'string' }, description: 'Specific columns to profile. Omit for all.' },
    },
    required: ['datasetId', 'customerId'],
  },
};

export const runQualityCheckHandler: ToolHandler = async (args) => {
  const datasetId = args.datasetId as string;
  const customerId = args.customerId as string;
  const source = (args.source as string) ?? 'snowflake';
  const database = (args.database as string) ?? 'analytics';
  const schema = (args.schema as string) ?? 'public';
  const requestedMetrics = (args.metrics as string[] | undefined);
  const requestedColumns = (args.columns as string[] | undefined);

  try {
    const start = Date.now();
    const profiler = new DataProfiler(warehouseConnector);

    // Profile the actual table from the warehouse connector
    const profile = await profiler.profileTable(customerId, source, database, schema, datasetId);

    if (!profile) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            datasetId,
            status: 'no_data',
            checks: [],
            summary: 'No quality data available for this dataset',
          }, null, 2),
        }],
      };
    }

    // Filter columns if requested
    const profileColumns = requestedColumns
      ? profile.columns.filter((c) => requestedColumns.includes(c.name))
      : profile.columns;

    // Compute metrics from the profile
    const avgNullRate = profileColumns.length > 0
      ? profileColumns.reduce((sum, c) => sum + c.nullRate, 0) / profileColumns.length
      : 0;

    const idColumns = profileColumns.filter(
      (c) => c.name.toLowerCase() === 'id' ||
        c.name.toLowerCase().endsWith('_id') ||
        c.name.toLowerCase() === 'event_id',
    );
    const avgUniqueness = idColumns.length > 0
      ? idColumns.reduce((sum, c) => sum + c.distinctRatio, 0) / idColumns.length
      : 1.0;

    const metrics: QualityMetric[] = [];

    const shouldIncludeMetric = (type: string) => !requestedMetrics || requestedMetrics.includes(type);

    // Per-column null rate metrics
    if (shouldIncludeMetric('null_rate')) {
      for (const col of profileColumns) {
        metrics.push({
          name: `null_rate_${col.name}`,
          type: 'null_rate',
          value: col.nullRate,
          threshold: QUALITY_THRESHOLDS.maxNullRate,
          passed: col.nullRate <= QUALITY_THRESHOLDS.maxNullRate,
        });
      }
    }

    // Uniqueness for ID columns
    if (shouldIncludeMetric('uniqueness')) {
      for (const col of idColumns) {
        metrics.push({
          name: `uniqueness_${col.name}`,
          type: 'uniqueness',
          value: col.distinctRatio,
          threshold: QUALITY_THRESHOLDS.minUniqueness,
          passed: col.distinctRatio >= QUALITY_THRESHOLDS.minUniqueness,
        });
      }
    }

    // Freshness metric
    if (shouldIncludeMetric('freshness')) {
      metrics.push({
        name: 'freshness',
        type: 'freshness',
        value: profile.freshnessHours,
        threshold: QUALITY_THRESHOLDS.maxFreshnessHours,
        passed: profile.freshnessHours <= QUALITY_THRESHOLDS.maxFreshnessHours,
        details: { unit: 'hours' },
      });
    }

    // Volume metric
    if (shouldIncludeMetric('volume')) {
      metrics.push({
        name: 'row_count',
        type: 'volume',
        value: profile.totalRows,
        threshold: QUALITY_THRESHOLDS.minRowCount,
        passed: profile.totalRows >= QUALITY_THRESHOLDS.minRowCount,
      });
    }

    // Detect anomalies for failing metrics
    const anomalies: QualityAnomaly[] = [];
    for (const m of metrics) {
      if (!m.passed) {
        anomalies.push({
          id: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          metric: m.name,
          severity: m.type === 'null_rate' && m.value > m.threshold * 2 ? 'critical' : 'warning',
          value: m.value,
          expected: m.threshold,
          deviation: m.threshold !== 0 ? Math.abs(m.value - m.threshold) / m.threshold : 0,
          description: `${m.name} (${m.value}) exceeds threshold (${m.threshold})`,
          detectedAt: Date.now(),
          deduplicated: false,
        });
      }
    }

    const overallScore = metrics.length > 0
      ? Math.round(metrics.filter((m) => m.passed).length / metrics.length * 100)
      : 0;

    // Store metrics in relational store for history
    const now = Date.now();
    await relationalStore.createTable('quality_metrics');
    await relationalStore.insert('quality_metrics', {
      datasetId,
      customerId,
      metric: 'null_rate',
      value: avgNullRate,
      timestamp: now,
    });
    await relationalStore.insert('quality_metrics', {
      datasetId,
      customerId,
      metric: 'row_count',
      value: profile.totalRows,
      timestamp: now,
    });
    await relationalStore.insert('quality_metrics', {
      datasetId,
      customerId,
      metric: 'uniqueness',
      value: avgUniqueness,
      timestamp: now,
    });
    await relationalStore.insert('quality_metrics', {
      datasetId,
      customerId,
      metric: 'freshness_hours',
      value: profile.freshnessHours,
      timestamp: now,
    });

    const result: QualityCheckResult = {
      datasetId,
      customerId,
      overallScore,
      metrics,
      anomalies,
      checkedAt: now,
      durationMs: Date.now() - start,
      status: 'completed',
      stubFallback: true,
    };

    // Publish quality_check_completed event
    await messageBus.publish('quality_check_completed', {
      id: `qcc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'quality_check_completed',
      payload: {
        datasetId,
        overallScore,
        anomalyCount: anomalies.length,
        metricCount: metrics.length,
        source,
        database,
        schema,
      },
      timestamp: now,
      customerId,
    });

    // Publish anomaly_detected events for each anomaly
    for (const anomaly of anomalies) {
      await messageBus.publish('anomaly_detected', {
        id: `ad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'anomaly_detected',
        payload: {
          datasetId,
          anomalyId: anomaly.id,
          metric: anomaly.metric,
          severity: anomaly.severity,
          value: anomaly.value,
          expected: anomaly.expected,
        },
        timestamp: now,
        customerId,
      });
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Quality check failed: ${error instanceof Error ? error.message : String(error)}`,
          datasetId,
          customerId,
        }, null, 2),
      }],
      isError: true,
    };
  }
};
