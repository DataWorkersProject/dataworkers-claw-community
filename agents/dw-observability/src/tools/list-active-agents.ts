/**
 * list_active_agents — All active agent instances.
 *
 * Returns summary of all agents with their current health status
 * and key metrics from the health cache.
 *
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { kvStore } from '../backends.js';

export interface ActiveAgent {
  agentName: string;
  status: string;
  lastHeartbeat: number;
  errorRateLast5m: number;
}

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

      agents.push({
        agentName: cached.agentName,
        status: cached.status,
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
