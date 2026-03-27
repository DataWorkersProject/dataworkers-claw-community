/**
 * list_active_agents — All active agent instances.
 * Retained from dw-observability for backwards compatibility.
 *
 * Returns summary of all agents with their current health status
 * and key metrics from the health cache.
 *
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ActiveAgent } from '../types.js';
import { kvStore, getCurrentTimestamp } from '../backends.js';
import { classifyHealth } from './check-agent-health.js';

export const listActiveAgentsDefinition: ToolDefinition = {
  name: 'list_active_agents',
  description:
    'List all active agent instances with their current health status and key metrics.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const listActiveAgentsHandler: ToolHandler = async () => {
  try {
    // Try importing AgentRegistry for real agent status
    try {
      await import('@data-workers/orchestrator');
      // AgentRegistry available — could enrich with registry data in future
    } catch {
      // AgentRegistry not available — fall back to KV health cache only
    }

    const keys = await kvStore.keys('health:*');

    if (keys.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'No active agents found' }) }],
        isError: true,
      };
    }

    const agents: ActiveAgent[] = [];

    for (const key of keys) {
      const raw = await kvStore.get(key);
      if (!raw) continue;

      const cached = JSON.parse(raw) as {
        agentName: string;
        status: string;
        lastHeartbeat: number;
        errorRateLast5m: number;
      };

      // Use classifyHealth() for consistent health classification
      const now = getCurrentTimestamp();
      const heartbeatAge = now - cached.lastHeartbeat;
      const status = classifyHealth(cached.errorRateLast5m, heartbeatAge);

      agents.push({
        agentName: cached.agentName,
        status,
        lastHeartbeat: cached.lastHeartbeat,
        errorRateLast5m: cached.errorRateLast5m,
      });
    }

    // Sort alphabetically by name
    agents.sort((a, b) => a.agentName.localeCompare(b.agentName));

    return { content: [{ type: 'text', text: JSON.stringify(agents, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
