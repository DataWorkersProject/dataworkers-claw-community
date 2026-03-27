/**
 * Quality Score Calculator — computes weighted quality scores from profile results.
 *
 * Dimensions and weights:
 * - completeness  30%  (1 - avg null rate)
 * - freshness     25%  (time since last update)
 * - uniqueness    20%  (distinct ratio for ID columns)
 * - accuracy      15%  (penalizes columns with >10% nulls)
 * - consistency   10%  (row count stability vs historical)
 */

import type { ProfileResult } from './profiler.js';
import type { QualityScore } from './types.js';

/**
 * Calculate a weighted quality score from a profile result.
 *
 * @param datasetId - The dataset being scored.
 * @param profile - Profiling result from the DataProfiler.
 * @param historicalRowCounts - Previous row counts for consistency scoring.
 * @param historicalScores - Previous overall scores for trend detection.
 */
export function calculateQualityScore(
  datasetId: string,
  profile: ProfileResult,
  historicalRowCounts: number[] = [],
  historicalScores: number[] = [],
): QualityScore {
  // Completeness: average (1 - null_rate) across all columns, scaled to 100
  const completeness = profile.columns.length > 0
    ? (profile.columns.reduce((sum, col) => sum + (1 - col.nullRate), 0) / profile.columns.length) * 100
    : 100;

  // Freshness: 100 if < 6h, linearly drops to 0 at 48h
  let freshness: number;
  if (profile.freshnessHours <= 6) {
    freshness = 100;
  } else if (profile.freshnessHours >= 48) {
    freshness = 0;
  } else {
    freshness = 100 - ((profile.freshnessHours - 6) / (48 - 6)) * 100;
  }

  // Uniqueness: average distinct_ratio for ID/unique columns (or all if none)
  const idColumns = profile.columns.filter(
    (c) => c.name.toLowerCase() === 'id' ||
      c.name.toLowerCase().endsWith('_id') ||
      c.name.toLowerCase() === 'event_id',
  );
  const uniquenessColumns = idColumns.length > 0 ? idColumns : profile.columns;
  const uniqueness = uniquenessColumns.length > 0
    ? (uniquenessColumns.reduce((sum, col) => sum + col.distinctRatio, 0) / uniquenessColumns.length) * 100
    : 100;

  // Accuracy: 100 minus 10 per column with >10% nulls, capped at 0
  const highNullColumns = profile.columns.filter((c) => c.nullRate > 0.10).length;
  const accuracy = Math.max(0, 100 - highNullColumns * 10);

  // Consistency: compare current row count to historical average
  let consistency: number;
  if (historicalRowCounts.length === 0) {
    consistency = 100; // No history, assume stable
  } else {
    const avgRowCount = historicalRowCounts.reduce((a, b) => a + b, 0) / historicalRowCounts.length;
    if (avgRowCount === 0) {
      consistency = 100;
    } else {
      const deviation = Math.abs(profile.totalRows - avgRowCount) / avgRowCount;
      // Within 20% = full score, beyond that it drops
      if (deviation <= 0.2) {
        consistency = 100;
      } else {
        consistency = Math.max(0, 100 - (deviation - 0.2) * 200);
      }
    }
  }

  // Weighted overall score
  const score = Math.round(
    completeness * 0.3 +
    freshness * 0.25 +
    uniqueness * 0.2 +
    accuracy * 0.15 +
    consistency * 0.1,
  );

  // Trend: if last 3 scores exist, compute slope
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (historicalScores.length >= 3) {
    const recent = historicalScores.slice(-3);
    const slope = (recent[2] - recent[0]) / 2;
    if (slope > 1) {
      trend = 'improving';
    } else if (slope < -1) {
      trend = 'declining';
    }
  }

  return {
    datasetId,
    score,
    breakdown: {
      completeness: Math.round(completeness * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      freshness: Math.round(freshness * 100) / 100,
      uniqueness: Math.round(uniqueness * 100) / 100,
    },
    trend,
    updatedAt: Date.now(),
  };
}
