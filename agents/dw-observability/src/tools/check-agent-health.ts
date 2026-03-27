/**
 * check_agent_health — Per-agent health status.
 *
 * Reads from the real-time health cache (KV store).
 * Health classification:
 *   - healthy: errorRate <= 5% and heartbeat < 60s ago
 *   - degraded: errorRate > 5% or heartbeat 60-300s ago
 *   - unhealthy: errorRate > 20% or heartbeat > 300s ago
 *
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { AgentHealth, HealthStatus } from '../types.js';
import { kvStore } from '../backends.js';

export const checkAgentHealthDefinition: ToolDefinition = {
  name: 'check_agent_health',
  description:
    'Check per-agent health status based on error rate and heartbeat recency. Returns healthy/degraded/unhealthy classification.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Specific agent to check. Omit for all agents.' },
    },
    required: [],
  },
};

function classifyHealth(errorRate: number, heartbeatAgeMs: number): HealthStatus {
  if (errorRate > 0.20 || heartbeatAgeMs > 300_000) return 'unhealthy';
  if (errorRate > 0.05 || heartbeatAgeMs > 60_000) return 'degraded';
  return 'healthy';
}

export const checkAgentHealthHandler: ToolHandler = async (args) => {
  const rawAgentName = args.agentName as string | undefined;
  const agentName = rawAgentName?.replace(/^dw-/, '') ?? undefined;

  try {
    const keys = agentName
      ? [`health:${agentName}`]
      : await kvStore.keys('health:*');

    if (keys.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `No health data found${agentName ? ` for agent '${agentName}'` : ''}` }) }],
        isError: true,
      };
    }

    const results: AgentHealth[] = [];

    for (const key of keys) {
      const raw = await kvStore.get(key);
      if (!raw) continue;

      const cached = JSON.parse(raw) as {
        agentName: string;
        lastHeartbeat: number;
        startedAt: number;
        errorRateLast5m: number;
      };

      const now = Date.now();
      const heartbeatAge = now - cached.lastHeartbeat;
      const status = classifyHealth(cached.errorRateLast5m, heartbeatAge);

      results.push({
        agentName: cached.agentName,
        status,
        lastHeartbeat: cached.lastHeartbeat,
        uptime: now - cached.startedAt,
        errorRateLast5m: cached.errorRateLast5m,
      });
    }

    if (results.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `No health data found for agent '${agentName}'` }) }],
        isError: true,
      };
    }

    const output = agentName ? results[0] : results;
    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
