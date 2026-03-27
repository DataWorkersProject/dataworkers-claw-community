import type { MetricDataPoint, AnomalyDetection } from './statistical-detector.js';
import { StatisticalDetector } from './statistical-detector.js';

/**
 * Continuous Metric Monitor (REQ-INC-001, REQ-INC-005).
 *
 * Monitors pipeline execution metrics:
 * - Latency (query/pipeline execution time)
 * - Row counts (source/target record counts)
 * - Null rates (percentage of NULL values per column)
 * - Schema conformance (column count, type matches)
 * - Resource utilization (CPU, memory, disk)
 *
 * Target: <60s detection latency.
 */

export type MonitoredMetricType =
  | 'latency'
  | 'row_count'
  | 'null_rate'
  | 'schema_conformance'
  | 'resource_cpu'
  | 'resource_memory'
  | 'resource_disk'
  | 'error_rate'
  | 'freshness';

export interface MonitorConfig {
  checkIntervalMs: number;
  metricsToMonitor: MonitoredMetricType[];
  alertThresholds: Record<string, number>;
}

export interface MetricBaseline {
  metric: string;
  source: string;
  history: MetricDataPoint[];
  lastUpdated: number;
  seasonality?: SeasonalityPattern;
}

export interface SeasonalityPattern {
  type: 'daily' | 'weekly' | 'monthly';
  weekdayMultiplier: number;
  weekendMultiplier: number;
  monthEndMultiplier: number;
}

// --- Semantic Pattern Detection ---

export interface SemanticRule {
  id: string;
  name: string;
  description: string;
  evaluate: (point: MetricDataPoint, baseline: MetricBaseline | undefined) => SemanticViolation | null;
}

export interface SemanticViolation {
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  expected: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
}

// Built-in semantic rules

/** Null rate should never exceed 50% */
export const nullRateRule: SemanticRule = {
  id: 'format-null-rate-max',
  name: 'Null Rate Threshold',
  description: 'Null rate should never exceed 50%',
  evaluate: (point, _baseline) => {
    if (point.metric !== 'null_rate') return null;
    if (point.value > 50) {
      return {
        ruleId: 'format-null-rate-max',
        ruleName: 'Null Rate Threshold',
        metric: point.metric,
        value: point.value,
        expected: '<=50%',
        severity: point.value > 80 ? 'critical' : 'warning',
        confidence: 0.95,
      };
    }
    return null;
  },
};

/** Row count should never be 0 for active tables */
export const zeroRowCountRule: SemanticRule = {
  id: 'business-zero-rows',
  name: 'Zero Row Count',
  description: 'Row count should never be 0 for active tables',
  evaluate: (point, baseline) => {
    if (point.metric !== 'row_count') return null;
    // Only flag if baseline exists (table was previously active)
    if (point.value === 0 && baseline && baseline.history.length > 0) {
      return {
        ruleId: 'business-zero-rows',
        ruleName: 'Zero Row Count',
        metric: point.metric,
        value: point.value,
        expected: '>0 (active table)',
        severity: 'critical',
        confidence: 0.9,
      };
    }
    return null;
  },
};

/** Latency should never exceed 10x baseline */
export const latencyBaselineRule: SemanticRule = {
  id: 'threshold-latency-10x',
  name: 'Latency 10x Baseline',
  description: 'Latency should never exceed 10x baseline',
  evaluate: (point, baseline) => {
    if (point.metric !== 'latency') return null;
    if (!baseline || baseline.history.length === 0) return null;
    const avg = baseline.history.reduce((s, p) => s + p.value, 0) / baseline.history.length;
    if (avg > 0 && point.value > avg * 10) {
      return {
        ruleId: 'threshold-latency-10x',
        ruleName: 'Latency 10x Baseline',
        metric: point.metric,
        value: point.value,
        expected: `<=${(avg * 10).toFixed(1)} (10x avg ${avg.toFixed(1)})`,
        severity: 'critical',
        confidence: 0.85,
      };
    }
    return null;
  },
};

export class MetricMonitor {
  private detector: StatisticalDetector;
  private baselines = new Map<string, MetricBaseline>();
  private config: MonitorConfig;
  private alertCallbacks: Array<(detection: AnomalyDetection) => void> = [];
  private semanticRules: SemanticRule[] = [];

  constructor(config?: Partial<MonitorConfig>) {
    this.config = {
      checkIntervalMs: 60_000, // 60s per REQ-INC-001
      metricsToMonitor: ['latency', 'row_count', 'null_rate', 'error_rate', 'freshness'],
      alertThresholds: {},
      ...config,
    };
    this.detector = new StatisticalDetector();
  }

  /**
   * Register a callback for anomaly alerts.
   */
  onAlert(callback: (detection: AnomalyDetection) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Record a metric data point and check for anomalies.
   */
  recordMetric(point: MetricDataPoint): AnomalyDetection | null {
    const key = `${point.source}:${point.metric}`;
    let baseline = this.baselines.get(key);

    if (!baseline) {
      baseline = {
        metric: point.metric,
        source: point.source,
        history: [],
        lastUpdated: Date.now(),
      };
      this.baselines.set(key, baseline);
    }

    // Apply seasonality adjustment
    const adjustedPoint = this.applySeasonalityAdjustment(point, baseline.seasonality);

    // Check for anomaly
    const detection = this.detector.detect(baseline.history, adjustedPoint);

    // Update baseline
    baseline.history.push(point);
    // Keep last 1000 data points
    if (baseline.history.length > 1000) {
      baseline.history = baseline.history.slice(-1000);
    }
    baseline.lastUpdated = Date.now();

    // Fire alerts
    if (detection.isAnomaly) {
      for (const cb of this.alertCallbacks) {
        cb(detection);
      }
      return detection;
    }

    return null;
  }

  /**
   * Set seasonality pattern for a metric.
   */
  setSeasonality(source: string, metric: string, pattern: SeasonalityPattern): void {
    const key = `${source}:${metric}`;
    let baseline = this.baselines.get(key);
    if (!baseline) {
      baseline = {
        metric,
        source,
        history: [],
        lastUpdated: Date.now(),
      };
      this.baselines.set(key, baseline);
    }
    baseline.seasonality = pattern;
  }

  /**
   * Get the baseline for a metric.
   */
  getBaseline(source: string, metric: string): MetricBaseline | undefined {
    return this.baselines.get(`${source}:${metric}`);
  }

  /**
   * Get all monitored metrics.
   */
  getMonitoredMetrics(): string[] {
    return Array.from(this.baselines.keys());
  }

  /**
   * Register a semantic rule for pattern-based detection.
   */
  registerSemanticRule(rule: SemanticRule): void {
    this.semanticRules.push(rule);
  }

  /**
   * Evaluate all registered semantic rules against a data point.
   */
  evaluateSemanticRules(point: MetricDataPoint): SemanticViolation[] {
    const baseline = this.getBaseline(point.source, point.metric);
    const violations: SemanticViolation[] = [];
    for (const rule of this.semanticRules) {
      const violation = rule.evaluate(point, baseline);
      if (violation) violations.push(violation);
    }
    return violations;
  }

  /**
   * Apply seasonality adjustment to a data point.
   */
  private applySeasonalityAdjustment(
    point: MetricDataPoint,
    pattern?: SeasonalityPattern,
  ): MetricDataPoint {
    if (!pattern) return point;

    const date = new Date(point.timestamp);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    let multiplier = 1;

    // Weekend vs weekday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      multiplier = pattern.weekendMultiplier;
    } else {
      multiplier = pattern.weekdayMultiplier;
    }

    // Month-end (last 3 days)
    if (dayOfMonth >= daysInMonth - 2) {
      multiplier *= pattern.monthEndMultiplier;
    }

    return {
      ...point,
      value: point.value / multiplier, // Normalize for comparison
    };
  }
}
