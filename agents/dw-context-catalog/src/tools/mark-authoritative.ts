/**
 * mark_authoritative — Mark a data asset as the authoritative source for a domain.
 * Pro/write tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { kvStore } from '../backends.js';
import type { AuthorityLevel, TrustFlag } from '../types.js';

export const markAuthoritativeDefinition: ToolDefinition = {
  name: 'mark_authoritative',
  description:
    'Mark a data asset as the authoritative (canonical) source for a given domain or metric. ' +
    'This helps resolve ambiguity when multiple datasets claim to represent the same concept. Pro tier required.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'ID of the asset to mark as authoritative.' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      domain: { type: 'string', description: 'Domain or concept this asset is authoritative for (e.g., "revenue", "customer_count").' },
      authorityLevel: {
        type: 'string',
        enum: ['canonical', 'authoritative', 'derived', 'deprecated'],
        description: 'Authority level. Default: authoritative.',
      },
      trustFlag: {
        type: 'string',
        enum: ['endorsed', 'warned', 'deprecated'],
        description: 'Trust flag for this designation. Default: endorsed.',
      },
      reason: { type: 'string', description: 'Reason for this authority designation.' },
      designatedBy: { type: 'string', description: 'User or team making this designation.' },
    },
    required: ['assetId', 'domain'],
  },
};

export const markAuthoritativeHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('mark_authoritative')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'mark_authoritative' }) }],
      isError: true,
    };
  }

  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const domain = args.domain as string;
  const authorityLevel = (args.authorityLevel as AuthorityLevel) || 'authoritative';
  const trustFlag = (args.trustFlag as TrustFlag) || 'endorsed';
  const reason = (args.reason as string) || '';
  const designatedBy = (args.designatedBy as string) || 'unknown';

  const key = `authority:${customerId}:${domain}`;
  const record = {
    assetId,
    customerId,
    domain,
    authorityLevel,
    trustFlag,
    reason,
    designatedBy,
    designatedAt: Date.now(),
  };

  await kvStore.set(key, JSON.stringify(record));

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        assetId,
        domain,
        authorityLevel,
        trustFlag,
        message: `Asset '${assetId}' marked as ${authorityLevel} source for '${domain}'.`,
      }, null, 2),
    }],
  };
};
