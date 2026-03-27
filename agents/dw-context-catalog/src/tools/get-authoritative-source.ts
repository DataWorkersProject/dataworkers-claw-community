/**
 * get_authoritative_source — Look up the authoritative source for a domain.
 * Community/read tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { kvStore } from '../backends.js';

export const getAuthoritativeSourceDefinition: ToolDefinition = {
  name: 'get_authoritative_source',
  description:
    'Look up the designated authoritative (canonical) source for a given domain or metric. ' +
    'Returns the asset ID, authority level, trust flag, and designation metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'Domain or concept to look up (e.g., "revenue", "customer_count").' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
    },
    required: ['domain'],
  },
};

export const getAuthoritativeSourceHandler: ToolHandler = async (args) => {
  const domain = args.domain as string;
  const customerId = (args.customerId as string) || 'cust-1';

  const key = `authority:${customerId}:${domain}`;
  const raw = await kvStore.get(key);

  if (!raw) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          domain,
          found: false,
          message: `No authoritative source designated for '${domain}'.`,
        }, null, 2),
      }],
    };
  }

  const record = JSON.parse(raw);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        domain,
        found: true,
        ...record,
      }, null, 2),
    }],
  };
};
