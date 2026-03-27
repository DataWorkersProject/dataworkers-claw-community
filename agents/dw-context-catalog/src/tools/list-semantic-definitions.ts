import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { metricStore } from '../backends.js';

export const listSemanticDefinitionsDefinition: ToolDefinition = {
  name: 'list_semantic_definitions',
  description: 'List all semantic layer definitions (metrics, dimensions, entities). Supports filtering by domain, type, and source.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      domain: { type: 'string', description: 'Filter by domain (finance, product, marketing).' },
      type: { type: 'string', enum: ['metric', 'dimension', 'entity'] },
      source: { type: 'string', enum: ['dbt', 'looker', 'cube', 'custom'] },
      limit: { type: 'number', description: 'Max results to return. Default: 50.' },
      offset: { type: 'number', description: 'Number of results to skip for pagination. Default: 0.' },
    },
    required: ['customerId'],
  },
};

export const listSemanticDefinitionsHandler: ToolHandler = async (args) => {
  const customerId = args.customerId as string;
  const domain = args.domain as string | undefined;
  const type = args.type as string | undefined;
  const source = args.source as string | undefined;
  const limit = (args.limit as number) ?? 50;
  const offset = (args.offset as number) ?? 0;

  const result = metricStore.listDefinitions(customerId, { domain, type, source, limit, offset });

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
};
