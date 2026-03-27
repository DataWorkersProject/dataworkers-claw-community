/**
 * AWS Glue MCP tools — list databases, list tables, get table, search tables.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { glue } from '../backends.js';

// ── list_glue_databases ──────────────────────────────────────────────

export const listGlueDatabasesDefinition: ToolDefinition = {
  name: 'list_glue_databases',
  description: 'List all databases in AWS Glue Data Catalog.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listGlueDatabasesHandler: ToolHandler = async (_args) => {
  try {
    const databases = glue.listDatabases();
    return { content: [{ type: 'text', text: JSON.stringify(databases, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_glue_tables ─────────────────────────────────────────────────

export const listGlueTablesDefinition: ToolDefinition = {
  name: 'list_glue_tables',
  description: 'List all tables in an AWS Glue database.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      database: { type: 'string', description: 'Glue database name.' },
    },
    required: ['customerId', 'database'],
  },
};

export const listGlueTablesHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  try {
    const tables = glue.listTables(database);
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_glue_table ───────────────────────────────────────────────────

export const getGlueTableDefinition: ToolDefinition = {
  name: 'get_glue_table',
  description: 'Get detailed metadata for a specific AWS Glue table.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      database: { type: 'string', description: 'Glue database name.' },
      table: { type: 'string', description: 'Table name.' },
    },
    required: ['customerId', 'database', 'table'],
  },
};

export const getGlueTableHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  const table = args.table as string;
  try {
    const result = glue.getGlueTable(database, table);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── search_glue_tables ──────────────────────────────────────────────

export const searchGlueTablesDefinition: ToolDefinition = {
  name: 'search_glue_tables',
  description: 'Search for tables across AWS Glue databases by name or column.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      query: { type: 'string', description: 'Search query string.' },
    },
    required: ['customerId', 'query'],
  },
};

export const searchGlueTablesHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  try {
    const results = glue.searchTables(query);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
