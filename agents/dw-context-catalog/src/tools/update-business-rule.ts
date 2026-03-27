/**
 * update_business_rule — Update or deprecate an existing business rule.
 * Pro/write tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { businessRuleStore } from '../backends.js';

export const updateBusinessRuleDefinition: ToolDefinition = {
  name: 'update_business_rule',
  description:
    'Update an existing business rule\'s content, confidence, or deprecation status. Pro tier required.',
  inputSchema: {
    type: 'object',
    properties: {
      ruleId: { type: 'string', description: 'ID of the rule to update.' },
      content: { type: 'string', description: 'Updated rule content.' },
      confidence: { type: 'number', description: 'Updated confidence score 0-1.' },
      deprecated: { type: 'boolean', description: 'Set to true to deprecate the rule.' },
      author: { type: 'string', description: 'Author making the update.' },
    },
    required: ['ruleId'],
  },
};

export const updateBusinessRuleHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('update_business_rule')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'update_business_rule' }) }],
      isError: true,
    };
  }

  const ruleId = args.ruleId as string;
  const content = args.content as string | undefined;
  const confidence = args.confidence as number | undefined;
  const deprecated = args.deprecated as boolean | undefined;
  const author = args.author as string | undefined;

  if (deprecated === true) {
    const success = await businessRuleStore.deprecateRule(ruleId);
    if (!success) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Rule '${ruleId}' not found.` }, null, 2),
        }],
        isError: true,
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ruleId,
          deprecated: true,
          message: `Rule '${ruleId}' has been deprecated.`,
        }, null, 2),
      }],
    };
  }

  const updates: Record<string, unknown> = { lastConfirmedAt: Date.now() };
  if (content !== undefined) updates.content = content;
  if (confidence !== undefined) updates.confidence = confidence;
  if (author !== undefined) updates.author = author;

  const updated = await businessRuleStore.updateRule(ruleId, updates as any);
  if (!updated) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `Rule '${ruleId}' not found.` }, null, 2),
      }],
      isError: true,
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        ruleId,
        updated: updates,
        message: `Rule '${ruleId}' updated successfully.`,
      }, null, 2),
    }],
  };
};
