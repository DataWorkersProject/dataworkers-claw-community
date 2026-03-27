/**
 * get_context MCP tool — returns everything another agent needs in a single call.
 * Schema, lineage, quality, freshness, trust score, documentation, related metrics.
 * The catalog agent's key differentiator: semantic memory for the agent swarm.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { graphDB, metricStore } from '../backends.js';
import { FreshnessTracker } from '../search/freshness-tracker.js';
import { DocumentationGenerator } from '../search/documentation-generator.js';
import { TrustScorer } from '../search/trust-scorer.js';

const freshnessTracker = new FreshnessTracker();
const docGenerator = new DocumentationGenerator();
const trustScorer = new TrustScorer(freshnessTracker);

export const getContextDefinition: ToolDefinition = {
  name: 'get_context',
  description: 'Get complete context for a data asset in a single call. Returns schema, lineage, quality, freshness, trust score, documentation, and related metrics. Use this instead of calling multiple tools separately.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Asset ID or name.' },
      customerId: { type: 'string' },
    },
    required: ['assetId', 'customerId'],
  },
};

export const getContextHandler: ToolHandler = async (args) => {
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = args.customerId as string;

  try {
    // Look up the asset
    const node = (await graphDB.getNode(assetId))
      ?? (await graphDB.findByName(assetId, customerId))[0];

    if (!node) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            found: false,
            assetId,
            message: `Asset '${assetId}' not found in the catalog.`,
          }, null, 2),
        }],
      };
    }

    // Gather all context in parallel-safe fashion
    const upstream = await graphDB.traverseUpstream(node.id, 2);
    const downstream = await graphDB.traverseDownstream(node.id, 2);
    const freshness = await freshnessTracker.checkFreshness(node.id, customerId);
    const trustScore = await trustScorer.computeTrustScore(node.id, customerId, graphDB);
    const documentation = await docGenerator.generateDocumentation(node.id, customerId);

    // Find related metrics by searching for the asset name
    const metricResult = metricStore.resolveMetric(node.name, customerId);
    const relatedMetrics = metricResult.matches ?? [];

    // Extract columns from node properties
    const columns = (node.properties.columns as Array<{ name: string; type: string }>) ?? [];

    // Build classification tags
    const tags: string[] = [];
    if (node.type) tags.push(`type:${node.type}`);
    if (node.platform) tags.push(`platform:${node.platform}`);
    if (upstream.length === 0) tags.push('classification:source');
    else if (downstream.length === 0) tags.push('classification:terminal');
    else tags.push('classification:intermediate');
    if (downstream.some(d => d.node.type === 'dashboard')) tags.push('feeds:dashboards');

    const context = {
      found: true,
      asset: {
        id: node.id,
        name: node.name,
        type: node.type,
        platform: node.platform,
        customerId: node.customerId,
        properties: node.properties,
      },
      columns,
      lineage: {
        upstream: upstream.map(u => ({
          id: u.node.id,
          name: u.node.name,
          type: u.node.type,
          depth: u.depth,
          relationship: u.relationship,
        })),
        downstream: downstream.map(d => ({
          id: d.node.id,
          name: d.node.name,
          type: d.node.type,
          depth: d.depth,
          relationship: d.relationship,
        })),
      },
      trustScore,
      freshness,
      documentation: {
        description: documentation.description,
        qualityScore: documentation.qualityScore,
        confidence: documentation.confidence,
      },
      relatedMetrics: relatedMetrics.slice(0, 5),
      classifiedTags: tags,
      generatedAt: Date.now(),
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(context, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      }],
      isError: true,
    };
  }
};
