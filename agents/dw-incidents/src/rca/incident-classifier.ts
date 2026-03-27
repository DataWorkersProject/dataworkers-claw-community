import type { IncidentType } from '../types.js';
import type { AnomalyDetection } from '../engine/statistical-detector.js';

/**
 * 6-Type Incident Classifier (REQ-INC-002).
 *
 * Classifies incidents into:
 * 1. schema_change: column added/removed/type changed
 * 2. source_delay: upstream data not arriving on time
 * 3. resource_exhaustion: CPU/memory/disk limits hit
 * 4. code_regression: recent code change caused failure
 * 5. infrastructure: network, database, service outage
 * 6. quality_degradation: data quality metrics declining
 *
 * Uses weighted feature scoring for 90%+ accuracy target.
 */

export interface ClassificationResult {
  type: IncidentType;
  confidence: number;
  scores: Record<IncidentType, number>;
  features: string[];
}

export interface ClassificationInput {
  anomalyDetections: AnomalyDetection[];
  recentChanges?: string[];
  logPatterns?: string[];
  affectedMetrics: string[];
}

const FEATURE_WEIGHTS: Record<string, Partial<Record<IncidentType, number>>> = {
  'metric:schema': { schema_change: 0.9, quality_degradation: 0.1 },
  'metric:column': { schema_change: 0.8, quality_degradation: 0.2 },
  'metric:latency': { source_delay: 0.6, resource_exhaustion: 0.3, infrastructure: 0.1 },
  'metric:delay': { source_delay: 0.8, infrastructure: 0.2 },
  'metric:lag': { source_delay: 0.7, infrastructure: 0.3 },
  'metric:memory': { resource_exhaustion: 0.9, infrastructure: 0.1 },
  'metric:cpu': { resource_exhaustion: 0.8, infrastructure: 0.2 },
  'metric:disk': { resource_exhaustion: 0.7, infrastructure: 0.3 },
  'metric:error_rate': { code_regression: 0.6, infrastructure: 0.3, quality_degradation: 0.1 },
  'metric:failure': { code_regression: 0.5, infrastructure: 0.4, resource_exhaustion: 0.1 },
  'metric:uptime': { infrastructure: 0.9, resource_exhaustion: 0.1 },
  'metric:connection': { infrastructure: 0.8, source_delay: 0.2 },
  'metric:null_rate': { quality_degradation: 0.8, schema_change: 0.2 },
  'metric:row_count': { quality_degradation: 0.5, source_delay: 0.3, schema_change: 0.2 },
  'metric:freshness': { source_delay: 0.6, quality_degradation: 0.3, infrastructure: 0.1 },
  'log:deploy': { code_regression: 0.8, schema_change: 0.2 },
  'log:migration': { schema_change: 0.9, code_regression: 0.1 },
  'log:oom': { resource_exhaustion: 0.95 },
  'log:timeout': { source_delay: 0.5, resource_exhaustion: 0.3, infrastructure: 0.2 },
  'change:recent_deploy': { code_regression: 0.7, schema_change: 0.2 },
  'change:schema_alter': { schema_change: 0.95 },
  'change:config': { code_regression: 0.5, infrastructure: 0.3 },
};

export class IncidentClassifier {
  /**
   * Classify an incident based on anomaly detections, logs, and recent changes.
   */
  classify(input: ClassificationInput): ClassificationResult {
    const scores: Record<IncidentType, number> = {
      schema_change: 0,
      source_delay: 0,
      resource_exhaustion: 0,
      code_regression: 0,
      infrastructure: 0,
      quality_degradation: 0,
    };

    const features: string[] = [];

    // Score from anomaly metric names
    for (const detection of input.anomalyDetections) {
      const metricLower = detection.metric.toLowerCase();
      for (const [feature, weights] of Object.entries(FEATURE_WEIGHTS)) {
        if (feature.startsWith('metric:') && metricLower.includes(feature.split(':')[1])) {
          features.push(feature);
          for (const [type, weight] of Object.entries(weights)) {
            scores[type as IncidentType] += weight * Math.abs(detection.deviation) / 3;
          }
        }
      }
    }

    // Score from log patterns
    for (const pattern of input.logPatterns ?? []) {
      const patternLower = pattern.toLowerCase();
      for (const [feature, weights] of Object.entries(FEATURE_WEIGHTS)) {
        if (feature.startsWith('log:') && patternLower.includes(feature.split(':')[1])) {
          features.push(feature);
          for (const [type, weight] of Object.entries(weights)) {
            scores[type as IncidentType] += weight;
          }
        }
      }
    }

    // Score from recent changes
    for (const change of input.recentChanges ?? []) {
      const changeLower = change.toLowerCase();
      for (const [feature, weights] of Object.entries(FEATURE_WEIGHTS)) {
        if (feature.startsWith('change:') && changeLower.includes(feature.split(':')[1].replace('_', ' '))) {
          features.push(feature);
          for (const [type, weight] of Object.entries(weights)) {
            scores[type as IncidentType] += weight;
          }
        }
      }
    }

    // Normalize scores
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      for (const type of Object.keys(scores) as IncidentType[]) {
        scores[type] = scores[type] / maxScore;
      }
    } else {
      // Zero-feature fallback: no features matched any weights
      return { type: 'quality_degradation', confidence: 0.5, scores, features: [] };
    }

    // Find the highest scoring type
    const entries = Object.entries(scores) as Array<[IncidentType, number]>;
    entries.sort((a, b) => b[1] - a[1]);
    const topType = entries[0][0];
    const topScore = entries[0][1];

    return {
      type: topType,
      confidence: Math.min(0.95, topScore),
      scores,
      features,
    };
  }
}
