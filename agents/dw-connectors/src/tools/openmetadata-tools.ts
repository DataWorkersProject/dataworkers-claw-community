/**
 * OpenMetadata MCP tools — list tables, get table, search tables, get lineage, get quality tests.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { openmetadata } from '../backends.js';

// ── list_om_tables ───────────────────────────────────────────────────

export const listOmTablesDefinition: ToolDefinition = {
  name: 'list_om_tables',
  description: 'List all tables in an OpenMetadata database.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      database: { type: 'string', description: 'Database name.' },
    },
    required: ['customerId', 'database'],
  },
};

export const listOmTablesHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  try {
    const tables = openmetadata.listTables(database);
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_om_table ─────────────────────────────────────────────────────

export const getOmTableDefinition: ToolDefinition = {
  name: 'get_om_table',
  description: 'Get detailed metadata for an OpenMetadata table by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      tableId: { type: 'string', description: 'OpenMetadata table ID.' },
    },
    required: ['customerId', 'tableId'],
  },
};

export const getOmTableHandler: ToolHandler = async (args) => {
  const tableId = args.tableId as string;
  try {
    const table = openmetadata.getOMTable(tableId);
    return { content: [{ type: 'text', text: JSON.stringify(table, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── search_om_tables ─────────────────────────────────────────────────

export const searchOmTablesDefinition: ToolDefinition = {
  name: 'search_om_tables',
  description: 'Search for tables across OpenMetadata by name or column.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      query: { type: 'string', description: 'Search query string.' },
    },
    required: ['customerId', 'query'],
  },
};

export const searchOmTablesHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  try {
    const results = openmetadata.searchTables(query);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_om_lineage ──────────────────────────────────────────────────

export const getOmLineageDefinition: ToolDefinition = {
  name: 'get_om_lineage',
  description: 'Get data lineage for an OpenMetadata table.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      tableId: { type: 'string', description: 'OpenMetadata table ID.' },
      direction: { type: 'string', description: 'Lineage direction: upstream or downstream.', enum: ['upstream', 'downstream'] },
    },
    required: ['customerId', 'tableId', 'direction'],
  },
};

export const getOmLineageHandler: ToolHandler = async (args) => {
  const tableId = args.tableId as string;
  const direction = args.direction as 'upstream' | 'downstream';
  try {
    const lineage = openmetadata.getLineage(tableId, direction);
    return { content: [{ type: 'text', text: JSON.stringify(lineage, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_om_quality_tests ─────────────────────────────────────────────

export const getOmQualityTestsDefinition: ToolDefinition = {
  name: 'get_om_quality_tests',
  description: 'Get data quality test results for an OpenMetadata table.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      tableId: { type: 'string', description: 'OpenMetadata table ID.' },
    },
    required: ['customerId', 'tableId'],
  },
};

export const getOmQualityTestsHandler: ToolHandler = async (args) => {
  const tableId = args.tableId as string;
  try {
    const tests = openmetadata.getQualityTests(tableId);
    return { content: [{ type: 'text', text: JSON.stringify(tests, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
