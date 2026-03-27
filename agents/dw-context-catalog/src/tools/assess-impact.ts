/**
 * assess_impact MCP tool — quantifies blast radius before changes.
 * "This column feeds 3 dbt models, 2 dashboards viewed by 47 users. Impact: HIGH."
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { graphDB } from '../backends.js';
import { ImpactAnalyzer } from '../search/impact-analyzer.js';

const impactAnalyzer = new ImpactAnalyzer();

export const assessImpactDefinition: ToolDefinition = {
  name: 'assess_impact',
  description: 'Assess the downstream impact of changing a data asset. Returns blast radius, affected dashboards/models/pipelines, severity classification, and recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Asset ID or name to assess.' },
      customerId: { type: 'string' },
      maxDepth: { type: 'number', description: 'Maximum depth for impact traversal. Default: 5.' },
    },
    required: ['assetId', 'customerId'],
  },
};

export const assessImpactHandler: ToolHandler = async (args) => {
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = args.customerId as string;
  const maxDepth = (args.maxDepth as number) ?? 5;

  try {
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
