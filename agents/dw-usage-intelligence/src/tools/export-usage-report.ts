/**
 * export_usage_report — Export usage data to JSON/CSV format (Pro tier).
 *
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { relationalStore } from '../backends.js';

export const exportUsageReportDefinition: ToolDefinition = {
  name: 'export_usage_report',
  description:
    'Export usage data as JSON or CSV format string. Supports filtering by agent, user, and time range. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['json', 'csv'], description: 'Output format. Defaults to "json".' },
      agentName: { type: 'string', description: 'Filter by agent. Omit for all agents.' },
      userId: { type: 'string', description: 'Filter by user. Omit for all users.' },
      since: { type: 'string', description: 'Relative time filter: "1d", "7d", "30d". Defaults to "7d".' },
      limit: { type: 'number', description: 'Max rows. Defaults to 500.' },
    },
    required: [],
  },
};

export const exportUsageReportHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('export_usage_report')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'export_usage_report requires Pro tier or higher. Set DW_LICENSE_TIER=pro to enable.' }) }],
      isError: true,
    };
  }

  try {
    const format = (args.format as string) ?? 'json';
    const agentName = args.agentName as string | undefined;
    const userId = args.userId as string | undefined;
    const since = (args.since as string) ?? '7d';
    const limit = (args.limit as number) ?? 500;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let cutoff: number;
    if (since === '1d') cutoff = now - dayMs;
    else if (since === '7d') cutoff = now - 7 * dayMs;
    else if (since === '30d') cutoff = now - 30 * dayMs;
    else cutoff = now - 7 * dayMs;

    let rows = await relationalStore.query('usage_events', (row) => {
      if ((row.timestamp as number) < cutoff) return false;
      if (agentName && row.agentName !== agentName) return false;
      if (userId && row.userId !== userId) return false;
      return true;
    });

    rows.sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
    if (rows.length > limit) rows = rows.slice(0, limit);

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'userId', 'teamId', 'agentName', 'toolName', 'outcome', 'durationMs', 'tokenCount'];
      const csvRows = rows.map((row) =>
        headers.map((h) => String(row[h] ?? '')).join(','),
      );
      const csv = [headers.join(','), ...csvRows].join('\n');
      return {
        content: [{ type: 'text', text: JSON.stringify({ format: 'csv', rowCount: rows.length, data: csv }, null, 2) }],
      };
    }

    // JSON format
    const data = rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      userId: row.userId,
      teamId: row.teamId,
      agentName: row.agentName,
      toolName: row.toolName,
      outcome: row.outcome,
      durationMs: row.durationMs,
      tokenCount: row.tokenCount,
    }));

    return {
      content: [{ type: 'text', text: JSON.stringify({ format: 'json', rowCount: data.length, data }, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
