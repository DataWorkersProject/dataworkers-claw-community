/**
 * LineageAPI — visualization-ready lineage data for dashboards and compliance export.
 * Lineage visualization data API.
 */

import type { IGraphDB } from '@data-workers/infrastructure-stubs';
import type { CatalogRegistry } from '@data-workers/connector-shared';
import type { ICatalogProvider, LineageGraph as ConnectorLineageGraph } from '@data-workers/connector-shared';
import { ColumnLineageExpander } from './column-lineage-expander.js';
import type { LineageNode, ColumnLineage, AssetType } from '../types.js';

/** Timeout per connector when querying cross-platform lineage. */
const CONNECTOR_LINEAGE_TIMEOUT_MS = 5000;

/** Confidence scores by lineage source type. */
const CONFIDENCE = {
  sqlParsed: 0.95,
  openLineage: 0.9,
  nameInferred: 0.7,
} as const;

export interface CrossPlatformLineageOptions {
  customerId: string;
  direction: string;
  maxDepth: number;
  includeColumnLineage: boolean;
  includeOrchestration: boolean;
  platforms?: string[];
}

export interface CrossPlatformEdge {
  source: string;
  target: string;
  relationship: string;
  confidence: number;
  platform?: string;
  orchestration?: {
    dagId?: string;
    taskId?: string;
    scheduler?: string;
  };
}

export interface CrossPlatformLineageResult {
  assetId: string;
  upstream: (LineageNode & { confidence: number })[];
  downstream: (LineageNode & { confidence: number })[];
  crossPlatformEdges: CrossPlatformEdge[];
  columnLineage?: ColumnLineage[];
  columnLineageConfidence?: {
    overall: number;
    explicitEdges: number;
    inferredEdges: number;
    totalEdges: number;
    coverage: number;
  };
  depth: number;
  platformsQueried: string[];
  platformErrors: Array<{ platform: string; error: string }>;
}

/**
 * Query a single CatalogProvider for lineage, with a timeout guard.
 */
async function queryProviderLineage(
  provider: ICatalogProvider,
  entityId: string,
  direction: 'upstream' | 'downstream',
  depth: number,
): Promise<ConnectorLineageGraph | null> {
  if (!provider.getLineage) return null;

  try {
    const result = await Promise.race([
      Promise.resolve(provider.getLineage(entityId, direction, depth)),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Connector lineage timeout')), CONNECTOR_LINEAGE_TIMEOUT_MS),
      ),
    ]);
    return result;
  } catch {
    return null;
  }
}

/**
 * Trace lineage across all registered CatalogRegistry providers + local graph.
 * First queries the local graph DB (existing behavior), then fans out to
 * connectors and stitches results into a unified graph.
 */
export async function traceAcrossPlatforms(
  assetId: string,
  options: CrossPlatformLineageOptions,
  graphDB: IGraphDB,
  catalogRegistry: CatalogRegistry,
): Promise<CrossPlatformLineageResult> {
  const { customerId, direction, maxDepth, includeColumnLineage, includeOrchestration, platforms } = options;

  // ── 1. Query local graph DB (existing single-graph behavior) ──

  let node = await graphDB.getNode(assetId);
  if (!node) {
    const byName = await graphDB.findByName(assetId);
    const exactMatch = byName.find(n => n.name.toLowerCase() === assetId.toLowerCase());
    node = exactMatch || byName[0] || undefined;
  }

  // Cross-tenant guard
  if (node && node.customerId !== customerId) {
    node = undefined;
  }

  const upstream: (LineageNode & { confidence: number })[] = [];
  const downstream: (LineageNode & { confidence: number })[] = [];
  const crossPlatformEdges: CrossPlatformEdge[] = [];
  const platformsQueried: string[] = ['local'];
  const platformErrors: Array<{ platform: string; error: string }> = [];

  if (node) {
    if (direction === 'upstream' || direction === 'both') {
      const upstreamResults = await graphDB.traverseUpstream(node.id, maxDepth);
      for (const result of upstreamResults) {
        upstream.push({
          id: result.node.id,
          name: result.node.name,
          type: result.node.type as AssetType,
          platform: result.node.platform,
          relationship: 'derives_from',
          depth: result.depth,
          confidence: CONFIDENCE.sqlParsed,
        });
      }
    }

    if (direction === 'downstream' || direction === 'both') {
      const downstreamResults = await graphDB.traverseDownstream(node.id, maxDepth);
      for (const result of downstreamResults) {
        downstream.push({
          id: result.node.id,
          name: result.node.name,
          type: result.node.type as AssetType,
          platform: result.node.platform,
          relationship: 'consumed_by',
          depth: result.depth,
          confidence: CONFIDENCE.sqlParsed,
        });
      }
    }
  }

  // ── 2. Fan out to CatalogRegistry providers ──

  const registeredPlatforms = catalogRegistry.list();
  const targetPlatforms = platforms
    ? registeredPlatforms.filter(p => platforms.includes(p))
    : registeredPlatforms;

  const seenNodeIds = new Set<string>([
    ...upstream.map(n => n.id),
    ...downstream.map(n => n.id),
    ...(node ? [node.id] : []),
  ]);

  for (const platformName of targetPlatforms) {
    platformsQueried.push(platformName);
    let provider: ICatalogProvider;
    try {
      provider = catalogRegistry.create(platformName);
    } catch (err) {
      platformErrors.push({
        platform: platformName,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (!provider.getLineage) continue;

    const directions: ('upstream' | 'downstream')[] =
      direction === 'both' ? ['upstream', 'downstream'] : [direction as 'upstream' | 'downstream'];

    for (const dir of directions) {
      const graph = await queryProviderLineage(provider, assetId, dir, maxDepth);
      if (!graph) {
        platformErrors.push({
          platform: platformName,
          error: `No lineage returned for direction=${dir}`,
        });
        continue;
      }

      // Merge nodes by qualified name, add edges between platforms
      for (const gNode of graph.nodes) {
        if (seenNodeIds.has(gNode.entityId)) continue;
        seenNodeIds.add(gNode.entityId);

        const lineageNode: LineageNode & { confidence: number } = {
          id: gNode.entityId,
          name: gNode.name,
          type: (gNode.entityType as AssetType) || 'table',
          platform: platformName,
          relationship: dir === 'upstream' ? 'derives_from' : 'consumed_by',
          depth: 1, // external nodes default to depth 1
          confidence: CONFIDENCE.nameInferred,
        };

        if (dir === 'upstream') {
          upstream.push(lineageNode);
        } else {
          downstream.push(lineageNode);
        }
      }

      for (const edge of graph.edges) {
        crossPlatformEdges.push({
          source: edge.source,
          target: edge.target,
          relationship: edge.transformationType ?? (dir === 'upstream' ? 'derives_from' : 'consumed_by'),
          confidence: CONFIDENCE.nameInferred,
          platform: platformName,
        });
      }
    }
  }

  // ── 3. Orchestration context enrichment ──

  if (includeOrchestration && node) {
    // Enrich local edges with orchestration metadata from graph properties
    for (const edge of crossPlatformEdges) {
      const sourceNode = await graphDB.getNode(edge.source);
      if (sourceNode?.type === 'pipeline') {
        edge.orchestration = {
          dagId: sourceNode.properties.dagId as string | undefined,
          taskId: sourceNode.properties.taskId as string | undefined,
          scheduler: sourceNode.platform,
        };
      }
    }

    // Also check upstream/downstream nodes for orchestration context
    for (const n of [...upstream, ...downstream]) {
      if (n.type === 'pipeline') {
        const pipelineNode = await graphDB.getNode(n.id);
        if (pipelineNode) {
          crossPlatformEdges.push({
            source: n.relationship === 'derives_from' ? n.id : assetId,
            target: n.relationship === 'derives_from' ? assetId : n.id,
            relationship: 'orchestrated_by',
            confidence: CONFIDENCE.openLineage,
            orchestration: {
              dagId: pipelineNode.properties.dagId as string | undefined,
              taskId: pipelineNode.properties.taskId as string | undefined,
              scheduler: pipelineNode.platform,
            },
          });
        }
      }
    }
  }

  // ── 4. Column lineage ──

  let columnLineage: ColumnLineage[] | undefined;
  let columnLineageConfidence: CrossPlatformLineageResult['columnLineageConfidence'];

  if (includeColumnLineage && node) {
    const expander = new ColumnLineageExpander();
    const expandedLineage = await expander.getColumnLineage(node.id, graphDB);
    if (expandedLineage.length > 0) {
      columnLineage = expandedLineage.map(cl => ({
        sourceColumn: cl.sourceColumn,
        sourceTable: cl.sourceTable,
        targetColumn: cl.targetColumn,
        targetTable: cl.targetTable,
        transformation: cl.transformation !== 'direct' ? cl.transformation : undefined,
      }));
      columnLineageConfidence = await expander.computeConfidence(node.id, graphDB);
    }
  }

  // ── 5. Build result ──

  const result: CrossPlatformLineageResult = {
    assetId: node?.id ?? assetId,
    upstream,
    downstream,
    crossPlatformEdges,
    columnLineage,
    columnLineageConfidence,
    depth: maxDepth,
    platformsQueried,
    platformErrors,
  };

  return result;
}

export interface LineageVisualizationNode {
  id: string;
  name: string;
  type: string;
  platform: string;
  depth: number;
  direction: 'upstream' | 'downstream' | 'center';
  metadata: Record<string, unknown>;
}

export interface LineageVisualizationEdge {
  source: string;
  target: string;
  relationship: string;
  columnMappings?: Array<{
    sourceColumn: string;
    targetColumn: string;
    transformation?: string;
    confidence: number;
  }>;
}

export interface LineageVisualization {
  centerNode: LineageVisualizationNode;
  nodes: LineageVisualizationNode[];
  edges: LineageVisualizationEdge[];
  stats: {
    totalNodes: number;
    upstreamCount: number;
    downstreamCount: number;
    maxDepth: number;
    columnLineageEdges: number;
  };
}

export interface ComplianceExport {
  assetId: string;
  assetName: string;
  exportedAt: string;
  upstreamSources: Array<{ name: string; platform: string; type: string }>;
  downstreamConsumers: Array<{ name: string; platform: string; type: string }>;
  columnLineage: Array<{
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    confidence: number;
  }>;
  dataClassifications: string[];
  lineageCoverage: number;
}

export class LineageAPI {
  private columnExpander = new ColumnLineageExpander();

  /**
   * Get visualization-ready lineage graph for rendering in dashboards.
   */
  async getVisualization(
    assetId: string,
    customerId: string,
    graphDB: IGraphDB,
    maxDepth: number = 3,
  ): Promise<LineageVisualization> {
    const node = (await graphDB.getNode(assetId))
      ?? (await graphDB.findByName(assetId, customerId))[0];

    if (!node) {
      return {
        centerNode: {
          id: assetId,
          name: assetId,
          type: 'unknown',
          platform: 'unknown',
          depth: 0,
          direction: 'center',
          metadata: {},
        },
        nodes: [],
        edges: [],
        stats: { totalNodes: 0, upstreamCount: 0, downstreamCount: 0, maxDepth: 0, columnLineageEdges: 0 },
      };
    }

    const centerNode: LineageVisualizationNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      platform: node.platform,
      depth: 0,
      direction: 'center',
      metadata: node.properties,
    };

    const nodes: LineageVisualizationNode[] = [centerNode];
    const edges: LineageVisualizationEdge[] = [];
    const seenIds = new Set<string>([node.id]);

    // Upstream
    const upstream = await graphDB.traverseUpstream(node.id, maxDepth);
    for (const u of upstream) {
      if (!seenIds.has(u.node.id)) {
        seenIds.add(u.node.id);
        nodes.push({
          id: u.node.id,
          name: u.node.name,
          type: u.node.type,
          platform: u.node.platform,
          depth: u.depth,
          direction: 'upstream',
          metadata: u.node.properties,
        });
      }
      edges.push({
        source: u.node.id,
        target: node.id,
        relationship: u.relationship,
      });
    }

    // Downstream
    const downstream = await graphDB.traverseDownstream(node.id, maxDepth);
    for (const d of downstream) {
      if (!seenIds.has(d.node.id)) {
        seenIds.add(d.node.id);
        nodes.push({
          id: d.node.id,
          name: d.node.name,
          type: d.node.type,
          platform: d.node.platform,
          depth: d.depth,
          direction: 'downstream',
          metadata: d.node.properties,
        });
      }
      edges.push({
        source: node.id,
        target: d.node.id,
        relationship: d.relationship,
      });
    }

    // Column lineage
    const colLineage = await this.columnExpander.getColumnLineage(node.id, graphDB);
    let columnLineageEdges = 0;
    for (const col of colLineage) {
      const sourceNode = nodes.find(n => n.name === col.sourceTable);
      if (sourceNode) {
        const existingEdge = edges.find(
          e => e.source === sourceNode.id && e.target === node.id,
        );
        if (existingEdge) {
          if (!existingEdge.columnMappings) existingEdge.columnMappings = [];
          existingEdge.columnMappings.push({
            sourceColumn: col.sourceColumn,
            targetColumn: col.targetColumn,
            transformation: col.transformation,
            confidence: col.confidence,
          });
          columnLineageEdges++;
        }
      }
    }

    const maxActualDepth = Math.max(
      ...upstream.map(u => u.depth),
      ...downstream.map(d => d.depth),
      0,
    );

    return {
      centerNode,
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        upstreamCount: upstream.length,
        downstreamCount: downstream.length,
        maxDepth: maxActualDepth,
        columnLineageEdges,
      },
    };
  }

  /**
   * Export lineage data for compliance auditing (GDPR, SOX, HIPAA).
   */
  async exportForCompliance(
    assetId: string,
    customerId: string,
    graphDB: IGraphDB,
  ): Promise<ComplianceExport> {
    const node = (await graphDB.getNode(assetId))
      ?? (await graphDB.findByName(assetId, customerId))[0];

    if (!node) {
      return {
        assetId,
        assetName: assetId,
        exportedAt: new Date().toISOString(),
        upstreamSources: [],
        downstreamConsumers: [],
        columnLineage: [],
        dataClassifications: [],
        lineageCoverage: 0,
      };
    }

    const upstream = await graphDB.traverseUpstream(node.id, 5);
    const downstream = await graphDB.traverseDownstream(node.id, 5);
    const colLineage = await this.columnExpander.getColumnLineage(node.id, graphDB);
    const confidence = await this.columnExpander.computeConfidence(node.id, graphDB);

    // Extract data classifications from tags
    const tags = (node.properties.tags as string[]) ?? [];
    const classifications = tags.filter(t =>
      ['pii', 'sensitive', 'confidential', 'public', 'internal', 'restricted'].includes(t.toLowerCase()),
    );

    return {
      assetId: node.id,
      assetName: node.name,
      exportedAt: new Date().toISOString(),
      upstreamSources: upstream.map(u => ({
        name: u.node.name,
        platform: u.node.platform,
        type: u.node.type,
      })),
      downstreamConsumers: downstream.map(d => ({
        name: d.node.name,
        platform: d.node.platform,
        type: d.node.type,
      })),
      columnLineage: colLineage.map(c => ({
        sourceTable: c.sourceTable,
        sourceColumn: c.sourceColumn,
        targetTable: c.targetTable,
        targetColumn: c.targetColumn,
        confidence: c.confidence,
      })),
      dataClassifications: classifications,
      lineageCoverage: confidence.coverage,
    };
  }
}
