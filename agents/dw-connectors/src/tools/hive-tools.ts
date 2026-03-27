/**
 * Hive Metastore MCP tools — list databases, list tables, get table schema, get partitions.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { hiveMetastore } from '../backends.js';

// ── list_hive_databases ──────────────────────────────────────────────

export const listHiveDatabasesDefinition: ToolDefinition = {
  name: 'list_hive_databases',
  description: 'List all databases in Hive Metastore.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listHiveDatabasesHandler: ToolHandler = async (_args) => {
  try {
    const databases = hiveMetastore.listDatabases();
    return { content: [{ type: 'text', text: JSON.stringify(databases, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_hive_tables ─────────────────────────────────────────────────

export const listHiveTablesDefinition: ToolDefinition = {
  name: 'list_hive_tables',
  description: 'List all tables in a Hive Metastore database.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      database: { type: 'string', description: 'Hive database name.' },
    },
    required: ['customerId', 'database'],
  },
};

export const listHiveTablesHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  try {
    const tables = hiveMetastore.listTables(database);
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_hive_table_schema ────────────────────────────────────────────

export const getHiveTableSchemaDefinition: ToolDefinition = {
  name: 'get_hive_table_schema',
  description: 'Get schema and metadata for a specific Hive table.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      database: { type: 'string', description: 'Hive database name.' },
      table: { type: 'string', description: 'Table name.' },
    },
    required: ['customerId', 'database', 'table'],
  },
};

export const getHiveTableSchemaHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  const table = args.table as string;
  try {
    const result = hiveMetastore.getHiveTable(database, table);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_hive_partitions ──────────────────────────────────────────────

export const getHivePartitionsDefinition: ToolDefinition = {
  name: 'get_hive_partitions',
  description: 'Get partitions for a Hive table.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      database: { type: 'string', description: 'Hive database name.' },
      table: { type: 'string', description: 'Table name.' },
    },
    required: ['customerId', 'database', 'table'],
  },
};

export const getHivePartitionsHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  const table = args.table as string;
  try {
    const partitions = hiveMetastore.getPartitions(database, table);
    return { content: [{ type: 'text', text: JSON.stringify(partitions, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
