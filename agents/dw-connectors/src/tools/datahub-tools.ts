/**
 * DataHub MCP tools — search datasets, get dataset, get lineage, list domains.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { datahub } from '../backends.js';

// ── search_datahub_datasets ────────────────────────────────────────

export const searchDatahubDatasetsDefinition: ToolDefinition = {
  name: 'search_datahub_datasets',
  description: 'Search for datasets in DataHub by name, platform, or tag.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      query: { type: 'string', description: 'Search query string.' },
    },
    required: ['customerId', 'query'],
  },
};

export const searchDatahubDatasetsHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  try {
    const results = datahub.searchDatasets(query);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_datahub_dataset ────────────────────────────────────────────

export const getDatahubDatasetDefinition: ToolDefinition = {
  name: 'get_datahub_dataset',
  description: 'Get detailed metadata for a specific DataHub dataset by URN.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      urn: { type: 'string', description: 'Dataset URN.' },
    },
    required: ['customerId', 'urn'],
  },
};

export const getDatahubDatasetHandler: ToolHandler = async (args) => {
  const urn = args.urn as string;
  try {
    const result = datahub.getDataset(urn);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_datahub_lineage ────────────────────────────────────────────

export const getDatahubLineageDefinition: ToolDefinition = {
  name: 'get_datahub_lineage',
  description: 'Get lineage (upstream or downstream) for a DataHub dataset.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      urn: { type: 'string', description: 'Dataset URN.' },
      direction: { type: 'string', description: 'Lineage direction: upstream or downstream.' },
    },
    required: ['customerId', 'urn', 'direction'],
  },
};

export const getDatahubLineageHandler: ToolHandler = async (args) => {
  const urn = args.urn as string;
  const direction = args.direction as 'upstream' | 'downstream';
  try {
    const result = datahub.getDataHubLineage(urn, direction);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_datahub_domains ───────────────────────────────────────────

export const listDatahubDomainsDefinition: ToolDefinition = {
  name: 'list_datahub_domains',
  description: 'List all domains in DataHub.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listDatahubDomainsHandler: ToolHandler = async (_args) => {
  try {
    const domains = datahub.listDomains();
    return { content: [{ type: 'text', text: JSON.stringify(domains, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
