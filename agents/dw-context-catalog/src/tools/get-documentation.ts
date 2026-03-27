import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { DocumentationGenerator } from '../search/documentation-generator.js';

const docGenerator = new DocumentationGenerator();

export const getDocumentationDefinition: ToolDefinition = {
  name: 'get_documentation',
  description: 'Get auto-generated documentation for a data asset including description, column details, lineage summary, usage stats, and quality score.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Asset ID or name.' },
      customerId: { type: 'string' },
    },
    required: ['assetId', 'customerId'],
  },
};

export const getDocumentationHandler: ToolHandler = async (args) => {
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = args.customerId as string;

  const doc = await docGenerator.generateDocumentation(assetId, customerId);

  return { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] };
};
