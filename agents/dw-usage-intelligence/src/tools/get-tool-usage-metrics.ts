/**
 * get_tool_usage_metrics — Usage volume, unique users, trends per tool/agent.
 *
 * Aggregates usage_events by tool, agent, or user over a time period.
 * NO LLM calls — purely deterministic aggregation.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ToolUsageMetric, ToolUsageMetricsResult } from '../types.js';
import { relationalStore, getCurrentTimestamp } from '../backends.js';

export const getToolUsageMetricsDefinition: ToolDefinition = {
  name: 'get_tool_usage_metrics',
  description:
    'Get usage volume, unique users, trend direction, and response times for MCP tools. Supports grouping by tool, agent, or user. Shows which tools practitioners use most and whether usage is growing or declining.',
  inputSchema: {
    type: 'object',
    properties: {
      toolName: { type: 'string', description: 'Filter by specific MCP tool name (e.g. "validate_schema"). Omit for all tools.' },
      agentName: { type: 'string', description: 'Filter by agent (e.g. "pipelines"). Omit for all agents.' },
      teamId: { type: 'string', description: 'Filter by team (e.g. "platform", "analytics", "governance"). Omit for all teams.' },
      period: { type: 'string', description: 'Time period: "1d", "7d", "30d". Defaults to "7d".' },
      groupBy: { type: 'string', description: '"tool", "agent", or "user". Defaults to "tool".' },
    },
    required: [],
  },
};

export const getToolUsageMetricsHandler: ToolHandler = async (args) => {
  const toolName = args.toolName as string | undefined;
  const agentName = args.agentName as string | undefined;
  const teamId = args.teamId as string | undefined;
  const period = (args.period as string) ?? '7d';
  const groupBy = (args.groupBy as string) ?? 'tool';

  try {
    const days = period === '1d' ? 1 : period === '30d' ? 30 : 7;
    const cutoff = getCurrentTimestamp() - days * 24 * 60 * 60 * 1000;

    // For trend calculation, also get the prior period
    const priorCutoff = cutoff - days * 24 * 60 * 60 * 1000;

    const currentRows = await relationalStore.query(
      'usage_events',
      (row) => {
        if ((row.timestamp as number) < cutoff) return false;
        if (toolName && row.toolName !== toolName) return false;
        if (agentName && row.agentName !== agentName) return false;
        if (teamId && row.teamId !== teamId) return false;
        return true;
      },
    );

    const priorRows = await relationalStore.query(
      'usage_events',
      (row) => {
        const ts = row.timestamp as number;
        if (ts < priorCutoff || ts >= cutoff) return false;
        if (toolName && row.toolName !== toolName) return false;
        if (agentName && row.agentName !== agentName) return false;
        if (teamId && row.teamId !== teamId) return false;
        return true;
      },
    );

    // Group current rows
    const groups: Record<string, typeof currentRows> = {};
    const priorGroups: Record<string, typeof priorRows> = {};

    for (const row of currentRows) {
      const key = groupBy === 'user' ? row.userId as string
        : groupBy === 'agent' ? row.agentName as string
        : `${row.agentName}:${row.toolName}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    for (const row of priorRows) {
      const key = groupBy === 'user' ? row.userId as string
        : groupBy === 'agent' ? row.agentName as string
        : `${row.agentName}:${row.toolName}`;
      if (!priorGroups[key]) priorGroups[key] = [];
      priorGroups[key].push(row);
    }

    const metrics: ToolUsageMetric[] = [];

    for (const [key, rows] of Object.entries(groups)) {
      const totalCalls = rows.length;
      const uniqueUsers = new Set(rows.map((r) => r.userId as string)).size;
      const avgResponseTimeMs = Math.round(
        rows.reduce((s, r) => s + (r.durationMs as number), 0) / totalCalls,
      );

      // Token count aggregation
      const totalTokens = rows.reduce((s, r) => s + (r.tokenCount as number || 0), 0);
      const avgTokenCount = Math.round(totalTokens / totalCalls);

      // Error rate
      const errorCount = rows.filter((r) => r.outcome === 'error').length;
      const errorRate = Math.round((errorCount / totalCalls) * 10000) / 10000;

      // Peak hour
      const hourCounts: Record<number, number> = {};
      for (const row of rows) {
        const hour = new Date(row.timestamp as number).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '0';

      // Trend
      const priorCount = priorGroups[key]?.length ?? 0;
      let trendDirection: 'up' | 'down' | 'stable' = 'stable';
      let trendPercentage = 0;
      if (priorCount > 0) {
        trendPercentage = Math.round(((totalCalls - priorCount) / priorCount) * 1000) / 10;
        trendDirection = trendPercentage > 5 ? 'up' : trendPercentage < -5 ? 'down' : 'stable';
      } else if (totalCalls > 0) {
        trendDirection = 'up';
        trendPercentage = 100;
      }

      const parts = key.split(':');
      metrics.push({
        name: groupBy === 'tool' ? (parts[1] || key) : key,
        agent: groupBy === 'tool' ? parts[0] : (groupBy === 'agent' ? key : ''),
        totalCalls,
        uniqueUsers,
        avgCallsPerUser: Math.round((totalCalls / uniqueUsers) * 10) / 10,
        avgResponseTimeMs,
        avgTokenCount,
        totalTokens,
        errorRate,
        trendDirection,
        trendPercentage,
        peakHour: parseInt(peakHour, 10),
      });
    }

    // Sort by totalCalls descending
    metrics.sort((a, b) => b.totalCalls - a.totalCalls);

    const allUsers = new Set(currentRows.map((r) => r.userId as string));

    const result: ToolUsageMetricsResult = {
      period,
      groupBy,
      metrics,
      summary: {
        totalCalls: currentRows.length,
        totalUniqueUsers: allUsers.size,
        mostUsedTool: metrics[0]?.name ?? 'none',
        leastUsedTool: metrics[metrics.length - 1]?.name ?? 'none',
      },
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
