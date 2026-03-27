/**
 * BigQuery MCP tools — list datasets, list tables, get schema, estimate cost.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { bigquery } from '../backends.js';

// ── list_bigquery_datasets ──────────────────────────────────────────

export const listBigqueryDatasetsDefinition: ToolDefinition = {
  name: 'list_bigquery_datasets',
  description: 'List all datasets in a BigQuery project.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listBigqueryDatasetsHandler: ToolHandler = async (_args) => {
  try {
    const datasets = bigquery.listDatasets();
    return { content: [{ type: 'text', text: JSON.stringify(datasets, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_bigquery_tables ────────────────────────────────────────────

export const listBigqueryTablesDefinition: ToolDefinition = {
  name: 'list_bigquery_tables',
  description: 'List all tables in a specific BigQuery dataset.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      datasetId: { type: 'string', description: 'BigQuery dataset ID. Alias: dataset.' },
      dataset: { type: 'string', description: 'Alias for datasetId.' },
    },
    required: ['customerId', 'datasetId'],
  },
};

export const listBigqueryTablesHandler: ToolHandler = async (args) => {
  const datasetId = (args.datasetId ?? args.dataset) as string;

  try {
    const tables = bigquery.listTables(datasetId);
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_bigquery_table_schema ───────────────────────────────────────

export const getBigqueryTableSchemaDefinition: ToolDefinition = {
  name: 'get_bigquery_table_schema',
  description: 'Get the schema for a specific BigQuery table.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      datasetId: { type: 'string', description: 'BigQuery dataset ID.' },
      tableId: { type: 'string', description: 'BigQuery table ID.' },
    },
    required: ['customerId', 'datasetId', 'tableId'],
  },
};

export const getBigqueryTableSchemaHandler: ToolHandler = async (args) => {
  const datasetId = args.datasetId as string;
  const tableId = args.tableId as string;

  try {
    const schema = bigquery.getTableSchema(datasetId, tableId);
    return { content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── estimate_bigquery_cost ──────────────────────────────────────────

export const estimateBigqueryCostDefinition: ToolDefinition = {
  name: 'estimate_bigquery_cost',
  description: 'Estimate the cost of running a BigQuery query.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      queryText: { type: 'string', description: 'SQL query text to estimate cost for.' },
    },
    required: ['customerId', 'queryText'],
  },
};

export const estimateBigqueryCostHandler: ToolHandler = async (args) => {
  const queryText = args.queryText as string;

  try {
    const estimate = bigquery.estimateQueryCost(queryText);
    return { content: [{ type: 'text', text: JSON.stringify(estimate, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
