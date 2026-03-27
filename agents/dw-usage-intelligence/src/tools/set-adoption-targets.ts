/**
 * set_adoption_targets — Set adoption targets per agent for dashboard tracking (Pro tier).
 *
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { kvStore } from '../backends.js';

export const setAdoptionTargetsDefinition: ToolDefinition = {
  name: 'set_adoption_targets',
  description:
    'Set adoption targets per agent for dashboard tracking. Define target active users and usage thresholds. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Agent to set targets for.' },
      targetActiveUsers: { type: 'number', description: 'Target number of active users. Defaults to 10.' },
      targetCallsPerDay: { type: 'number', description: 'Target daily tool calls. Defaults to 50.' },
      targetAdoptionRate: { type: 'number', description: 'Target adoption rate (0-1). Defaults to 0.8.' },
    },
    required: ['agentName'],
  },
};

export const setAdoptionTargetsHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('set_adoption_targets')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'set_adoption_targets requires Pro tier or higher. Set DW_LICENSE_TIER=pro to enable.' }) }],
      isError: true,
    };
  }

  try {
    const agentName = args.agentName as string;
    const targetActiveUsers = (args.targetActiveUsers as number) ?? 10;
    const targetCallsPerDay = (args.targetCallsPerDay as number) ?? 50;
    const targetAdoptionRate = (args.targetAdoptionRate as number) ?? 0.8;

    if (!agentName) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'agentName is required' }) }],
        isError: true,
      };
    }

    const target = {
      agentName,
      targetActiveUsers,
      targetCallsPerDay,
      targetAdoptionRate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await kvStore.set(`adoption_target:${agentName}`, JSON.stringify(target));

    return {
      content: [{ type: 'text', text: JSON.stringify({ ...target, status: 'target_set' }, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
