import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { LineageResult, LineageNode, ColumnLineage, AssetType } from '../types.js';
import { graphDB, columnLineageExpander } from '../backends.js';
import type { InMemoryGraphDB } from '@data-workers/infrastructure-stubs';

export const getLineageDefinition: ToolDefinition = {
  name: 'get_lineage',
  description: 'Get the lineage graph for a data asset. Returns upstream sources and downstream consumers with column-level lineage when available.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Asset ID or fully qualified name.' },
      customerId: { type: 'string' },
      direction: { type: 'string', enum: ['upstream', 'downstream', 'both'], description: 'Traversal direction. Default: both.' },
      maxDepth: { type: 'number', description: 'Max traversal depth. Default: 5.' },
      includeColumnLineage: { type: 'boolean', description: 'Include column-level lineage. Default: true.' },
    },
    required: ['assetId', 'customerId'],
  },
};

/**
 * Retrieve lineage graph for a data asset.
 *
 * Resolution order: ID lookup → exact name match → partial name match.
 * Cross-tenant guard: if the resolved node belongs to a different tenant,
 * returns `asset_not_found` (intentionally indistinguishable from a genuine
 * miss to avoid leaking cross-tenant asset existence information).
 */
export const getLineageHandler: ToolHandler = async (args) => {
  // Hoist input params before try so they are accessible in the catch block
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = args.customerId as string;

  try {
    const direction = (args.direction as string) ?? 'both';
    const maxDepth = Math.min((args.maxDepth as number) ?? 5, 20); // Cap at 20 to prevent unbounded BFS
    const includeColumns = (args.includeColumnLineage as boolean) ?? true;
    // Try to find the node by ID first, then by exact name, then by partial name
    let node = await graphDB.getNode(assetId);
    if (!node) {
      const byName = await graphDB.findByName(assetId);
      const exactMatch = byName.find(n => n.name.toLowerCase() === assetId.toLowerCase());
      node = exactMatch || byName[0] || undefined;
    }

    // Cross-tenant guard: ensure the resolved node belongs to the caller's tenant
    if (node && node.customerId !== customerId) {
      node = undefined;
    }

    if (!node) {
      // Return empty lineage instead of erroring when asset has no lineage data
      return {
        content: [{ type: 'text', text: JSON.stringify({
          assetId,
          upstream: [],
          downstream: [],
          depth: Math.min((args.maxDepth as number) ?? 5, 20),
        }, null, 2) }],
      };
    }

    const upstream: LineageNode[] = [];
    const downstream: LineageNode[] = [];

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
        });
      }
    }

    // Build column lineage with confidence scores via ColumnLineageExpander
    let columnLineage: ColumnLineage[] | undefined;
    let columnLineageConfidence: { overall: number; explicitEdges: number; inferredEdges: number; totalEdges: number; coverage: number } | undefined;
    if (includeColumns) {
      const expandedLineage = await columnLineageExpander.getColumnLineage(
        node.id,
        graphDB as InMemoryGraphDB,
      );
      if (expandedLineage.length > 0) {
        columnLineage = expandedLineage.map(cl => ({
          sourceColumn: cl.sourceColumn,
          sourceTable: cl.sourceTable,
          targetColumn: cl.targetColumn,
          targetTable: cl.targetTable,
          transformation: cl.transformation !== 'direct' ? cl.transformation : undefined,
        }));
        // Compute confidence score for the lineage
        columnLineageConfidence = await columnLineageExpander.computeConfidence(
          node.id,
          graphDB as InMemoryGraphDB,
        );
      }
    }

    const result: LineageResult & { columnLineageConfidence?: typeof columnLineageConfidence } = {
      assetId: node.id,
      upstream,
      downstream,
      columnLineage,
      depth: maxDepth,
    };
    if (columnLineageConfidence) {
      result.columnLineageConfidence = columnLineageConfidence;
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: { type: 'lineage_error', message: `Failed to retrieve lineage: ${msg}` },
        assetId,
      }, null, 2) }],
      isError: true,
    };
  }
};
