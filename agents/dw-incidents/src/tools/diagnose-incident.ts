import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { AnomalySignal, Diagnosis, IncidentType, IncidentSeverity } from '../types.js';
import { relationalStore, messageBus, vectorStore, getIncidentLogger } from '../backends.js';
import { fromDiagnosis } from '../learning/incident-logger.js';
import { StatisticalDetector } from '../engine/statistical-detector.js';
import type { MetricDataPoint, AnomalyDetection } from '../engine/statistical-detector.js';
import { AnomalyClassifier } from '../engine/anomaly-classifier.js';
import { IncidentClassifier } from '../rca/incident-classifier.js';
import type { ClassificationInput } from '../rca/incident-classifier.js';
import { startSpan } from '../tracing.js';

export const diagnoseIncidentDefinition: ToolDefinition = {
  name: 'diagnose_incident',
  description: 'Diagnose a data incident from anomaly signals. Classifies the incident into one of 6 types (schema_change, source_delay, resource_exhaustion, code_regression, infrastructure, quality_degradation), determines severity, and suggests remediation actions.',
  inputSchema: {
    type: 'object',
    properties: {
      anomalySignals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
            value: { type: 'number' },
            expected: { type: 'number' },
            deviation: { type: 'number' },
            source: { type: 'string' },
            timestamp: { type: 'number' },
          },
        },
        description: 'Anomaly signals triggering the diagnosis.',
      },
      customerId: { type: 'string', description: 'Customer ID.' },
      context: { type: 'object', description: 'Additional context (recent changes, affected tables).' },
      logPatterns: { type: 'array', items: { type: 'string' }, description: 'Log patterns observed (e.g. "deploy", "oom", "timeout").' },
      recentChanges: { type: 'array', items: { type: 'string' }, description: 'Recent changes (e.g. "recent deploy", "schema alter", "config change").' },
    },
    required: ['anomalySignals', 'customerId'],
  },
};

const detector = new StatisticalDetector();
const classifier = new AnomalyClassifier();
const incidentClassifier = new IncidentClassifier();

export const diagnoseIncidentHandler: ToolHandler = async (args) => {
  const signals = (args.anomalySignals as AnomalySignal[]) ?? [];
  const customerId = args.customerId as string;
  const startTime = Date.now();
  const span = startSpan('incident.diagnose', { customerId, signalCount: signals.length });

  const incidentId = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Query metric history from relational store for each signal source
  const enrichedSignals = await Promise.all(signals.map(async (signal) => {
    // Get historical metric data from relational store
    const historicalRows = await relationalStore.query(
      'quality_metrics',
      (row) =>
        row.customerId === customerId &&
        row.datasetId === signal.source,
      { column: 'timestamp', direction: 'asc' },
    );

    // Run statistical detection if we have enough historical data
    if (historicalRows.length >= 10) {
      const dataPoints: MetricDataPoint[] = historicalRows
        .filter((row) => {
          const metricLower = (row.metric as string).toLowerCase();
          const signalMetricLower = signal.metric.toLowerCase();
          // Match related metrics
          return metricLower.includes(signalMetricLower.split('_')[0]) || signalMetricLower.includes(metricLower.split('_')[0]);
        })
        .map((row) => ({
          timestamp: row.timestamp as number,
          value: row.value as number,
          metric: row.metric as string,
          source: row.datasetId as string,
        }));

      if (dataPoints.length >= 10) {
        const current: MetricDataPoint = {
          timestamp: signal.timestamp,
          value: signal.value,
          metric: signal.metric,
          source: signal.source,
        };

        const detection = detector.detect(dataPoints, current);
        return {
          ...signal,
          statisticalDetection: {
            isAnomaly: detection.isAnomaly,
            method: detection.method,
            expected: detection.expected,
            deviation: detection.deviation,
            confidence: detection.confidence,
          },
        };
      }
    }

    return signal;
  }));

  // Build AnomalyDetection[] for weighted classification
  const allDetections: AnomalyDetection[] = enrichedSignals.map((s) => {
    if ('statisticalDetection' in s && (s as Record<string, unknown>).statisticalDetection != null) {
      const det = (s as typeof s & { statisticalDetection: { isAnomaly: boolean; method: string; expected: number; deviation: number; confidence: number } }).statisticalDetection;
      return {
        isAnomaly: det.isAnomaly,
        metric: s.metric,
        value: s.value,
        expected: det.expected,
        deviation: det.deviation,
        method: det.method as AnomalyDetection['method'],
        severity: (Math.abs(det.deviation) > 5 ? 'critical' : Math.abs(det.deviation) > 3 ? 'warning' : 'info') as AnomalyDetection['severity'],
        confidence: det.confidence,
        timestamp: s.timestamp,
      };
    }
    // Synthetic AnomalyDetection for signals without statistical detection
    return {
      metric: s.metric,
      value: s.value,
      expected: s.expected,
      deviation: s.deviation,
      isAnomaly: true,
      method: 'semantic' as const,
      severity: (Math.abs(s.deviation) > 5 ? 'critical' : Math.abs(s.deviation) > 3 ? 'warning' : 'info') as AnomalyDetection['severity'],
      confidence: 0.7,
      timestamp: s.timestamp,
    };
  });

  // Classify incident type using weighted IncidentClassifier
  const classificationInput: ClassificationInput = {
    anomalyDetections: allDetections,
    affectedMetrics: signals.map(s => s.metric),
    logPatterns: (args.logPatterns as string[] | undefined),
    recentChanges: (args.recentChanges as string[] | undefined),
  };
  const classification = incidentClassifier.classify(classificationInput);
  const type = classification.type;

  // Use AnomalyClassifier for severity/confidence when statistical detections are available
  const detections = enrichedSignals
    .filter((s): s is typeof s & { statisticalDetection: { isAnomaly: boolean; method: string; expected: number; deviation: number; confidence: number } } =>
      'statisticalDetection' in s && (s as Record<string, unknown>).statisticalDetection != null,
    )
    .map((s) => s);

  let severity: IncidentSeverity;
  let confidence: number;

  if (detections.length > 0) {
    // Build AnomalyDetection objects and classify them
    const classifiedResults = detections.map((enrichedSignal) => {
      const det = (enrichedSignal as typeof enrichedSignal & { statisticalDetection: { isAnomaly: boolean; method: string; expected: number; deviation: number; confidence: number } }).statisticalDetection;
      const anomalyDetection: AnomalyDetection = {
        isAnomaly: det.isAnomaly,
        metric: enrichedSignal.metric,
        value: enrichedSignal.value,
        expected: det.expected,
        deviation: det.deviation,
        method: det.method as AnomalyDetection['method'],
        severity: Math.abs(det.deviation) > 5 ? 'critical' : Math.abs(det.deviation) > 3 ? 'warning' : 'info',
        confidence: det.confidence,
        timestamp: enrichedSignal.timestamp,
      };
      return classifier.classify(anomalyDetection);
    });

    // Use the highest severity from classified results
    const severityOrder: IncidentSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    severity = classifiedResults.reduce<IncidentSeverity>((worst, c) => {
      return severityOrder.indexOf(c.severity) < severityOrder.indexOf(worst) ? c.severity : worst;
    }, 'info');

    // Confidence from classifier detections
    const avgConfidence = detections.reduce((sum, d) => {
      const statDet = (d as typeof d & { statisticalDetection: { confidence: number } }).statisticalDetection;
      return sum + statDet.confidence;
    }, 0) / detections.length;
    confidence = Math.min(0.95, avgConfidence);
  } else {
    // Fallback to signal-based assessment when no statistical detections available
    severity = assessSeverity(signals);
    confidence = calculateConfidence(signals);
  }

  // Find related incidents via vector store
  let relatedIncidents: string[] = [];
  let vectorStoreWarning: string | undefined;
  try {
    const description = `${type} incident on ${signals.map(s => s.source).join(', ')}`;
    const queryVector = await vectorStore.embed(description);
    const similar = await vectorStore.query(queryVector, 3, 'incidents', (meta) => meta.customerId === customerId);
    relatedIncidents = similar.map(s => s.id);
  } catch (e) {
    vectorStoreWarning = `Vector store unavailable: ${e instanceof Error ? e.message : String(e)}`;
  }

  const diagnosis: Diagnosis = {
    incidentId,
    type,
    severity,
    confidence,
    title: generateTitle(type, signals),
    description: generateDescription(type, signals),
    affectedResources: signals.map((s) => s.source),
    suggestedActions: suggestActions(type),
    relatedIncidents,
    enrichedSignals: allDetections.map(d => ({
      metric: d.metric,
      value: d.value,
      expected: d.expected,
      deviation: d.deviation,
      isAnomaly: d.isAnomaly,
      method: d.method,
      severity: d.severity,
      confidence: d.confidence,
    })),
    classificationScores: classification.scores,
    ...(vectorStoreWarning ? { vectorStoreWarning } : {}),
  };

  // Publish incident_detected Kafka event
  await messageBus.publish('incident_detected', {
    id: `evt-det-${Date.now()}`,
    type: 'incident_detected',
    payload: {
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      severity: diagnosis.severity,
      confidence: diagnosis.confidence,
      affectedResources: diagnosis.affectedResources,
      title: diagnosis.title,
    },
    timestamp: Date.now(),
    customerId,
  });

  // Log incident record for learning
  try {
    const logger = getIncidentLogger();
    const incident = fromDiagnosis(diagnosis, customerId);
    const record = logger.createRecord(incident);
    await logger.log(record);
  } catch { /* Don't crash diagnosis on logging failure */ }

  // Emit incident.diagnosed metric for dw-observability
  await messageBus.publish('incident.diagnosed', {
    id: `metric-${Date.now()}`,
    type: 'incident.diagnosed',
    payload: {
      incidentId: diagnosis.incidentId,
      type: diagnosis.type,
      severity: diagnosis.severity,
      confidence: diagnosis.confidence,
      durationMs: Date.now() - startTime,
    },
    timestamp: Date.now(),
    customerId,
  });

  span.setStatus('ok');
  span.end();

  // Include handoff fields so get_root_cause can be called directly from diagnosis output
  const handoff = {
    ...diagnosis,
    incidentType: diagnosis.type,
    customerId,
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(handoff, null, 2) }],
  };
};


function assessSeverity(signals: AnomalySignal[]): IncidentSeverity {
  const maxDeviation = Math.max(...signals.map((s) => Math.abs(s.deviation)));
  if (maxDeviation > 5) return 'critical';
  if (maxDeviation > 3) return 'high';
  if (maxDeviation > 2) return 'medium';
  if (maxDeviation > 1) return 'low';
  return 'info';
}

function calculateConfidence(signals: AnomalySignal[]): number {
  if (signals.length === 0) return 0.5;
  const avgDeviation = signals.reduce((sum, s) => sum + Math.abs(s.deviation), 0) / signals.length;
  return Math.min(0.95, 0.6 + avgDeviation * 0.05);
}

function generateTitle(type: IncidentType, signals: AnomalySignal[]): string {
  const source = signals[0]?.source ?? 'unknown';
  const titles: Record<IncidentType, string> = {
    schema_change: `Schema change detected on ${source}`,
    source_delay: `Data source delay on ${source}`,
    resource_exhaustion: `Resource exhaustion on ${source}`,
    code_regression: `Code regression affecting ${source}`,
    infrastructure: `Infrastructure issue on ${source}`,
    quality_degradation: `Data quality degradation on ${source}`,
  };
  return titles[type];
}

function generateDescription(type: IncidentType, signals: AnomalySignal[]): string {
  const details = signals.map((s) =>
    `${s.metric}: value=${s.value}, expected=${s.expected}, deviation=${s.deviation.toFixed(2)}σ`,
  ).join('; ');
  return `${type.replace(/_/g, ' ')} incident detected. Anomaly signals: ${details}`;
}

function suggestActions(type: IncidentType): string[] {
  const actions: Record<IncidentType, string[]> = {
    schema_change: ['Check recent schema migrations', 'Validate downstream pipelines', 'Update affected dbt models'],
    source_delay: ['Check source system status', 'Verify network connectivity', 'Consider switching to backup source'],
    resource_exhaustion: ['Scale compute resources', 'Optimize expensive queries', 'Check for runaway processes'],
    code_regression: ['Review recent deployments', 'Check pipeline logs', 'Rollback to previous version'],
    infrastructure: ['Check infrastructure health', 'Verify service endpoints', 'Restart affected services'],
    quality_degradation: ['Run data quality checks', 'Compare against historical baselines', 'Investigate upstream changes'],
  };
  return actions[type];
}
