/**
 * Quality agent configuration — extracted thresholds and defaults.
 *
 * Centralizes magic numbers from tool handlers so they can be tuned
 * in one place and overridden via environment variables.
 */

export interface QualityThresholds {
  /** Maximum acceptable null rate per column (0-1). Default 0.10. */
  maxNullRate: number;
  /** Minimum acceptable distinct ratio for ID columns (0-1). Default 0.99. */
  minUniqueness: number;
  /** Maximum freshness in hours before a warning. Default 24. */
  maxFreshnessHours: number;
  /** Minimum row count to pass volume check. Default 100_000. */
  minRowCount: number;
  /** Z-score threshold for anomaly detection. Default 3.0. */
  anomalyZScoreThreshold: number;
  /** Minimum data points needed before anomaly detection activates. Default 14. */
  anomalyMinDataPoints: number;
  /** KV cache TTL for quality scores in ms. Default 5 min. */
  scoreCacheTtlMs: number;
}

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Global quality thresholds — reads env vars at import time. */
export const QUALITY_THRESHOLDS: Readonly<QualityThresholds> = Object.freeze({
  maxNullRate: envNumber('DW_QUALITY_MAX_NULL_RATE', 0.10),
  minUniqueness: envNumber('DW_QUALITY_MIN_UNIQUENESS', 0.99),
  maxFreshnessHours: envNumber('DW_QUALITY_MAX_FRESHNESS_HOURS', 24),
  minRowCount: envNumber('DW_QUALITY_MIN_ROW_COUNT', 100_000),
  anomalyZScoreThreshold: envNumber('DW_QUALITY_ANOMALY_ZSCORE', 3.0),
  anomalyMinDataPoints: envNumber('DW_QUALITY_ANOMALY_MIN_POINTS', 14),
  scoreCacheTtlMs: envNumber('DW_QUALITY_SCORE_CACHE_TTL_MS', 5 * 60 * 1000),
});
