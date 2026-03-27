/**
 * get_cost_enrichment — Cost enrichment via dw-cost message bus request/reply.
 *
 * Requests cost data from dw-cost agent to enrich usage analysis with dollar amounts.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { messageBus } from '../backends.js';

export const getCostEnrichmentDefinition: ToolDefinition = {
  name: 'get_cost_enrichment',
  description:
    'Enrich usage data with cost information from the dw-cost agent. Adds dollar-amount context to usage metrics via message bus request/reply.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Agent to get cost data for. Omit for all agents.' },
      period: { type: 'string', description: '"7d", "30d". Defaults to "7d".' },
    },
    required: [],
  },
};

export const getCostEnrichmentHandler: ToolHandler = async (args) => {
  const agentName = args.agentName as string | undefined;
  const period = (args.period as string) ?? '7d';

  try {
    const response = await messageBus.request(
      'dw-cost.get_cost_report',
      { agentName, period, source: 'dw-usage-intelligence' },
      500,
    );

    return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          available: false,
          message: `Cost agent not reachable: ${message}`,
          agentName: agentName ?? 'all',
          period,
        }, null, 2),
      }],
    };
  }
};
