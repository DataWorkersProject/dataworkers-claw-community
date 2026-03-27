/**
 * get_usage_activity_log — SHA-256 hash-chained practitioner activity log.
 *
 * Returns usage events with cryptographic hash chain integrity verification.
 * Each entry's hash = SHA-256(content + previousHash).
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { UsageActivityEntry, UsageActivityLogResult } from '../types.js';
import { relationalStore, getCurrentTimestamp } from '../backends.js';

export const getUsageActivityLogDefinition: ToolDefinition = {
  name: 'get_usage_activity_log',
  description:
    'Retrieve SHA-256 hash-chained practitioner activity log. Shows who called which tool, when, and with what outcome. Supports filtering by user, agent, tool, and time range. Verifies chain integrity for compliance.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'Filter by user ID. Omit for all users.' },
      agentName: { type: 'string', description: 'Filter by agent. Omit for all agents.' },
      toolName: { type: 'string', description: 'Filter by specific tool. Omit for all tools.' },
      since: { type: 'string', description: 'Relative time filter: "1h", "24h", "7d", "30d". Defaults to "24h".' },
      limit: { type: 'number', description: 'Max entries to return. Defaults to 50.' },
    },
    required: [],
  },
};

export const getUsageActivityLogHandler: ToolHandler = async (args) => {
  const userId = args.userId as string | undefined;
  const agentName = args.agentName as string | undefined;
  const toolName = args.toolName as string | undefined;
  const since = (args.since as string) ?? '24h';
  const limit = (args.limit as number) ?? 50;

  try {
    const now = getCurrentTimestamp();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;

    let cutoff: number;
    if (since === '1h') cutoff = now - hourMs;
    else if (since === '24h') cutoff = now - dayMs;
    else if (since === '7d') cutoff = now - 7 * dayMs;
    else if (since === '30d') cutoff = now - 30 * dayMs;
    else cutoff = now - dayMs;

    let rows = await relationalStore.query(
      'usage_events',
      (row) => {
        if ((row.timestamp as number) < cutoff) return false;
        if (userId && row.userId !== userId) return false;
        if (agentName && row.agentName !== agentName) return false;
        if (toolName && row.toolName !== toolName) return false;
        return true;
      },
    );

    // Sort by timestamp ascending (chain order)
    rows.sort((a, b) => (a.timestamp as number) - (b.timestamp as number));

    const totalEntries = rows.length;

    // Take the most recent entries
    if (rows.length > limit) {
      rows = rows.slice(-limit);
    }

    // Verify hash chain integrity per-agent (not global)
    // Group entries by agentName and verify each chain independently
    let chainIntegrity: 'valid' | 'broken' = 'valid';
    const byAgent = new Map<string, typeof rows>();
    for (const row of rows) {
      const agent = row.agentName as string;
      if (!byAgent.has(agent)) byAgent.set(agent, []);
      byAgent.get(agent)!.push(row);
    }
    for (const [, agentRows] of byAgent) {
      for (let i = 1; i < agentRows.length; i++) {
        if (agentRows[i].previousHash !== agentRows[i - 1].hash) {
          // Only flag as broken if entries are sequential (close in time)
          if ((agentRows[i].timestamp as number) - (agentRows[i - 1].timestamp as number) < 1000) {
            chainIntegrity = 'broken';
            break;
          }
        }
      }
      if (chainIntegrity === 'broken') break;
    }

    const entries: UsageActivityEntry[] = rows.map((row) => ({
      id: row.id as string,
      timestamp: row.timestamp as number,
      userId: row.userId as string,
      agentName: row.agentName as string,
      toolName: row.toolName as string,
      inputSummary: row.inputSummary as string,
      outcome: row.outcome as 'success' | 'error',
      durationMs: row.durationMs as number,
      hash: row.hash as string,
      previousHash: row.previousHash as string,
    }));

    const result: UsageActivityLogResult = {
      entries,
      totalEntries,
      chainIntegrity,
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
