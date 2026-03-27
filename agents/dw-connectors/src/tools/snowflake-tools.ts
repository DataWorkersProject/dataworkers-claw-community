/**
 * Snowflake MCP tools — list databases, list tables, get DDL, get usage.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { snowflake } from '../backends.js';

// ── list_snowflake_databases ────────────────────────────────────────

export const listSnowflakeDatabasesDefinition: ToolDefinition = {
  name: 'list_snowflake_databases',
  description: 'List all databases in Snowflake warehouse.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listSnowflakeDatabasesHandler: ToolHandler = async (_args) => {
  try {
    const databases = snowflake.listDatabases();
    return { content: [{ type: 'text', text: JSON.stringify(databases, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_snowflake_tables ───────────────────────────────────────────

export const listSnowflakeTablesDefinition: ToolDefinition = {
  name: 'list_snowflake_tables',
  description: 'List all tables in a specific Snowflake database and schema.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      database: { type: 'string', description: 'Database name.' },
      schema: { type: 'string', description: 'Schema name.' },
    },
    required: ['customerId', 'database', 'schema'],
  },
};

export const listSnowflakeTablesHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  const schema = args.schema as string;

  try {
    const tables = snowflake.listTables(`${database}.${schema}`);
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_snowflake_table_ddl ─────────────────────────────────────────

export const getSnowflakeTableDdlDefinition: ToolDefinition = {
  name: 'get_snowflake_table_ddl',
  description: 'Get column definitions (DDL) for a specific Snowflake table.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      database: { type: 'string', description: 'Database name.' },
      schema: { type: 'string', description: 'Schema name.' },
      table: { type: 'string', description: 'Table name.' },
    },
    required: ['customerId', 'database', 'schema', 'table'],
  },
};

export const getSnowflakeTableDdlHandler: ToolHandler = async (args) => {
  const database = args.database as string;
  const schema = args.schema as string;
  const table = args.table as string;

  try {
    const ddl = snowflake.getTableDDL(database, schema, table);
    return { content: [{ type: 'text', text: JSON.stringify(ddl, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_snowflake_usage ─────────────────────────────────────────────

export const getSnowflakeUsageDefinition: ToolDefinition = {
  name: 'get_snowflake_usage',
  description: 'Get warehouse usage metrics from Snowflake.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const getSnowflakeUsageHandler: ToolHandler = async (_args) => {
  try {
    const usage = snowflake.queryWarehouseUsage();
    return { content: [{ type: 'text', text: JSON.stringify(usage, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
