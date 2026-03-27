/**
 * get_schema_snapshot tool — retrieves the current schema snapshot for a table
 * from the cache or directly from the warehouse.
 *
 * New tool added in P3.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { warehouseConnector, kvStore } from '../backends.js';
import { SnapshotStore } from '../snapshot-store.js';

const snapshotStore = new SnapshotStore(kvStore, warehouseConnector);

export const getSchemaSnapshotDefinition: ToolDefinition = {
  name: 'get_schema_snapshot',
  description: 'Retrieve the current cached schema snapshot for a table. Returns column definitions including name, type, and nullable. Falls back to live warehouse query if no snapshot exists.',
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Data source (snowflake, bigquery, postgres, etc.)' },
      database: { type: 'string' },
      schema: { type: 'string' },
      table: { type: 'string', description: 'Table name to get snapshot for.' },
      customerId: { type: 'string' },
      live: { type: 'boolean', description: 'If true, query warehouse directly instead of cache. Default: false.' },
    },
    required: ['source', 'table', 'customerId'],
  },
};

export const getSchemaSnapshotHandler: ToolHandler = async (args) => {
  const source = args.source as string;
  const customerId = args.customerId as string;
  const database = (args.database as string) || 'analytics';
  const schema = (args.schema as string) || 'public';
  const table = args.table as string;
  const live = (args.live as boolean) ?? false;
  const start = Date.now();

  try {
    if (!live) {
      // Try cached snapshot first
      const cached = await snapshotStore.getSnapshot(customerId, source, database, schema, table);
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              retrievedFrom: 'cache',
              source,
              customerId,
              database,
              schema,
              table,
              columns: cached,
              columnCount: cached.length,
              retrievedAt: Date.now(),
              retrievalTimeMs: Date.now() - start,
            }, null, 2),
          }],
        };
      }
    }

    // Fall back to live warehouse query
    const tableSchema = await warehouseConnector.getTableSchema(customerId, source, database, schema, table);
    if (!tableSchema) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Table not found: ${database}.${schema}.${table}`,
            source,
            customerId,
          }, null, 2),
        }],
        isError: true,
      };
    }

    // Cache the result for future lookups
    await snapshotStore.saveSnapshot(customerId, source, database, schema, table, tableSchema.columns);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          retrievedFrom: 'warehouse',
          source,
          customerId,
          database,
          schema,
          table,
          columns: tableSchema.columns,
          columnCount: tableSchema.columns.length,
          retrievedAt: Date.now(),
          retrievalTimeMs: Date.now() - start,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }, null, 2),
      }],
      isError: true,
    };
  }
};
