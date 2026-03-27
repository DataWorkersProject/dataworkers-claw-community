/**
 * detect_dead_assets MCP tool — orphaned table/column/DAG finder.
 * Finds assets with no upstream, no downstream, or stale timestamps.
 * Cross-references usage stats (freshness, quality, lastUpdated) to
 *          avoid false positives. Source-type assets are exempt from "no_upstream".
 * Estimates monthly cost waste and recommends removal risk.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { graphDB } from '../backends.js';

export type DeadReason = 'no_upstream' | 'no_downstream' | 'stale' | 'never_queried';
export type RemovalRisk = 'safe' | 'caution' | 'dangerous';

/** Asset types that are naturally leaf nodes (no downstream expected). */
const LEAF_ASSET_TYPES = new Set(['dashboard', 'metric', 'report']);

/** Asset types that are naturally root nodes (no upstream expected). */
const ROOT_ASSET_TYPES = new Set(['source']);

export interface DeadAsset {
  assetId: string;
  assetName: string;
  assetType: string;
  platform: string;
  deadReason: DeadReason;
  lastAccessed?: number;
  estimatedMonthlyCost?: number;
  removalRisk: RemovalRisk;
  downstreamCount: number;
  upstreamCount: number;
}

export const detectDeadAssetsDefinition: ToolDefinition = {
  name: 'detect_dead_assets',
  description:
    'Detect orphaned, unused, or stale data assets (tables, columns, pipelines). ' +
    'Returns a prioritised list sorted by estimated cost waste, with removal risk ratings.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: {
        type: 'string',
        description: 'Optional customer ID to scope the scan.',
      },
      scope: {
        type: 'string',
        enum: ['all', 'tables', 'columns', 'pipelines'],
        description: "Asset scope to scan. Default: 'all'.",
      },
      minDaysUnused: {
        type: 'number',
        description: 'Minimum days since last activity to consider an asset stale. Default: 90.',
      },
      includeEstimatedCost: {
        type: 'boolean',
        description: 'Include placeholder cost estimates based on quality-score heuristic. Default: true.',
      },
    },
    required: [],
  },
};

/** Map scope filter to graph node types. */
function scopeToTypes(scope: string): string[] | null {
  switch (scope) {
    case 'tables':
      return ['table', 'view', 'model', 'source'];
    case 'columns':
      return ['column'];
    case 'pipelines':
      return ['pipeline', 'dag'];
    default:
      return null; // all
  }
}

/** Placeholder cost estimator based on qualityScore heuristic. */
function estimateMonthlyCost(node: { type: string; properties: Record<string, unknown> }): number {
  // Real cost would come from dw-cost agent; this is a rough heuristic.
  const qualityScore = typeof node.properties.qualityScore === 'number'
    ? node.properties.qualityScore
    : 0.5;
  const baseCost: Record<string, number> = {
    table: 120,
    view: 40,
    model: 80,
    pipeline: 200,
    dag: 200,
    dashboard: 30,
    source: 60,
    metric: 10,
    column: 5,
  };
  const base = baseCost[node.type] ?? 50;
  // Lower quality → higher wasted cost (inverse relationship)
  return Math.round(base * (1 - qualityScore) * 100) / 100;
}

/** Determine removal risk based on downstream presence and type. */
function assessRemovalRisk(downstreamCount: number, nodeType: string): RemovalRisk {
  if (downstreamCount === 0) return 'safe';
  if (downstreamCount <= 2 && nodeType !== 'pipeline' && nodeType !== 'dag') return 'caution';
  return 'dangerous';
}

export const detectDeadAssetsHandler: ToolHandler = async (args) => {
  const customerId = args.customerId as string | undefined;
  const scope = (args.scope as string) ?? 'all';
  const minDaysUnused = (args.minDaysUnused as number) ?? 90;
  const includeEstimatedCost = (args.includeEstimatedCost as boolean) ?? true;

  try {
    // 1. Get all nodes from graph
    const allNodes = await graphDB.getAllNodes();

    // Filter by customerId if provided
    const customerNodes = customerId
      ? allNodes.filter((n) => n.customerId === customerId)
      : allNodes;

    // Filter by scope
    const allowedTypes = scopeToTypes(scope);
    const scopedNodes = allowedTypes
      ? customerNodes.filter((n) => allowedTypes.includes(n.type))
      : customerNodes;

    const now = Date.now();
    const staleThresholdMs = minDaysUnused * 24 * 60 * 60 * 1000;

    const deadAssets: DeadAsset[] = [];

    // 2-6. Analyze each node for dead-ness
    for (const node of scopedNodes) {
      const upstream = await graphDB.traverseUpstream(node.id, 1);
      const downstream = await graphDB.traverseDownstream(node.id, 1);

      const upstreamCount = upstream.length;
      const downstreamCount = downstream.length;

      // ── Extract usage / freshness signals ──
      const freshnessScore = typeof node.properties.freshnessScore === 'number'
        ? node.properties.freshnessScore
        : undefined;
      const qualityScore = typeof node.properties.qualityScore === 'number'
        ? node.properties.qualityScore
        : undefined;
      const lastUpdated = typeof node.properties.lastUpdated === 'number'
        ? node.properties.lastUpdated
        : undefined;
      const lastCrawled = typeof node.properties.lastCrawled === 'number'
        ? node.properties.lastCrawled
        : undefined;
      const lastQueried = typeof node.properties.lastQueried === 'number'
        ? node.properties.lastQueried
        : undefined;
      const lastAccessed = lastUpdated ?? lastCrawled ?? lastQueried;

      // ── Skip assets that show signs of active use ──
      // A high freshness score means the asset is being kept up-to-date
      if (freshnessScore !== undefined && freshnessScore > 0.5) continue;
      // A recently-updated asset is not dead
      if (lastUpdated !== undefined && (now - lastUpdated) < staleThresholdMs) continue;
      // A positive quality score suggests the asset is being monitored
      if (qualityScore !== undefined && qualityScore > 0) continue;

      let deadReason: DeadReason | null = null;

      // ── Source-type and leaf-type exemptions ──
      // Sources are root nodes; having no upstream is expected.
      // Dashboards/metrics/reports are leaf nodes; having no downstream is expected.
      const isRoot = ROOT_ASSET_TYPES.has(node.type);
      const isLeaf = LEAF_ASSET_TYPES.has(node.type);

      // Check: completely isolated (no connections at all)
      if (upstreamCount === 0 && downstreamCount === 0 && !isRoot && !isLeaf) {
        deadReason = 'no_upstream';
      } else if (upstreamCount === 0 && !isRoot) {
        // Non-root node with no upstream → orphaned
        deadReason = 'no_upstream';
      } else if (downstreamCount === 0 && !isLeaf && !isRoot) {
        // Non-leaf, non-root node with no downstream consumers
        deadReason = 'no_downstream';
      }

      // Check staleness via timestamps — only if not already flagged by lineage
      if (!deadReason && lastAccessed && (now - lastAccessed) > staleThresholdMs) {
        deadReason = 'stale';
      }

      // Only flag as never_queried if the asset is truly isolated
      // (no lineage connections AND no timestamps). Assets with lineage connections
      // but no timestamps are NOT dead — they just lack instrumentation.
      if (!deadReason && !lastAccessed && upstreamCount === 0 && downstreamCount === 0
          && !isRoot && !isLeaf) {
        deadReason = 'never_queried';
      }

      if (!deadReason) continue;

      const estimatedMonthlyCost = includeEstimatedCost
        ? estimateMonthlyCost(node)
        : undefined;

      const removalRisk = assessRemovalRisk(downstreamCount, node.type);

      deadAssets.push({
        assetId: node.id,
        assetName: node.name,
        assetType: node.type,
        platform: node.platform,
        deadReason,
        lastAccessed,
        estimatedMonthlyCost,
        removalRisk,
        downstreamCount,
        upstreamCount,
      });
    }

    // 7. Sort by estimated cost descending (highest waste first)
    deadAssets.sort((a, b) => (b.estimatedMonthlyCost ?? 0) - (a.estimatedMonthlyCost ?? 0));

    const summary = {
      totalAssetsScanned: scopedNodes.length,
      deadAssetsFound: deadAssets.length,
      byReason: {
        no_upstream: deadAssets.filter((a) => a.deadReason === 'no_upstream').length,
        no_downstream: deadAssets.filter((a) => a.deadReason === 'no_downstream').length,
        stale: deadAssets.filter((a) => a.deadReason === 'stale').length,
        never_queried: deadAssets.filter((a) => a.deadReason === 'never_queried').length,
      },
      byRisk: {
        safe: deadAssets.filter((a) => a.removalRisk === 'safe').length,
        caution: deadAssets.filter((a) => a.removalRisk === 'caution').length,
        dangerous: deadAssets.filter((a) => a.removalRisk === 'dangerous').length,
      },
      totalEstimatedMonthlyCost: includeEstimatedCost
        ? Math.round(deadAssets.reduce((sum, a) => sum + (a.estimatedMonthlyCost ?? 0), 0) * 100) / 100
        : undefined,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ summary, deadAssets }, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          }),
        },
      ],
      isError: true,
    };
  }
};
