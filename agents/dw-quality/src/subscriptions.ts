/**
 * Cross-agent event subscriptions for dw-quality.
 *
 * Subscribes to events from:
 * - incidents: sla_breached, incident_created
 * - catalog: schema_changed, table_registered
 * - schema: migration_applied
 * - pipelines: pipeline_completed, pipeline_failed
 *
 * Publishes:
 * - quality_check_completed (from run-quality-check.ts)
 * - anomaly_detected (from run-quality-check.ts)
 * - sla_violation (from sla-evaluator.ts)
 */

import { messageBus, kvStore } from './backends.js';

interface BusEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  customerId: string;
}

// Subscribe to sla_breached — track for quality freshness
messageBus.subscribe('sla_breached', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  kvStore.set(`sla_breach:${payload.topology}`, JSON.stringify({
    topology: payload.topology,
    totalLag: payload.totalLag,
    threshold: payload.threshold,
    detectedAt: event.timestamp,
  })).catch(() => {});
});

// Subscribe to incident_created — flag dataset for re-check
messageBus.subscribe('incident_created', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  if (payload.datasetId) {
    kvStore.set(`quality_recheck_needed:${payload.datasetId}`, JSON.stringify({
      reason: 'incident_created',
      incidentId: payload.incidentId ?? event.id,
      detectedAt: event.timestamp,
    })).catch(() => {});
  }
});

// Subscribe to schema_changed — invalidate quality cache
messageBus.subscribe('schema_changed', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  const datasetId = payload.table ?? payload.datasetId;
  if (datasetId) {
    // Invalidate cached quality scores when schema changes
    kvStore.delete(`quality_score:${event.customerId}:${datasetId}`).catch(() => {});
    kvStore.set(`quality_recheck_needed:${datasetId}`, JSON.stringify({
      reason: 'schema_changed',
      detectedAt: event.timestamp,
    })).catch(() => {});
  }
});

// Subscribe to migration_applied — invalidate quality cache
messageBus.subscribe('migration_applied', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  const datasetId = payload.table ?? payload.datasetId;
  if (datasetId) {
    kvStore.delete(`quality_score:${event.customerId}:${datasetId}`).catch(() => {});
  }
});

// Subscribe to pipeline_completed — trigger quality tracking
messageBus.subscribe('pipeline_completed', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  if (payload.targetDataset) {
    kvStore.set(`pipeline_completed:${payload.targetDataset}`, JSON.stringify({
      pipelineId: payload.pipelineId,
      completedAt: event.timestamp,
    })).catch(() => {});
  }
});

// Subscribe to pipeline_failed — flag for quality impact
messageBus.subscribe('pipeline_failed', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  if (payload.targetDataset) {
    kvStore.set(`pipeline_failed:${payload.targetDataset}`, JSON.stringify({
      pipelineId: payload.pipelineId,
      error: payload.error,
      failedAt: event.timestamp,
    })).catch(() => {});
  }
});

export const SUBSCRIPTIONS_INITIALIZED = true;
