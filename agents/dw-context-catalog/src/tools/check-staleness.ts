/**
 * check_staleness — Check if context/documentation for an asset is stale.
 * Community/read tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { graphDB, businessRuleStore } from '../backends.js';
import type { IGraphDB } from '@data-workers/infrastructure-stubs';
import type { StalenessAssessment } from '../types.js';

export const checkStalenessDefinition: ToolDefinition = {
  name: 'check_staleness',
  description:
    'Check if the context, documentation, or business rules for a data asset are stale. ' +
    'Returns a staleness assessment with freshness score and recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'ID of the asset to check.' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      staleThresholdDays: { type: 'number', description: 'Number of days after which context is considered stale. Default 30.' },
    },
    required: ['assetId'],
  },
};

export const checkStalenessHandler: ToolHandler = async (args) => {
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const staleThresholdDays = (args.staleThresholdDays as number) || 30;

  const db = graphDB as IGraphDB;
  let node = await db.getNode(assetId);
  if (!node) {
    const byName = await db.findByName(assetId, customerId);
    node = byName[0];
  }

  const now = Date.now();
  const thresholdMs = staleThresholdDays * 86_400_000;

  // Check asset last updated
  const lastUpdated = node
    ? (node.properties.lastUpdated as number) ?? (node.properties.lastCrawled as number) ?? 0
    : 0;
  const ageMs = now - lastUpdated;
  const isAssetStale = ageMs > thresholdMs;

  // Check business rules staleness
  const rules = await businessRuleStore.getRulesForAsset(assetId, customerId);
  const staleRules = rules.filter(r => (now - r.lastConfirmedAt) > thresholdMs);

  const freshnessScore = lastUpdated > 0
    ? Math.max(0, Math.round((1 - ageMs / (thresholdMs * 2)) * 100))
    : 0;

  const assessment: StalenessAssessment = {
    assetId,
    freshnessScore,
    lastUpdated: lastUpdated || undefined,
    isStale: isAssetStale,
    staleSince: isAssetStale ? lastUpdated + thresholdMs : undefined,
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        ...assessment,
        assetFound: !!node,
        staleThresholdDays,
        ageInDays: Math.round(ageMs / 86_400_000),
        staleBusinessRules: staleRules.length,
        totalBusinessRules: rules.length,
        recommendations: [
          ...(isAssetStale ? ['Asset context has not been updated recently. Consider re-crawling or manual review.'] : []),
          ...(staleRules.length > 0 ? [`${staleRules.length} business rule(s) need reconfirmation.`] : []),
        ],
      }, null, 2),
    }],
  };
};
