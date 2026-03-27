/**
 * get_metering_summary — Integrate with @data-workers/metering.
 *
 * Consumes metering events for credit tracking and usage cost correlation.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { messageBus } from '../backends.js';

export const getMeteringSummaryDefinition: ToolDefinition = {
  name: 'get_metering_summary',
  description:
    'Retrieve metering/credit usage summary via message bus request to the metering service. Shows credit consumption by agent and tool.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer ID to query. Defaults to "system".' },
      period: { type: 'string', description: '"1d", "7d", "30d". Defaults to "7d".' },
    },
    required: [],
  },
};

export const getMeteringSummaryHandler: ToolHandler = async (args) => {
  const customerId = (args.customerId as string) ?? 'system';
  const period = (args.period as string) ?? '7d';

  try {
    const response = await messageBus.request(
      'metering.get_usage',
      { customerId, period, source: 'dw-usage-intelligence' },
      500,
    );

    return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
  } catch (err) {
    // Graceful fallback when metering service is not available
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          available: false,
          message: `Metering service not reachable: ${message}`,
          customerId,
          period,
        }, null, 2),
      }],
    };
  }
};
