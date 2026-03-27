/**
 * get_agent_metrics — p50/p95/p99 latency, error rates, token consumption.
 * Retained from dw-observability for backwards compatibility.
 *
 * Queries the agent_metrics table and aggregates across the requested period.
 * NO LLM calls — purely deterministic aggregation.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { AgentMetrics } from '../types.js';
import { relationalStore } from '../backends.js';

export const getAgentMetricsDefinition: ToolDefinition = {
  name: 'get_agent_metrics',
  description:
    'Get p50/p95/p99 latency, error rates, token consumption, and confidence for an agent over a time period. Deterministic — no LLM in collection path.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Name of the agent (e.g. "pipelines", "incidents").' },
      period: { type: 'string', description: 'Time period: "1d", "7d". Defaults to "7d".' },
    },
    required: ['agentName'],
  },
};

export const getAgentMetricsHandler: ToolHandler = async (args) => {
  const agentName = args.agentName as string;
  const period = (args.period as string) ?? '7d';

  try {
    const days = period === '1d' ? 1 : 7;

    const rows = await relationalStore.query(
      'agent_metrics',
      (row) => row.agentName === agentName && (row.day as number) < days,
    );

    if (rows.length === 0) {
      const emptyMetrics: AgentMetrics = {
        agentName,
        period,
        latency: { p50: 0, p95: 0, p99: 0 },
        errorRate: 0,
        totalInvocations: 0,
        avgTokens: 0,
        avgConfidence: 0,
        escalationRate: 0,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify({ ...emptyMetrics, message: 'No metrics data available yet' }, null, 2) }],
      };
    }

    const totalRows = rows.length;
    const avgP50 = rows.reduce((s, r) => s + (r.p50 as number), 0) / totalRows;
    const avgP95 = rows.reduce((s, r) => s + (r.p95 as number), 0) / totalRows;
    const avgP99 = rows.reduce((s, r) => s + (r.p99 as number), 0) / totalRows;
    const avgErrorRate = rows.reduce((s, r) => s + (r.errorRate as number), 0) / totalRows;
    const totalInvocations = rows.reduce((s, r) => s + (r.totalInvocations as number), 0);
    const avgTokens = rows.reduce((s, r) => s + (r.avgTokens as number), 0) / totalRows;
    const avgConfidence = rows.reduce((s, r) => s + (r.avgConfidence as number), 0) / totalRows;
    const avgEscalation = rows.reduce((s, r) => s + (r.escalationRate as number), 0) / totalRows;

    const metrics: AgentMetrics = {
      agentName,
      period,
      latency: {
        p50: Math.round(avgP50 * 100) / 100,
        p95: Math.round(avgP95 * 100) / 100,
        p99: Math.round(avgP99 * 100) / 100,
      },
      errorRate: Math.round(avgErrorRate * 10000) / 10000,
      totalInvocations,
      avgTokens: Math.round(avgTokens),
      avgConfidence: Math.round(avgConfidence * 10000) / 10000,
      escalationRate: Math.round(avgEscalation * 10000) / 10000,
    };

    return { content: [{ type: 'text', text: JSON.stringify(metrics, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
