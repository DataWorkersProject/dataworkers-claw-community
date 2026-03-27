/**
 * Google Cloud Dataplex MCP tools — list lakes, list entities, get entity, search entries.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { dataplex } from '../backends.js';

// ── list_dataplex_lakes ────────────────────────────────────────────

export const listDataplexLakesDefinition: ToolDefinition = {
  name: 'list_dataplex_lakes',
  description: 'List all lakes in Google Cloud Dataplex.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listDataplexLakesHandler: ToolHandler = async (_args) => {
  try {
    const lakes = dataplex.listLakes();
    return { content: [{ type: 'text', text: JSON.stringify(lakes, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_dataplex_entities ─────────────────────────────────────────

export const listDataplexEntitiesDefinition: ToolDefinition = {
  name: 'list_dataplex_entities',
  description: 'List entities in a Dataplex zone.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      zone: { type: 'string', description: 'Fully qualified zone name.' },
    },
    required: ['customerId', 'zone'],
  },
};

export const listDataplexEntitiesHandler: ToolHandler = async (args) => {
  const zone = args.zone as string;
  try {
    const entities = dataplex.listEntities(zone);
    return { content: [{ type: 'text', text: JSON.stringify(entities, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_dataplex_entity ────────────────────────────────────────────

export const getDataplexEntityDefinition: ToolDefinition = {
  name: 'get_dataplex_entity',
  description: 'Get detailed metadata for a specific Dataplex entity.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      name: { type: 'string', description: 'Fully qualified entity name.' },
    },
    required: ['customerId', 'name'],
  },
};

export const getDataplexEntityHandler: ToolHandler = async (args) => {
  const name = args.name as string;
  try {
    const entity = dataplex.getEntity(name);
    return { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── search_dataplex_entries ────────────────────────────────────────

export const searchDataplexEntriesDefinition: ToolDefinition = {
  name: 'search_dataplex_entries',
  description: 'Search for entries in Google Cloud Dataplex.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      query: { type: 'string', description: 'Search query string.' },
    },
    required: ['customerId', 'query'],
  },
};

export const searchDataplexEntriesHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  try {
    const results = dataplex.searchEntries(query);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
