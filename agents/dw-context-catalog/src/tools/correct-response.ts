/**
 * correct_response — Submit a correction to context or documentation.
 * Community read / Pro write tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { contextFeedbackStore } from '../backends.js';
import type { ContextFeedbackRecord } from '@data-workers/infrastructure-stubs';
import { randomUUID } from 'node:crypto';

export const correctResponseDefinition: ToolDefinition = {
  name: 'correct_response',
  description:
    'Submit a correction to documentation or context for a data asset. Corrections are recorded ' +
    'as feedback and can trigger re-evaluation of documentation quality.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'ID of the asset being corrected.' },
      userId: { type: 'string', description: 'User submitting the correction.' },
      correction: { type: 'string', description: 'The correction content.' },
      fieldCorrected: { type: 'string', description: 'Which field is being corrected (e.g., description, column_info).' },
    },
    required: ['assetId', 'correction'],
  },
};

export const correctResponseHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('correct_response')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'correct_response' }) }],
      isError: true,
    };
  }

  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const userId = (args.userId as string) || 'anonymous';
  const correction = args.correction as string;
  const fieldCorrected = (args.fieldCorrected as string) || 'general';

  const feedback: ContextFeedbackRecord = {
    id: `fb-${randomUUID().slice(0, 8)}`,
    assetId,
    userId,
    feedbackType: 'correction',
    content: `[${fieldCorrected}] ${correction}`,
    timestamp: Date.now(),
  };

  await contextFeedbackStore.recordFeedback(feedback);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        feedbackId: feedback.id,
        assetId,
        fieldCorrected,
        message: `Correction recorded for '${assetId}'. Feedback ID: ${feedback.id}.`,
      }, null, 2),
    }],
  };
};
