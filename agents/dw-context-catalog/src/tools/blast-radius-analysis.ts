/**
 * blast_radius_analysis MCP tool — 
 * Upgraded impact analysis with column-level tracing, PR diff parsing,
 * and cross-platform blast radius.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { graphDB } from '../backends.js';
import { ImpactAnalyzer } from '../search/impact-analyzer.js';

const impactAnalyzer = new ImpactAnalyzer();

export const blastRadiusAnalysisDefinition: ToolDefinition = {
  name: 'blast_radius_analysis',
  description:
    'Analyze the blast radius of a data change with column-level granularity, PR diff parsing, and cross-platform impact. ' +
    'Returns affected downstream assets, stakeholders, dashboards, SLAs, and severity classification. ' +
    'Supports column drops/renames/type changes, table drops, model refactors, and unified PR diffs.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: {
        type: 'string',
        description: 'Asset ID or name to assess. Required unless changeType is pr_diff.',
      },
      customerId: { type: 'string', description: 'Customer/tenant ID.' },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth for impact traversal. Default: 5.',
      },
      changeType: {
        type: 'string',
        enum: ['column_drop', 'column_rename', 'column_type_change', 'table_drop', 'model_refactor', 'pr_diff'],
        description: 'Type of change being analyzed. Omit for general blast radius.',
      },
      columnName: {
        type: 'string',
        description: 'Column name for column-level analysis. Used with column_drop, column_rename, column_type_change.',
      },
      prDiff: {
        type: 'string',
        description: 'Unified diff text for pr_diff changeType. Parses column/table changes from the diff automatically.',
      },
    },
    required: ['customerId'],
  },
};

export const blastRadiusAnalysisHandler: ToolHandler = async (args) => {
  const customerId = args.customerId as string;
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string | undefined;
  const maxDepth = (args.maxDepth as number) ?? 5;
  const changeType = args.changeType as string | undefined;
  const columnName = args.columnName as string | undefined;
  const prDiff = args.prDiff as string | undefined;

  try {
    // PR diff mode: parse diff and analyze all extracted changes
    if (changeType === 'pr_diff' && prDiff) {
      const result = await impactAnalyzer.analyzePrDiff(prDiff, customerId, graphDB, maxDepth);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    // Column-level analysis
    if (
      columnName &&
      assetId &&
      changeType &&
      ['column_drop', 'column_rename', 'column_type_change'].includes(changeType)
    ) {
      const result = await impactAnalyzer.analyzeColumnImpact(
        assetId,
        columnName,
        changeType as 'column_drop' | 'column_rename' | 'column_type_change',
        customerId,
        graphDB,
        maxDepth,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    // Table-level / general blast radius (backward compatible)
    if (!assetId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'assetId is required unless changeType is pr_diff with a prDiff payload.',
          }),
        }],
        isError: true,
      };
    }

    const result = await impactAnalyzer.analyzeImpact(assetId, customerId, graphDB, maxDepth);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
