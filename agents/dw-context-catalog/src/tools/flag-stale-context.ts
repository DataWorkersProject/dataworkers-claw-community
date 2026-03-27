/**
 * flag_stale_context — Flag stale context for an asset.
 * Pro/write tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { messageBus, contextFeedbackStore } from '../backends.js';
import type { ContextFeedbackRecord } from '@data-workers/infrastructure-stubs';
import { randomUUID } from 'node:crypto';

export const flagStaleContextDefinition: ToolDefinition = {
  name: 'flag_stale_context',
  description:
    'Flag that the context or documentation for a data asset is stale and needs review. ' +
    'Publishes a context.stale event and records feedback. Pro tier required.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'ID of the asset with stale context.' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      reason: { type: 'string', description: 'Why the context is considered stale.' },
      flaggedBy: { type: 'string', description: 'User or system flagging the staleness.' },
    },
    required: ['assetId'],
  },
};

export const flagStaleContextHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('flag_stale_context')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'flag_stale_context' }) }],
      isError: true,
    };
  }

  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const reason = (args.reason as string) || 'Context flagged as stale by user.';
  const flaggedBy = (args.flaggedBy as string) || 'unknown';

  // Record as feedback
  const feedback: ContextFeedbackRecord = {
    id: `fb-${randomUUID().slice(0, 8)}`,
    assetId,
    userId: flaggedBy,
    feedbackType: 'negative',
    content: `[stale_context] ${reason}`,
    timestamp: Date.now(),
  };
  await contextFeedbackStore.recordFeedback(feedback);

  // Publish event for cross-agent subscription
  await messageBus.publish('context.stale', {
    id: `ctx-stale-${Date.now()}`,
    type: 'context.stale',
    timestamp: Date.now(),
    customerId,
    payload: { assetId, source: 'dw-context-catalog', reason, flaggedBy },
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        feedbackId: feedback.id,
        assetId,
        reason,
        eventPublished: 'context.stale',
        message: `Stale context flagged for '${assetId}'. Event published to message bus.`,
      }, null, 2),
    }],
  };
};
