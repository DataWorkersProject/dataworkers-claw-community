/**
 * Azure Purview MCP tools — search entities, get entity, get lineage, list glossary.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { purview } from '../backends.js';

// ── search_purview_entities ────────────────────────────────────────

export const searchPurviewEntitiesDefinition: ToolDefinition = {
  name: 'search_purview_entities',
  description: 'Search for entities in Azure Purview by name, type, or classification.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      query: { type: 'string', description: 'Search query string.' },
    },
    required: ['customerId', 'query'],
  },
};

export const searchPurviewEntitiesHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  try {
    const result = purview.searchEntities(query);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_purview_entity ─────────────────────────────────────────────

export const getPurviewEntityDefinition: ToolDefinition = {
  name: 'get_purview_entity',
  description: 'Get detailed metadata for a specific Azure Purview entity by GUID.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      guid: { type: 'string', description: 'Entity GUID.' },
    },
    required: ['customerId', 'guid'],
  },
};

export const getPurviewEntityHandler: ToolHandler = async (args) => {
  const guid = args.guid as string;
  try {
    const result = purview.getEntity(guid);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_purview_lineage ────────────────────────────────────────────

export const getPurviewLineageDefinition: ToolDefinition = {
  name: 'get_purview_lineage',
  description: 'Get lineage information for an Azure Purview entity.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      guid: { type: 'string', description: 'Entity GUID.' },
    },
    required: ['customerId', 'guid'],
  },
};

export const getPurviewLineageHandler: ToolHandler = async (args) => {
  const guid = args.guid as string;
  try {
    const result = purview.getPurviewLineage(guid);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_purview_glossary ──────────────────────────────────────────

export const listPurviewGlossaryDefinition: ToolDefinition = {
  name: 'list_purview_glossary',
  description: 'List all glossary terms in Azure Purview.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listPurviewGlossaryHandler: ToolHandler = async (_args) => {
  try {
    const terms = purview.listGlossaryTerms();
    return { content: [{ type: 'text', text: JSON.stringify(terms, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
