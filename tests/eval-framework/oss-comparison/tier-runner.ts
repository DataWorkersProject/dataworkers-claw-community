/**
 * Eval Framework — Tier Runner
 *
 * Runs test functions under a specific license tier by temporarily setting
 * DW_LICENSE_TIER, then restoring the original environment after execution.
 */

import type { LicenseTier } from '../../../core/license/src/tool-gate.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TierRunResult<T = unknown> {
  tier: LicenseTier;
  result: T;
  durationMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a test function under a specific license tier.
 *
 * Sets `process.env.DW_LICENSE_TIER` to the requested tier, runs the
 * provided function, then restores the original env var regardless of
 * success or failure.
 *
 * @param tier - The license tier to simulate: 'community', 'pro', or 'enterprise'
 * @param testFn - Async function to run under the specified tier
 * @returns TierRunResult with timing, tier, and the function's return value
 */
export async function runUnderTier<T>(
  tier: LicenseTier,
  testFn: () => Promise<T>,
): Promise<TierRunResult<T>> {
  const originalTier = process.env.DW_LICENSE_TIER;
  const originalKey = process.env.DW_LICENSE_TIER;

  try {
    // Clear the license key so getCurrentTier() falls through to the env var
    delete process.env.DW_LICENSE_TIER;
    process.env.DW_LICENSE_TIER = tier;

    const start = performance.now();
    const result = await testFn();
    const durationMs = performance.now() - start;

    return { tier, result, durationMs };
  } catch (err) {
    return {
      tier,
      result: undefined as unknown as T,
      durationMs: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // Restore original environment
    if (originalTier !== undefined) {
      process.env.DW_LICENSE_TIER = originalTier;
    } else {
      delete process.env.DW_LICENSE_TIER;
    }
    if (originalKey !== undefined) {
      process.env.DW_LICENSE_TIER = originalKey;
    } else {
      delete process.env.DW_LICENSE_TIER;
    }
  }
}

/**
 * Run the same test function under multiple tiers and return all results.
 * Useful for comparison testing.
 */
export async function runUnderAllTiers<T>(
  testFn: () => Promise<T>,
): Promise<Record<LicenseTier, TierRunResult<T>>> {
  const community = await runUnderTier('community', testFn);
  const pro = await runUnderTier('pro', testFn);
  const enterprise = await runUnderTier('enterprise', testFn);

  return { community, pro, enterprise };
}
