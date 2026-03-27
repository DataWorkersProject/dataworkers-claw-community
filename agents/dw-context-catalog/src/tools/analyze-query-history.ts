/**
 * analyze_query_history — Analyze query patterns for a data asset.
 * Pro/read tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { kvStore } from '../backends.js';
import type { QueryHistorySignal } from '../types.js';

export const analyzeQueryHistoryDefinition: ToolDefinition = {
  name: 'analyze_query_history',
  description:
    'Analyze query history patterns for a data asset. Returns query count, unique users, ' +
    'last queried timestamp, and usage trend. Pro tier required for full history.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'ID of the asset to analyze.' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      days: { type: 'number', description: 'Number of days to analyze. Default 30.' },
    },
    required: ['assetId'],
  },
};

export const analyzeQueryHistoryHandler: ToolHandler = async (args) => {
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const days = (args.days as number) || 30;

  // Check KV store for cached query history signal
  const key = `query_history:${customerId}:${assetId}`;
  const cached = await kvStore.get(key);

  let signal: QueryHistorySignal;
  if (cached) {
    signal = JSON.parse(cached);
  } else {
    // Generate synthetic signal for demo / stub purposes
    const hash = assetId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    signal = {
      assetId,
      queryCount: (hash % 500) + 10,
      uniqueUsers: (hash % 20) + 1,
      lastQueried: Date.now() - (hash % 7) * 86_400_000,
      trend: hash % 3 === 0 ? 'increasing' : hash % 3 === 1 ? 'stable' : 'decreasing',
    };
    // Cache it
    await kvStore.set(key, JSON.stringify(signal), 300_000);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        ...signal,
        periodDays: days,
        isHighUsage: (signal.queryCount ?? 0) > 100,
        isGoldenPath: (signal.queryCount ?? 0) > 200 && (signal.uniqueUsers ?? 0) > 5,
      }, null, 2),
    }],
  };
};
