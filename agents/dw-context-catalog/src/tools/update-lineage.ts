/**
 * update_lineage — Additive lineage edge management with soft-delete rollback.
 * Write tool that adds lineage edges to the graph or soft-deletes them.
 *
 * Invariants:
 * - Additive only: never removes existing edges from the graph
 * - Soft-delete marks an edge with a `_deleted` metadata flag but retains it for audit
 * - Validates no self-loops or duplicate edges before insertion
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { InvalidParameterError, ServerToolCallError } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { graphDB } from '../backends.js';
import type { IGraphDB, GraphEdge } from '@data-workers/infrastructure-stubs';
import { randomUUID } from 'node:crypto';

export const updateLineageDefinition: ToolDefinition = {
  name: 'update_lineage',
  description:
    'Add a lineage edge between two datasets or soft-delete an existing edge. Additive only — edges are never physically removed.',
  inputSchema: {
    type: 'object',
    properties: {
      sourceDatasetId: {
        type: 'string',
        description: 'ID or fully-qualified name of the upstream (source) dataset.',
      },
      targetDatasetId: {
        type: 'string',
        description: 'ID or fully-qualified name of the downstream (target) dataset.',
      },
      customerId: {
        type: 'string',
        description: 'Tenant ID for cross-tenant guard.',
      },
      transformationType: {
        type: 'string',
        enum: ['etl', 'view', 'materialization', 'stream', 'manual'],
        description: 'Type of transformation this edge represents. Default: manual.',
      },
      pipelineId: {
        type: 'string',
        description: 'Optional pipeline ID that owns this edge.',
      },
      sqlTransformation: {
        type: 'string',
        description: 'Optional SQL transformation expression.',
      },
      columnMapping: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            target: { type: 'string' },
            transformation: { type: 'string' },
          },
          required: ['source', 'target', 'transformation'],
        },
        description: 'Optional column-level mapping array.',
      },
      softDelete: {
        type: 'string',
        description: 'Edge ID to soft-delete instead of adding a new edge.',
      },
    },
    required: ['sourceDatasetId', 'targetDatasetId'],
  },
};

// ── Helpers ──

/** Resolve a dataset by ID or name, respecting tenant guard. */
async function resolveNode(
  idOrName: string,
  customerId: string | undefined,
  db: IGraphDB,
) {
  let node = await db.getNode(idOrName);
  if (!node) {
    const byName = await db.findByName(idOrName, customerId);
    const exact = byName.find(
      (n) => n.name.toLowerCase() === idOrName.toLowerCase(),
    );
    node = exact ?? byName[0] ?? undefined;
  }
  if (node && customerId && node.customerId !== customerId) {
    return undefined;
  }
  return node;
}

/** Generate a deterministic-ish edge ID from source + target + timestamp. */
function generateEdgeId(source: string, target: string): string {
  return `edge-${source}-${target}-${randomUUID().slice(0, 8)}`;
}

// ── Handler ──

export const updateLineageHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('update_lineage')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: 'update_lineage' }) }],
      isError: true,
    };
  }

  const sourceDatasetId = args.sourceDatasetId as string;
  const targetDatasetId = args.targetDatasetId as string;
  const customerId = args.customerId as string | undefined;
  const transformationType =
    (args.transformationType as string) ?? 'manual';
  const pipelineId = args.pipelineId as string | undefined;
  const sqlTransformation = args.sqlTransformation as string | undefined;
  const columnMapping = args.columnMapping as
    | Array<{ source: string; target: string; transformation: string }>
    | undefined;
  const softDelete = args.softDelete as string | undefined;

  if (!sourceDatasetId || typeof sourceDatasetId !== 'string') {
    throw new InvalidParameterError(
      'Parameter "sourceDatasetId" is required and must be a string.',
    );
  }
  if (!targetDatasetId || typeof targetDatasetId !== 'string') {
    throw new InvalidParameterError(
      'Parameter "targetDatasetId" is required and must be a string.',
    );
  }

  const db = graphDB as IGraphDB;
  const auditTrailId = `audit-${randomUUID().slice(0, 12)}`;
  const timestamp = Date.now();

  try {
    // ── Soft-delete path ──
    if (softDelete) {
      // Find the edge between source and target, mark it deleted
      const edges = await db.getEdgesBetween(sourceDatasetId, targetDatasetId);
      const targetEdge = edges.find(
        (e) =>
          (e.properties?.edgeId === softDelete) ||
          // fallback: match by source+target if edgeId not stored
          (edges.length === 1),
      );

      if (!targetEdge) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'edge_not_found',
                  message: `No edge with ID "${softDelete}" found between ${sourceDatasetId} and ${targetDatasetId}.`,
                  softDelete,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      // Mark as soft-deleted by adding a new edge with _deleted metadata
      // (additive only — original edge is never removed)
      const deletedEdge: GraphEdge = {
        source: targetEdge.source,
        target: targetEdge.target,
        relationship: targetEdge.relationship,
        properties: {
          ...targetEdge.properties,
          _deleted: true,
          _deletedAt: timestamp,
          _deletedEdgeId: softDelete,
          auditTrailId,
        },
      };
      await db.addEdge(deletedEdge);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                lineageEdgeId: softDelete,
                sourceDatasetId,
                targetDatasetId,
                graphUpdated: true,
                softDeleted: true,
                auditTrailId,
                message: `Edge "${softDelete}" soft-deleted. Original retained for audit.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // ── Add-edge path ──

    // 1. Validate both source and target exist
    const sourceNode = await resolveNode(sourceDatasetId, customerId, db);
    if (!sourceNode) {
      throw new InvalidParameterError(
        `Source dataset "${sourceDatasetId}" not found in graph (or tenant mismatch).`,
      );
    }

    const targetNode = await resolveNode(targetDatasetId, customerId, db);
    if (!targetNode) {
      throw new InvalidParameterError(
        `Target dataset "${targetDatasetId}" not found in graph (or tenant mismatch).`,
      );
    }

    // 2. Validate no self-loops
    if (sourceNode.id === targetNode.id) {
      throw new InvalidParameterError(
        'Self-loop detected: source and target datasets must be different.',
      );
    }

    // 3. Check for duplicate edges (non-deleted)
    const existingEdges = await db.getEdgesBetween(sourceNode.id, targetNode.id);
    const activeDuplicates = existingEdges.filter(
      (e) =>
        !e.properties?._deleted &&
        e.properties?.transformationType === transformationType,
    );
    if (activeDuplicates.length > 0) {
      throw new InvalidParameterError(
        `Duplicate edge: an active "${transformationType}" edge already exists between "${sourceNode.id}" and "${targetNode.id}".`,
      );
    }

    // 4. Add the edge
    const edgeId = generateEdgeId(sourceNode.id, targetNode.id);
    const newEdge: GraphEdge = {
      source: sourceNode.id,
      target: targetNode.id,
      relationship: 'derives_from',
      properties: {
        edgeId,
        transformationType,
        pipelineId: pipelineId ?? null,
        sqlTransformation: sqlTransformation ?? null,
        columnMapping: columnMapping ?? null,
        createdAt: timestamp,
        auditTrailId,
        _deleted: false,
      },
    };
    await db.addEdge(newEdge);

    // 5. Compute upstream/downstream counts for response
    const upstreamResults = await db.traverseUpstream(targetNode.id, 5);
    const downstreamResults = await db.traverseDownstream(sourceNode.id, 5);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              lineageEdgeId: edgeId,
              sourceDatasetId: sourceNode.id,
              targetDatasetId: targetNode.id,
              graphUpdated: true,
              totalUpstreamNodes: upstreamResults.length,
              totalDownstreamNodes: downstreamResults.length,
              auditTrailId,
              transformationType,
              pipelineId: pipelineId ?? null,
              columnMapping: columnMapping ?? null,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: {
                  type: error.code,
                  message: error.message,
                  retryable: error.retryable,
                },
                sourceDatasetId,
                targetDatasetId,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
    const wrapped = new ServerToolCallError(
      `Failed to update lineage: ${error instanceof Error ? error.message : String(error)}`,
      'LINEAGE_UPDATE_ERROR',
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: {
                type: wrapped.code,
                message: wrapped.message,
                retryable: wrapped.retryable,
              },
              sourceDatasetId,
              targetDatasetId,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
};
