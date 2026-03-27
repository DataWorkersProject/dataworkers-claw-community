/**
 * identify_golden_path — Identify the recommended "golden path" datasets.
 * Community/read tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { graphDB, kvStore } from '../backends.js';
import type { IGraphDB } from '@data-workers/infrastructure-stubs';

export const identifyGoldenPathDefinition: ToolDefinition = {
  name: 'identify_golden_path',
  description:
    'Identify the recommended "golden path" datasets for a given domain or use case. ' +
    'Golden path datasets are the most-used, highest-quality, and most-trusted datasets ' +
    'that should be preferred over alternatives.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'Domain to find golden path for (e.g., "revenue", "customers").' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      limit: { type: 'number', description: 'Max results. Default 5.' },
    },
    required: ['domain'],
  },
};

export const identifyGoldenPathHandler: ToolHandler = async (args) => {
  const domain = args.domain as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const limit = (args.limit as number) || 5;

  const db = graphDB as IGraphDB;
  const allNodes = await db.findByName(domain, customerId);

  // Score each candidate by quality, freshness, and downstream impact
  const candidates = await Promise.all(
    allNodes.slice(0, 20).map(async (node) => {
      const downstream = await db.traverseDownstream(node.id, 1);
      const qualityScore = (node.properties.qualityScore as number) ?? 0;
      const freshnessScore = (node.properties.freshnessScore as number) ?? 0;

      // Check for authoritative designation
      const authKey = `authority:${customerId}:${domain}`;
      const authRaw = await kvStore.get(authKey);
      const isAuthoritative = authRaw ? JSON.parse(authRaw).assetId === node.id : false;

      const goldenScore =
        qualityScore * 0.3 +
        freshnessScore * 0.2 +
        Math.min(downstream.length * 10, 100) * 0.3 +
        (isAuthoritative ? 100 : 0) * 0.2;

      return {
        assetId: node.id,
        name: node.name,
        type: node.type,
        platform: node.properties.platform || 'unknown',
        qualityScore,
        freshnessScore,
        downstreamConsumers: downstream.length,
        isAuthoritative,
        goldenScore: Math.round(goldenScore * 100) / 100,
      };
    }),
  );

  candidates.sort((a, b) => b.goldenScore - a.goldenScore);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        domain,
        goldenPath: candidates.slice(0, limit),
        totalCandidates: candidates.length,
        recommendation: candidates.length > 0
          ? `Recommended: '${candidates[0].name}' (score: ${candidates[0].goldenScore})`
          : `No datasets found matching domain '${domain}'.`,
      }, null, 2),
    }],
  };
};
