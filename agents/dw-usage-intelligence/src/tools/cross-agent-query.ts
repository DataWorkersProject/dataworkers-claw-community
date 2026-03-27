/**
 * cross_agent_query — Wire IMessageBus.request() for cross-agent queries.
 *
 * Sends a request to another agent via the message bus and returns the response.
 * Enables cross-agent data correlation without direct coupling.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { messageBus } from '../backends.js';

export const crossAgentQueryDefinition: ToolDefinition = {
  name: 'cross_agent_query',
  description:
    'Query another agent via the message bus request/reply pattern. Enables cross-agent data correlation for usage analysis enrichment.',
  inputSchema: {
    type: 'object',
    properties: {
      targetAgent: { type: 'string', description: 'Target agent name (e.g. "dw-cost", "dw-incidents").' },
      queryType: { type: 'string', description: 'Query type (e.g. "get_summary", "get_status").' },
      payload: { type: 'object', description: 'Query payload to send.' },
      timeoutMs: { type: 'number', description: 'Timeout in milliseconds. Defaults to 5000.' },
    },
    required: ['targetAgent', 'queryType'],
  },
};

export const crossAgentQueryHandler: ToolHandler = async (args) => {
  const targetAgent = args.targetAgent as string;
  const queryType = args.queryType as string;
  const payload = (args.payload as Record<string, unknown>) ?? {};
  const timeoutMs = (args.timeoutMs as number) ?? 5000;

  try {
    const topic = `${targetAgent}.${queryType}`;
    const response = await messageBus.request(
      topic,
      { ...payload, source: 'dw-usage-intelligence', queryType },
      timeoutMs,
    );

    return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message, targetAgent, queryType }) }],
      isError: true,
    };
  }
};
