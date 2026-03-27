/**
 * Unified Catalog MCP tools — list catalogs, search across catalogs, get table from any catalog.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { catalogRegistry } from '../backends.js';

// ── list_all_catalogs ───────────────────────────────────────────────

export const listAllCatalogsDefinition: ToolDefinition = {
  name: 'list_all_catalogs',
  description: 'List all registered catalog providers and their capabilities.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listAllCatalogsHandler: ToolHandler = async (_args) => {
  try {
    const providers = catalogRegistry.getAllProviders();
    const result = providers.map((p) => ({
      providerType: p.providerType,
      connectorType: p.connectorType,
      capabilities: p.capabilities,
    }));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── search_across_catalogs ──────────────────────────────────────────

export const searchAcrossCatalogsDefinition: ToolDefinition = {
  name: 'search_across_catalogs',
  description: 'Search tables across all catalog providers that support the search capability.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      query: { type: 'string', description: 'Search query for table names.' },
    },
    required: ['customerId', 'query'],
  },
};

export const searchAcrossCatalogsHandler: ToolHandler = async (args) => {
  const query = args.query as string;

  try {
    const providers = catalogRegistry.getProvidersByCapability('search');
    const results: Record<string, unknown> = {};

    for (const provider of providers) {
      if (provider.searchTables) {
        const tables = await provider.searchTables(query);
        results[provider.providerType] = tables;
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_table_from_any_catalog ──────────────────────────────────────

export const getTableFromAnyCatalogDefinition: ToolDefinition = {
  name: 'get_table_from_any_catalog',
  description: 'Get table metadata from a specific catalog provider.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      provider: { type: 'string', description: 'Provider type (e.g., snowflake, bigquery, dbt).' },
      namespace: { type: 'string', description: 'Namespace or schema identifier.' },
      table: { type: 'string', description: 'Table name.' },
    },
    required: ['customerId', 'provider', 'namespace', 'table'],
  },
};

export const getTableFromAnyCatalogHandler: ToolHandler = async (args) => {
  const providerType = args.provider as string;
  const namespace = args.namespace as string;
  const table = args.table as string;

  try {
    const provider = catalogRegistry.getProvider(providerType);
    if (!provider) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Provider not found: ${providerType}. Available: ${catalogRegistry.list().join(', ')}` }) }],
        isError: true,
      };
    }

    const metadata = await provider.getTableMetadata(namespace, table);
    return { content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
