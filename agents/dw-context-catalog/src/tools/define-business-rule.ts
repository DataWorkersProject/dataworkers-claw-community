/**
 * define_business_rule — Create a new business rule for a data asset.
 * Pro/write tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { businessRuleStore } from '../backends.js';
import type { BusinessRuleRecord } from '@data-workers/infrastructure-stubs';
import { randomUUID } from 'node:crypto';

export const defineBusinessRuleDefinition: ToolDefinition = {
  name: 'define_business_rule',
  description:
    'Define a new business rule for a data asset or column. Business rules capture tribal knowledge, ' +
    'calculation logic, freshness expectations, and domain-specific constraints. Pro tier required.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'ID or name of the data asset this rule applies to.' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      columnName: { type: 'string', description: 'Optional column name if the rule is column-specific.' },
      ruleType: {
        type: 'string',
        enum: ['calculation', 'definition', 'freshness', 'constraint', 'domain', 'tribal_knowledge'],
        description: 'Type of business rule.',
      },
      content: { type: 'string', description: 'The rule content in natural language.' },
      author: { type: 'string', description: 'Author or team that defined this rule.' },
      confidence: { type: 'number', description: 'Confidence score 0-1. Default 0.8.' },
      source: { type: 'string', description: 'Source of this rule (e.g. documentation, tribal_knowledge, runbook).' },
      conditions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            operator: { type: 'string' },
            value: {},
          },
        },
        description: 'Applicability conditions for when this rule applies.',
      },
    },
    required: ['assetId', 'ruleType', 'content'],
  },
};

export const defineBusinessRuleHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('define_business_rule')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'define_business_rule' }) }],
      isError: true,
    };
  }

  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const columnName = args.columnName as string | undefined;
  const ruleType = args.ruleType as string;
  const content = args.content as string;
  const author = (args.author as string) || 'unknown';
  const confidence = (args.confidence as number) ?? 0.8;
  const source = (args.source as string) || 'manual';
  const conditions = (args.conditions as Array<{ field?: string; operator?: string; value?: unknown }>) || [];

  const rule: BusinessRuleRecord = {
    id: `rule-${randomUUID().slice(0, 8)}`,
    customerId,
    assetId,
    columnName,
    ruleType,
    content,
    author,
    confidence,
    source,
    conditions,
    createdAt: Date.now(),
    lastConfirmedAt: Date.now(),
    deprecated: false,
  };

  await businessRuleStore.addRule(rule);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        ruleId: rule.id,
        assetId,
        ruleType,
        content,
        author,
        message: `Business rule '${rule.id}' created for asset '${assetId}'.`,
      }, null, 2),
    }],
  };
};
