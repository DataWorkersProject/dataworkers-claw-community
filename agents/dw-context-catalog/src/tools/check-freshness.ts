import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { FreshnessTracker } from '../search/freshness-tracker.js';

const freshnessTracker = new FreshnessTracker();

export const checkFreshnessDefinition: ToolDefinition = {
  name: 'check_freshness',
  description: 'Check the freshness of a data asset. Returns freshness score (0-100), last-updated timestamp, SLA compliance status, and staleness alerts.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Asset ID or name.' },
      customerId: { type: 'string' },
      slaTargetMs: { type: 'number', description: 'SLA target in milliseconds. Default: 86400000 (24h).' },
    },
    required: ['assetId', 'customerId'],
  },
};

export const checkFreshnessHandler: ToolHandler = async (args) => {
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = args.customerId as string;
  const slaTargetMs = (args.slaTargetMs as number) ?? 86_400_000;

  const info = await freshnessTracker.checkFreshness(assetId, customerId, slaTargetMs);

  return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
};
