/**
 * request_governance_review — Request a manual governance review.
 *
 * Creates a governance review request that can be tracked and resolved.
 * Useful when automated policy checks result in 'review' action.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { GovernanceReviewRequest } from '../types.js';
import { relationalStore } from '../backends.js';

export const requestGovernanceReviewDefinition: ToolDefinition = {
  name: 'request_governance_review',
  description:
    'Request a manual governance review for an action that requires human approval. Returns a review request ID for tracking.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      requestedBy: { type: 'string', description: 'Agent or user requesting the review.' },
      resource: { type: 'string', description: 'Resource requiring review.' },
      action: { type: 'string', description: 'Action requiring review.' },
      reason: { type: 'string', description: 'Reason for the review request.' },
    },
    required: ['customerId', 'requestedBy', 'resource', 'action', 'reason'],
  },
};

export const requestGovernanceReviewHandler: ToolHandler = async (args) => {
  const customerId = args.customerId as string;
  const requestedBy = args.requestedBy as string;
  const resource = args.resource as string;
  const action = args.action as string;
  const reason = args.reason as string;

  try {
    const review: GovernanceReviewRequest = {
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerId,
      requestedBy,
      resource,
      action,
      reason,
      status: 'pending',
      createdAt: Date.now(),
    };

    // Persist the review request
    await relationalStore.insert('governance_reviews', {
      ...review,
    } as unknown as Record<string, unknown>);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          reviewId: review.id,
          status: review.status,
          message: `Governance review requested for ${action} on ${resource}`,
          review,
        }, null, 2),
      }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
