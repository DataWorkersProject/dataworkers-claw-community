/**
 * provision_access — Process an access request with least-privilege enforcement.
 *
 * Updated to use the rewritten AccessProvisioningEngine from backends
 * with policy-gated responses. Logs to activity log.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import type { AccessRequest } from '../types.js';
import { accessProvisioningEngine, logActivity } from '../backends.js';

export const provisionAccessDefinition: ToolDefinition = {
  name: 'provision_access',
  description: 'Process an access request with least-privilege enforcement. Supports natural language requests. Applies column-level permissions, 90-day auto-expiration.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      resource: { type: 'string' },
      accessLevel: { type: 'string', enum: ['read', 'write', 'admin'] },
      justification: { type: 'string', description: 'NL justification for access.' },
      durationDays: { type: 'number', description: 'Access duration in days. Default: 90.' },
      customerId: { type: 'string' },
    },
    required: ['userId', 'resource', 'accessLevel', 'justification', 'customerId'],
  },
};

export const provisionAccessHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('provision_access')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: 'provision_access' }) }],
      isError: true,
    };
  }

  const request: AccessRequest = {
    userId: args.userId as string,
    resource: args.resource as string,
    accessLevel: args.accessLevel as AccessRequest['accessLevel'],
    justification: args.justification as string,
    customerId: args.customerId as string,
    duration: ((args.durationDays as number) ?? 90) * 86400000,
  };

  const result = await accessProvisioningEngine.provision(request);

  // Log to activity log
  await logActivity({
    customerId: request.customerId,
    action: 'access_grant',
    actor: 'dw-governance',
    resource: request.resource,
    result: `granted ${request.accessLevel} to ${request.userId}`,
  });

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
};
