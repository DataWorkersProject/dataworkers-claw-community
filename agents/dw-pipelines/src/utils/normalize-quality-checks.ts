import type { QualityCheck } from '../types.js';

/**
 * Normalize quality checks from mixed string/object format to QualityCheck[].
 * Ensures backward compatibility with older string[] format while
 * guaranteeing all consumers receive proper QualityCheck objects.
 */
export function normalizeQualityChecks(checks: (string | QualityCheck)[]): QualityCheck[] {
  return checks.map(qc => {
    if (typeof qc === 'string') {
      return { type: qc, threshold: undefined, severity: 'warn' as const };
    }
    return qc;
  });
}
