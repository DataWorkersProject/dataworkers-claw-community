/**
 * query_rules — Query business rules for an asset or by search term.
 * Community/read tool.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { businessRuleStore } from '../backends.js';

export const queryRulesDefinition: ToolDefinition = {
  name: 'query_rules',
  description:
    'Query business rules for a specific data asset or search across all rules. ' +
    'Returns matching rules with their content, type, confidence, and applicability conditions.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Filter rules for a specific asset ID.' },
      query: { type: 'string', description: 'Free-text search across all rules.' },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
    },
  },
};

export const queryRulesHandler: ToolHandler = async (args) => {
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string | undefined;
  const query = args.query as string | undefined;
  const customerId = (args.customerId as string) || 'cust-1';

  let rules;
  if (assetId) {
    rules = await businessRuleStore.getRulesForAsset(assetId, customerId);
  } else if (query) {
    rules = await businessRuleStore.searchRules(query, customerId);
  } else {
    // Return all non-deprecated rules for the customer
    rules = await businessRuleStore.searchRules('', customerId);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        rules,
        count: rules.length,
        query: query || undefined,
        assetId: assetId || undefined,
      }, null, 2),
    }],
  };
};
