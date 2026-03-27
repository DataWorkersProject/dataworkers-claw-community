/**
 * TrustScorer — composite trust score for data assets.
 * Combines quality, freshness, documentation coverage, usage, and owner responsiveness.
 */

import type { IGraphDB } from '@data-workers/infrastructure-stubs';
import { FreshnessTracker } from './freshness-tracker.js';

export interface TrustScore {
  overall: number;
  quality: number;
  freshness: number;
  docCoverage: number;
  usage: number;
  ownerResponsiveness: number;
  breakdown: Record<string, number>;
}

const WEIGHTS = {
  quality: 0.30,
  freshness: 0.25,
  docCoverage: 0.15,
  usage: 0.15,
  ownerResponsiveness: 0.15,
};

export class TrustScorer {
  private freshnessTracker: FreshnessTracker;

  constructor(freshnessTracker?: FreshnessTracker) {
    this.freshnessTracker = freshnessTracker ?? new FreshnessTracker();
  }

  /**
   * Compute composite trust score for an asset.
   */
  async computeTrustScore(
    assetId: string,
    customerId: string,
    graphDB: IGraphDB,
  ): Promise<TrustScore> {
    const node = (await graphDB.getNode(assetId))
      ?? (await graphDB.findByName(assetId, customerId))[0];

    if (!node) {
      return {
        overall: 0,
        quality: 0,
        freshness: 0,
        docCoverage: 0,
        usage: 0,
        ownerResponsiveness: 0,
        breakdown: { ...WEIGHTS },
      };
    }

    // Quality: from node properties or default
    const quality = Math.min(100, Math.max(0,
      (node.properties.qualityScore as number) ?? 50,
    ));

    // Freshness: from FreshnessTracker
    const freshnessResult = await this.freshnessTracker.checkFreshness(assetId, customerId);
    const freshness = freshnessResult.found !== false ? freshnessResult.freshnessScore : 30;

    // Doc coverage: check how many metadata fields are populated
    const docFields = ['description', 'owner', 'tags', 'columns', 'schema'];
    const populatedFields = docFields.filter(f => {
      const val = node.properties[f];
      if (val === undefined || val === null || val === '') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    });
    const docCoverage = (populatedFields.length / docFields.length) * 100;

    // Usage: based on downstream consumers
    const downstream = await graphDB.traverseDownstream(node.id, 1);
    const usage = Math.min(100, downstream.length * 20); // 5 downstream = 100

    // Owner responsiveness: check if owner is set and asset is maintained (freshness as proxy)
    const hasOwner = !!node.properties.owner;
    const ownerResponsiveness = hasOwner
      ? Math.min(100, freshness * 1.2) // Fresher = more responsive owner
      : 30; // No owner = low responsiveness

    const overall = Math.round(
      WEIGHTS.quality * quality +
      WEIGHTS.freshness * freshness +
      WEIGHTS.docCoverage * docCoverage +
      WEIGHTS.usage * usage +
      WEIGHTS.ownerResponsiveness * ownerResponsiveness,
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      quality,
      freshness,
      docCoverage: Math.round(docCoverage),
      usage,
      ownerResponsiveness: Math.round(ownerResponsiveness),
      breakdown: WEIGHTS,
    };
  }
}
