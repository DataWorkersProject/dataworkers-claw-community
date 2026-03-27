/**
 * Databricks MCP tools — list catalogs, list tables, get table, get query history.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { databricks } from '../backends.js';

// ── list_databricks_catalogs ────────────────────────────────────────

export const listDatabricksCatalogsDefinition: ToolDefinition = {
  name: 'list_databricks_catalogs',
  description: 'List all Unity Catalog catalogs in Databricks.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listDatabricksCatalogsHandler: ToolHandler = async (_args) => {
  try {
    const catalogs = databricks.listCatalogs();
    return { content: [{ type: 'text', text: JSON.stringify(catalogs, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_databricks_tables ──────────────────────────────────────────

export const listDatabricksTablesDefinition: ToolDefinition = {
  name: 'list_databricks_tables',
  description: 'List all tables across all schemas in a Databricks catalog.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      catalog: { type: 'string', description: 'Catalog name.' },
    },
    required: ['customerId', 'catalog'],
  },
};

export const listDatabricksTablesHandler: ToolHandler = async (args) => {
  const catalog = args.catalog as string;

  try {
    const tables = databricks.listTables(catalog);
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_databricks_table ────────────────────────────────────────────

export const getDatabricksTableDefinition: ToolDefinition = {
  name: 'get_databricks_table',
  description: 'Get detailed information for a specific Databricks table.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      catalog: { type: 'string', description: 'Catalog name.' },
      schema: { type: 'string', description: 'Schema name.' },
      table: { type: 'string', description: 'Table name.' },
    },
    required: ['customerId', 'catalog', 'schema', 'table'],
  },
};

export const getDatabricksTableHandler: ToolHandler = async (args) => {
  const catalog = args.catalog as string;
  const schema = args.schema as string;
  const table = args.table as string;

  try {
    const result = databricks.getTable(catalog, schema, table);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_databricks_query_history ────────────────────────────────────

export const getDatabricksQueryHistoryDefinition: ToolDefinition = {
  name: 'get_databricks_query_history',
  description: 'Get recent query history from Databricks.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      limit: { type: 'number', description: 'Maximum number of queries to return.' },
    },
    required: ['customerId'],
  },
};

export const getDatabricksQueryHistoryHandler: ToolHandler = async (args) => {
  const limit = args.limit as number | undefined;

  try {
    const history = databricks.getQueryHistory(limit);
    return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
