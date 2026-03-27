/**
 * trace_cross_platform_lineage — Unified lineage across multiple platforms.
 * Upgrade get_lineage to stitch lineage across CatalogRegistry connectors.
 *
 * Queries the local graph DB first, then fans out to registered CatalogRegistry
 * providers (with per-connector timeout), merging results into a single graph.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { InvalidParameterError, ServerToolCallError } from '@data-workers/mcp-framework';
import { graphDB, catalogRegistry } from '../backends.js';
import type { IGraphDB } from '@data-workers/infrastructure-stubs';
import { traceAcrossPlatforms } from '../search/lineage-api.js';

export const traceCrossPlatformLineageDefinition: ToolDefinition = {
  name: 'trace_cross_platform_lineage',
  description:
    'Trace unified lineage for a data asset across multiple platforms. ' +
    'Queries the local lineage graph and all registered CatalogRegistry connectors, ' +
    'stitching results into a single cross-platform graph with confidence scores per edge.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Asset ID or fully qualified name.' },
      customerId: { type: 'string' },
      direction: {
        type: 'string',
        enum: ['upstream', 'downstream', 'both'],
        description: 'Traversal direction. Default: both.',
      },
      maxDepth: { type: 'number', description: 'Max traversal depth. Default: 5.' },
      includeColumnLineage: {
        type: 'boolean',
        description: 'Include column-level lineage. Default: true.',
      },
      includeOrchestration: {
        type: 'boolean',
        description: 'Add Airflow DAG/task orchestration context to lineage nodes. Default: false.',
      },
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter to specific platform connectors (e.g. ["snowflake","bigquery"]). Default: all registered.',
      },
    },
    required: ['assetId', 'customerId'],
  },
};

export const traceCrossPlatformLineageHandler: ToolHandler = async (args) => {
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = args.customerId as string;

  if (!assetId || typeof assetId !== 'string') {
    throw new InvalidParameterError('Parameter "assetId" is required and must be a string.');
  }
  if (!customerId || typeof customerId !== 'string') {
    throw new InvalidParameterError('Parameter "customerId" is required and must be a string.');
  }

  try {
    const direction = (args.direction as string) ?? 'both';
    const maxDepth = Math.min((args.maxDepth as number) ?? 5, 20);
    const includeColumnLineage = (args.includeColumnLineage as boolean) ?? true;
    const includeOrchestration = (args.includeOrchestration as boolean) ?? false;
    const platforms = (args.platforms as string[] | undefined) ?? undefined;

    const result = await traceAcrossPlatforms(assetId, {
      customerId,
      direction,
      maxDepth,
      includeColumnLineage,
      includeOrchestration,
      platforms,
    }, graphDB as IGraphDB, catalogRegistry);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          error: { type: error.code, message: error.message, retryable: error.retryable },
          assetId,
        }, null, 2) }],
        isError: true,
      };
    }
    const wrapped = new ServerToolCallError(
      `Failed to trace cross-platform lineage: ${error instanceof Error ? error.message : String(error)}`,
      'LINEAGE_BACKEND_ERROR',
    );
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: { type: wrapped.code, message: wrapped.message, retryable: wrapped.retryable },
        assetId,
      }, null, 2) }],
      isError: true,
    };
  }
};
