/**
 * enforce_rbac — Apply role-based access control to a resource.
 *
 * Updated to use the shared RbacEngine singleton from backends
 * with customerId wired for tenant isolation. Logs to activity log.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { rbacEngine, logActivity } from '../backends.js';

export const enforceRbacDefinition: ToolDefinition = {
  name: 'enforce_rbac',
  description: 'Apply role-based access control to a resource. Supports column-level permissions and role hierarchy.',
  inputSchema: {
    type: 'object',
    properties: {
      resource: { type: 'string' },
      userId: { type: 'string' },
      role: { type: 'string', description: 'Role to enforce (viewer, editor, admin, data_engineer, analyst).' },
      customerId: { type: 'string' },
      columnRestrictions: { type: 'array', items: { type: 'string' }, description: 'Columns to restrict access to.' },
    },
    required: ['resource', 'userId', 'role', 'customerId'],
  },
};

export const enforceRbacHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('enforce_rbac')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'enforce_rbac' }) }],
      isError: true,
    };
  }

  const resource = args.resource as string;
  const userId = args.userId as string;
  const role = args.role as string;
  const customerId = args.customerId as string;
  const columnRestrictions = (args.columnRestrictions as string[]) ?? [];

  const result = rbacEngine.enforce({ resource, userId, role, columnRestrictions, customerId });

  // Log to activity log
  await logActivity({
    customerId,
    action: 'rbac_enforce',
    actor: 'dw-governance',
    resource,
    result: `role=${role} applied to ${userId}`,
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
};
