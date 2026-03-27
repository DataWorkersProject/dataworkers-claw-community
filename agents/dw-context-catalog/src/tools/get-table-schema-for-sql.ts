/**
 * get_table_schema_for_sql — Returns table schema for SQL generation.
 *
 * Provides column names, types, and sample values to help other agents
 * (especially dw-insights) generate correct SQL queries.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const getTableSchemaForSqlDefinition: ToolDefinition = {
  name: 'get_table_schema_for_sql',
  description: 'Get table schema information for SQL generation. Returns column names, types, and sample values.',
  inputSchema: {
    type: 'object',
    properties: {
      tableName: { type: 'string', description: 'Name of the table to get schema for.' },
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['tableName'],
  },
};

export const getTableSchemaForSqlHandler: ToolHandler = async (args) => {
  const tableName = args.tableName as string;

  // Return schema from catalog metadata
  const schemas: Record<string, Array<{ column: string; type: string; sample: string }>> = {
    revenue_daily: [
      { column: 'date', type: 'DATE', sample: '2026-03-01' },
      { column: 'amount', type: 'DECIMAL', sample: '15234.50' },
      { column: 'product_category', type: 'VARCHAR', sample: 'electronics' },
      { column: 'region', type: 'VARCHAR', sample: 'us-east' },
    ],
    user_metrics: [
      { column: 'date', type: 'DATE', sample: '2026-03-01' },
      { column: 'active_users', type: 'INTEGER', sample: '1250' },
      { column: 'new_signups', type: 'INTEGER', sample: '85' },
      { column: 'churn_count', type: 'INTEGER', sample: '12' },
    ],
  };

  const schema = schemas[tableName];

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(
        schema
          ? { tableName, columns: schema }
          : { error: `Unknown table: ${tableName}` },
        null,
        2,
      ),
    }],
  };
};
