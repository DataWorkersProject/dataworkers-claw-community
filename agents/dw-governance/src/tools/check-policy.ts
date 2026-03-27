/**
 * check_policy — Evaluate an action against governance policies stored
 * in the relational policy store (simulating PostgreSQL).
 *
 * Policies are matched by action + resource glob pattern and resolved
 * by priority (highest wins). Dynamically added policies are enforced
 * immediately on the next evaluation.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { PolicyCheckResult } from '../types.js';
import { policyStore, logActivity } from '../backends.js';

export const checkPolicyDefinition: ToolDefinition = {
  name: 'check_policy',
  description:
    'Validate an action against active governance policies. Glob-pattern matching with priority-ordered evaluation (<100ms). Returns allow/deny/review decision with matched rules.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'Action to validate (read, write, delete, deploy, etc.)' },
      resource: { type: 'string', description: 'Resource being accessed.' },
      agentId: { type: 'string', description: 'Agent requesting the action.' },
      customerId: { type: 'string' },
      context: { type: 'object', description: 'Additional context (user, environment, data classification).' },
    },
    required: ['action', 'resource', 'agentId', 'customerId'],
  },
};

export const checkPolicyHandler: ToolHandler = async (args) => {
  const action = args.action as string;
  const resource = args.resource as string;
  const agentId = args.agentId as string;
  const customerId = args.customerId as string;
  const context = args.context as Record<string, unknown> | undefined;

  try {
    const start = Date.now();

    const evaluation = await policyStore.evaluateAccess(action, resource, agentId, customerId, context);

    const result: PolicyCheckResult = {
      allowed: evaluation.allowed,
      action: evaluation.action,
      matchedRules: evaluation.allMatched.map((p) => ({
        id: p.id,
        name: p.name,
        resource: p.resource,
        action: p.action,
        conditions: p.conditions as unknown as Record<string, unknown>,
        priority: p.priority,
      })),
      evaluationTimeMs: Date.now() - start,
      reason: evaluation.reason,
    };

    // Log policy check to activity log
    await logActivity({
      customerId,
      action: 'policy_check',
      actor: agentId,
      resource,
      result: `${evaluation.action}: ${evaluation.reason}`,
      policyRef: evaluation.matchedPolicy?.id,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
