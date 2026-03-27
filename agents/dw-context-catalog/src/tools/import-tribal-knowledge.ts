/**
 * import_tribal_knowledge — Bulk import tribal knowledge as business rules.
 * Pro/write tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { businessRuleStore } from '../backends.js';
import type { BusinessRuleRecord } from '@data-workers/infrastructure-stubs';
import { randomUUID } from 'node:crypto';

export const importTribalKnowledgeDefinition: ToolDefinition = {
  name: 'import_tribal_knowledge',
  description:
    'Bulk import tribal knowledge entries as business rules. Accepts an array of knowledge items ' +
    'with asset mappings and converts them into structured business rules. Pro tier required.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      author: { type: 'string', description: 'Author or team importing this knowledge.' },
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            assetId: { type: 'string', description: 'Target asset ID.' },
            columnName: { type: 'string', description: 'Optional column name.' },
            content: { type: 'string', description: 'The tribal knowledge content.' },
            ruleType: { type: 'string', description: 'Rule type. Defaults to tribal_knowledge.' },
            confidence: { type: 'number', description: 'Confidence 0-1. Default 0.7.' },
          },
          required: ['assetId', 'content'],
        },
        description: 'Array of knowledge entries to import.',
      },
    },
    required: ['entries'],
  },
};

export const importTribalKnowledgeHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('import_tribal_knowledge')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: 'import_tribal_knowledge' }) }],
      isError: true,
    };
  }

  const customerId = (args.customerId as string) || 'cust-1';
  const author = (args.author as string) || 'import';
  const entries = args.entries as Array<{
    assetId: string;
    columnName?: string;
    content: string;
    ruleType?: string;
    confidence?: number;
  }>;

  if (!entries || entries.length === 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'No entries provided for import.', imported: 0 }, null, 2),
      }],
      isError: true,
    };
  }

  const imported: string[] = [];
  for (const entry of entries) {
    const rule: BusinessRuleRecord = {
      id: `rule-${randomUUID().slice(0, 8)}`,
      customerId,
      assetId: entry.assetId,
      columnName: entry.columnName,
      ruleType: entry.ruleType || 'tribal_knowledge',
      content: entry.content,
      author,
      confidence: entry.confidence ?? 0.7,
      source: 'tribal_knowledge',
      conditions: [],
      createdAt: Date.now(),
      lastConfirmedAt: Date.now(),
      deprecated: false,
    };
    await businessRuleStore.addRule(rule);
    imported.push(rule.id);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        imported: imported.length,
        ruleIds: imported,
        message: `Imported ${imported.length} tribal knowledge entries as business rules.`,
      }, null, 2),
    }],
  };
};
