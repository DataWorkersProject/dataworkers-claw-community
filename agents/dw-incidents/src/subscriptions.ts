import type { AnomalySignal } from './types.js';
import { messageBus } from './backends.js';
import { diagnoseIncidentHandler } from './tools/diagnose-incident.js';

interface BusEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  customerId: string;
}

/**
 * Cross-agent event subscriptions for dw-incidents.
 * Auto-creates incidents from events published by other agents.
 */

// Subscribe to quality anomalies from dw-quality
messageBus.subscribe('quality_anomaly_detected', (event: BusEvent) => {
  const payload = event.payload;
  const customerId = event.customerId ?? (payload.customerId as string) ?? 'unknown';

  // Adapt quality anomaly to AnomalySignal format
  const signals: AnomalySignal[] = [{
    metric: (payload.metric as string) ?? 'quality_score',
    value: (payload.value as number) ?? 0,
    expected: (payload.expected as number) ?? 1.0,
    deviation: (payload.deviation as number) ?? 3.0,
    source: (payload.datasetId as string) ?? (payload.source as string) ?? 'unknown',
    timestamp: event.timestamp,
  }];

  // Auto-diagnose
  diagnoseIncidentHandler({ anomalySignals: signals, customerId }).catch(() => {
    /* Don't crash subscription on diagnosis failure */
  });
});

// Subscribe to schema changes from dw-schema
messageBus.subscribe('schema_change_detected', (event: BusEvent) => {
  const payload = event.payload;
  const customerId = event.customerId ?? (payload.customerId as string) ?? 'unknown';

  const signals: AnomalySignal[] = [{
    metric: 'schema_change',
    value: 1,
    expected: 0,
    deviation: 5.0, // Schema changes are always significant
    source: (payload.tableName as string) ?? (payload.source as string) ?? 'unknown',
    timestamp: event.timestamp,
  }];

  diagnoseIncidentHandler({
    anomalySignals: signals,
    customerId,
    logPatterns: ['migration'],
    recentChanges: [(payload.changeType as string) ?? 'schema_alter'],
  }).catch(() => { /* Don't crash */ });
});

// Subscribe to pipeline failures from dw-pipelines
messageBus.subscribe('pipeline_failed', (event: BusEvent) => {
  const payload = event.payload;
  const customerId = event.customerId ?? (payload.customerId as string) ?? 'unknown';

  const signals: AnomalySignal[] = [{
    metric: 'error_rate',
    value: 100,
    expected: 0,
    deviation: 10.0, // Pipeline failure is critical
    source: (payload.pipelineId as string) ?? (payload.source as string) ?? 'unknown',
    timestamp: event.timestamp,
  }];

  diagnoseIncidentHandler({
    anomalySignals: signals,
    customerId,
    recentChanges: payload.deploymentInfo ? ['recent_deploy'] : undefined,
  }).catch(() => { /* Don't crash */ });
});

// Stream health critical → create incident
messageBus.subscribe('stream_health_changed', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  if (payload.currentStatus === 'CRITICAL') {
    const signals: AnomalySignal[] = [{ metric: 'stream_health', value: 0, expected: 1, deviation: 10, source: (payload.topology as string) ?? 'unknown', timestamp: event.timestamp }];
    diagnoseIncidentHandler({ anomalySignals: signals, customerId: event.customerId ?? 'system' }).catch(() => {});
  }
});

// SLA breached → create incident
messageBus.subscribe('sla_breached', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  const signals: AnomalySignal[] = [{ metric: 'sla_lag', value: (payload.totalLag as number) ?? 0, expected: (payload.threshold as number) ?? 5000, deviation: 5, source: (payload.topology as string) ?? 'unknown', timestamp: event.timestamp }];
  diagnoseIncidentHandler({ anomalySignals: signals, customerId: event.customerId ?? 'system' }).catch(() => {});
});

export const SUBSCRIPTIONS_INITIALIZED = true;
