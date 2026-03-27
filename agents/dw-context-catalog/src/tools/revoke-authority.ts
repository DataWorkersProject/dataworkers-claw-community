/**
 * revoke_authority — Revoke the authoritative designation for a domain.
 * Pro/write tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { kvStore } from '../backends.js';

export const revokeAuthorityDefinition: ToolDefinition = {
  name: 'revoke_authority',
  description:
    'Revoke the authoritative source designation for a given domain. ' +
    'The asset is no longer considered the canonical source. Pro tier required.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'Domain or concept to revoke authority for.' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      reason: { type: 'string', description: 'Reason for revoking authority.' },
    },
    required: ['domain'],
  },
};

export const revokeAuthorityHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('revoke_authority')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'revoke_authority' }) }],
      isError: true,
    };
  }

  const domain = args.domain as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const reason = (args.reason as string) || '';

  const key = `authority:${customerId}:${domain}`;
  const existed = await kvStore.exists(key);
  await kvStore.delete(key);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        domain,
        previouslyDesignated: existed,
        reason,
        message: existed
          ? `Authority for '${domain}' has been revoked.`
          : `No authority designation existed for '${domain}'.`,
      }, null, 2),
    }],
  };
};
