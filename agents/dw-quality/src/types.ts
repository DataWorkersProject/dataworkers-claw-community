/**
 * Type definitions for the Quality Monitoring Agent.
 */

export type AnomalySeverity = 'critical' | 'warning' | 'info';
export type MetricType = 'null_rate' | 'uniqueness' | 'distribution' | 'range' | 'referential_integrity' | 'freshness' | 'volume' | 'custom';
export type RemediationType = 'null_imputation' | 'duplicate_removal' | 'outlier_clamping' | 'source_fallback' | 'manual';

/** Represents a connected data source for quality monitoring. */
export interface DataSource {
  id: string;
  name: string;
  type: 'snowflake' | 'bigquery' | 'redshift' | 'postgres' | 'databricks' | 'custom';
  database: string;
  schema: string;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: number;
}

export interface QualityCheckResult {
  datasetId: string;
  customerId: string;
  overallScore: number;
  metrics: QualityMetric[];
  anomalies: QualityAnomaly[];
  checkedAt: number;
  durationMs: number;
  status?: 'completed' | 'partial' | 'failed' | 'no_data';
  dataSource?: DataSource;
  stubFallback?: boolean;
  slaViolations?: SLAViolation[];
}

export interface QualityMetric {
  name: string;
  type: MetricType;
  value: number;
  threshold: number;
  passed: boolean;
  details?: Record<string, unknown>;
}

export interface QualityAnomaly {
  id: string;
  metric: string;
  severity: AnomalySeverity;
  value: number;
  expected: number;
  deviation: number;
  description: string;
  detectedAt: number;
  deduplicated: boolean;
}

export interface QualityScore {
  datasetId: string;
  score: number;
  breakdown: {
    completeness: number;
    accuracy: number;
    consistency: number;
    freshness: number;
    uniqueness: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  updatedAt: number;
}

export interface SLAAlertConfig {
  channels: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  notifyOnViolation: boolean;
}

export interface SLADefinition {
  id: string;
  datasetId: string;
  customerId: string;
  rules: SLARule[];
  alertConfig?: SLAAlertConfig;
  createdAt: number;
  updatedAt: number;
}

export interface SLARule {
  metric: MetricType;
  operator: 'lt' | 'gt' | 'lte' | 'gte' | 'eq';
  threshold: number;
  severity: AnomalySeverity;
  description: string;
}

export interface RemediationAction {
  type: RemediationType;
  target: string;
  description: string;
  automated: boolean;
  executedAt?: number;
  result?: 'success' | 'failed' | 'skipped';
  rollbackAvailable: boolean;
}

/** An SLA violation detected during quality evaluation. */
export interface SLAViolation {
  id: string;
  slaId: string;
  datasetId: string;
  customerId: string;
  rule: SLARule;
  actualValue: number;
  violatedAt: number;
  severity: AnomalySeverity;
  description: string;
}
