/**
 * Retention-based tier gating for usage data.
 *
 * Community: 7 days
 * Pro: 90 days
 * Enterprise: unlimited
 *
 * NO LLM calls — purely deterministic.
 */

import { getCurrentTier } from '@data-workers/license';
import { RETENTION_LIMITS } from './types.js';

/**
 * Returns the retention cutoff timestamp for the current license tier.
 * Data older than this timestamp should be excluded from queries.
 */
export function getRetentionCutoff(): number {
  const tier = getCurrentTier();
  const retentionDays = RETENTION_LIMITS[tier] ?? RETENTION_LIMITS.community;
  if (!isFinite(retentionDays)) return 0; // enterprise: no cutoff
  const dayMs = 24 * 60 * 60 * 1000;
  return Date.now() - retentionDays * dayMs;
}

/**
 * Returns the maximum retention period in days for the current tier.
 */
export function getRetentionDays(): number {
  const tier = getCurrentTier();
  return RETENTION_LIMITS[tier] ?? RETENTION_LIMITS.community;
}
