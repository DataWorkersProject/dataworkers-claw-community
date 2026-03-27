/**
 * AWS Lake Formation MCP tools — list permissions, list tags, search by tags.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { glue } from '../backends.js';

// ── list_lf_permissions ────────────────────────────────────────────

export const listLfPermissionsDefinition: ToolDefinition = {
  name: 'list_lf_permissions',
  description: 'List Lake Formation permissions for a resource (database or table).',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      resource: { type: 'string', description: 'Resource identifier (e.g. "analytics_db" or "analytics_db.user_events").' },
    },
    required: ['customerId', 'resource'],
  },
};

export const listLfPermissionsHandler: ToolHandler = async (args) => {
  const resource = args.resource as string;
  try {
    const permissions = glue.getLFPermissions(resource);
    return { content: [{ type: 'text', text: JSON.stringify(permissions, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_lf_tags ───────────────────────────────────────────────────

export const listLfTagsDefinition: ToolDefinition = {
  name: 'list_lf_tags',
  description: 'List Lake Formation tags for a resource.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      resource: { type: 'string', description: 'Resource identifier (e.g. "analytics_db" or "analytics_db.user_events").' },
    },
    required: ['customerId', 'resource'],
  },
};

export const listLfTagsHandler: ToolHandler = async (args) => {
  const resource = args.resource as string;
  try {
    const tags = glue.getLFTags(resource);
    return { content: [{ type: 'text', text: JSON.stringify(tags, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── search_lf_by_tags ──────────────────────────────────────────────

export const searchLfByTagsDefinition: ToolDefinition = {
  name: 'search_lf_by_tags',
  description: 'Search for resources by Lake Formation tag values.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tag values to search for.' },
    },
    required: ['customerId', 'tags'],
  },
};

export const searchLfByTagsHandler: ToolHandler = async (args) => {
  const tags = args.tags as string[];
  try {
    const results = glue.searchByTags(tags);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
