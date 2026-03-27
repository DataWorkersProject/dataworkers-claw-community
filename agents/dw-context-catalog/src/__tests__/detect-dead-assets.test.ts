/**
 * Tests for detect_dead_assets — verifies false-positive fixes.
 *
 * Key invariants:
 *  1. Source-type assets must NEVER be flagged for "no_upstream"
 *  2. Assets with high freshnessScore (> 0.5) must NOT be flagged
 *  3. Assets with positive qualityScore must NOT be flagged
 *  4. Assets recently updated (< minDaysUnused) must NOT be flagged
 *  5. Dashboards/metrics/reports must NOT be flagged for "no_downstream"
 *  6. Configurable staleness threshold via minDaysUnused
 */

import { describe, it, expect } from 'vitest';
import { server } from '../index.js';

/** Helper to call detect_dead_assets and parse the response. */
async function callDetectDeadAssets(args: Record<string, unknown> = {}) {
  const result = await server.callTool('detect_dead_assets', { customerId: 'cust-1', ...args });
  expect(result.isError).toBeFalsy();
  const data = JSON.parse((result.content[0] as { text: string }).text);
  return data as {
    summary: {
      totalAssetsScanned: number;
      deadAssetsFound: number;
      byReason: Record<string, number>;
      byRisk: Record<string, number>;
      totalEstimatedMonthlyCost?: number;
    };
    deadAssets: Array<{
      assetId: string;
      assetName: string;
      assetType: string;
      platform: string;
      deadReason: string;
      lastAccessed?: number;
      estimatedMonthlyCost?: number;
      removalRisk: string;
      downstreamCount: number;
      upstreamCount: number;
    }>;
  };
}

describe('detect_dead_assets (false-positive fixes)', () => {
  it('does NOT flag all 16 assets as dead (false-positive rate < 100%)', async () => {
    const data = await callDetectDeadAssets();
    // With seeded usage stats, the tool should NOT flag everything
    expect(data.summary.deadAssetsFound).toBeLessThan(data.summary.totalAssetsScanned);
    // Specifically, most assets with good freshness/quality should be excluded
    expect(data.summary.deadAssetsFound).toBe(0);
  });

  it('does NOT flag source-type assets for "no_upstream"', async () => {
    const data = await callDetectDeadAssets({ scope: 'tables' });
    const sourcesFlaggedNoUpstream = data.deadAssets.filter(
      (a) => a.assetType === 'source' && a.deadReason === 'no_upstream',
    );
    expect(sourcesFlaggedNoUpstream).toHaveLength(0);
  });

  it('does NOT flag assets with high freshnessScore', async () => {
    const data = await callDetectDeadAssets();
    // All seeded assets have freshnessScore > 0.5, so none should be flagged
    expect(data.deadAssets.length).toBe(0);
  });

  it('does NOT flag assets with positive qualityScore', async () => {
    const data = await callDetectDeadAssets();
    // All seeded assets have qualityScore > 0, so none should be flagged
    expect(data.deadAssets.length).toBe(0);
  });

  it('does NOT flag dashboards for "no_downstream"', async () => {
    const data = await callDetectDeadAssets();
    const dashboardsFlaggedNoDownstream = data.deadAssets.filter(
      (a) => a.assetType === 'dashboard' && a.deadReason === 'no_downstream',
    );
    expect(dashboardsFlaggedNoDownstream).toHaveLength(0);
  });

  it('returns valid summary structure', async () => {
    const data = await callDetectDeadAssets();
    expect(data.summary).toBeDefined();
    expect(data.summary.totalAssetsScanned).toBeGreaterThan(0);
    expect(typeof data.summary.deadAssetsFound).toBe('number');
    expect(data.summary.byReason).toBeDefined();
    expect(data.summary.byRisk).toBeDefined();
    expect(typeof data.summary.totalEstimatedMonthlyCost).toBe('number');
  });

  it('scans all 16 seeded assets when scope=all', async () => {
    const data = await callDetectDeadAssets({ scope: 'all' });
    // 16 seeded nodes for cust-1
    expect(data.summary.totalAssetsScanned).toBe(16);
  });

  it('respects scope=tables filter', async () => {
    const data = await callDetectDeadAssets({ scope: 'tables' });
    // tables scope includes: table, view, model, source
    expect(data.summary.totalAssetsScanned).toBeGreaterThan(0);
    // Should not include dashboards or pipelines in scan count
    expect(data.summary.totalAssetsScanned).toBeLessThan(16);
  });

  it('respects scope=pipelines filter', async () => {
    const data = await callDetectDeadAssets({ scope: 'pipelines' });
    // Only pipeline/dag assets
    expect(data.summary.totalAssetsScanned).toBeGreaterThan(0);
  });

  it('accepts minDaysUnused parameter', async () => {
    // Even with a very short threshold, active assets should not be flagged
    const data = await callDetectDeadAssets({ minDaysUnused: 1 });
    // All seeded assets have qualityScore > 0 and freshnessScore > 0.5,
    // so the usage-stats check catches them before staleness check
    expect(data.summary.deadAssetsFound).toBe(0);
  });

  it('sorts dead assets by estimated cost descending', async () => {
    const data = await callDetectDeadAssets();
    for (let i = 1; i < data.deadAssets.length; i++) {
      expect(data.deadAssets[i - 1].estimatedMonthlyCost).toBeGreaterThanOrEqual(
        data.deadAssets[i].estimatedMonthlyCost ?? 0,
      );
    }
  });

  it('can exclude cost estimates with includeEstimatedCost=false', async () => {
    const data = await callDetectDeadAssets({ includeEstimatedCost: false });
    expect(data.summary.totalEstimatedMonthlyCost).toBeUndefined();
    for (const asset of data.deadAssets) {
      expect(asset.estimatedMonthlyCost).toBeUndefined();
    }
  });
});
