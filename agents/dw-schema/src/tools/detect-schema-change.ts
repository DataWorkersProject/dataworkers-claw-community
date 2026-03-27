/**
 * detect_schema_change tool — detects schema changes by comparing the current
 * warehouse INFORMATION_SCHEMA against a cached snapshot. Uses the diff engine
 * for column-level change detection.
 *
 * On first scan (no previous snapshot), saves a baseline and returns { baseline: true }.
 * On subsequent scans, diffs against the stored snapshot and returns detected changes.
 *
 * Added event publishing for schema.change.detected
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { SchemaChange } from '../types.js';
import { warehouseConnector, kvStore, messageBus } from '../backends.js';
import { SnapshotStore } from '../snapshot-store.js';
import { diffSchemas } from '../diff-engine.js';
import { IcebergConnector } from '@data-workers/iceberg-connector';
import { detectIcebergSchemaEvolution } from '../iceberg-evolution.js';

const snapshotStore = new SnapshotStore(kvStore, warehouseConnector);

export const detectSchemaChangeDefinition: ToolDefinition = {
  name: 'detect_schema_change',
  description: 'Detect schema changes on a data asset. Monitors INFORMATION_SCHEMA, schema registries, and Git webhooks for real-time modifications. Classifies changes as breaking or non-breaking.',
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Data source (snowflake, bigquery, postgres, etc.)' },
      database: { type: 'string' },
      schema: { type: 'string' },
      table: { type: 'string', description: 'Table to check. Omit to scan all tables.' },
      customerId: { type: 'string' },
    },
    required: ['source', 'customerId'],
  },
};

export const detectSchemaChangeHandler: ToolHandler = async (args) => {
  const source = args.source as string;
  const customerId = args.customerId as string;
  const database = (args.database as string) || 'analytics';
  const schema = (args.schema as string) || 'public';
  const table = args.table as string | undefined;
  const start = Date.now();

  try {
    // Iceberg snapshot-based detection
    if (source === 'iceberg') {
      const namespace = database;
      const tableName = table ?? 'events';
      const connector = new IcebergConnector();
      connector.connect('http://localhost:8181');

      const icebergChanges = detectIcebergSchemaEvolution(connector, namespace, tableName);
      // Stamp customerId onto each change
      for (const ch of icebergChanges) {
        ch.customerId = customerId;
      }

      connector.disconnect();

      // Publish detection event
      if (icebergChanges.length > 0) {
        await publishDetectionEvent(customerId, icebergChanges);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            changesDetected: icebergChanges.length,
            changes: icebergChanges,
            detectionTimeMs: Date.now() - start,
            source: 'iceberg',
            scanType: 'iceberg_snapshot',
          }, null, 2),
        }],
      };
    }

    // If no specific table, scan all tables
    if (!table) {
      const tables = await warehouseConnector.listTables(customerId, source, database, schema);
      if (tables.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              changesDetected: 0,
              changes: [],
              detectionTimeMs: Date.now() - start,
              source,
              scanType: 'full_schema',
              summary: 'No tables found for this source.',
            }, null, 2),
          }],
        };
      }

      // Scan each table and aggregate results
      const allChanges: SchemaChange[] = [];
      let hasBaseline = false;
      for (const fqn of tables) {
        // fqn is database.schema.table
        const parts = fqn.split('.');
        const tbl = parts[parts.length - 1];
        const currentSchema = await warehouseConnector.getTableSchema(customerId, source, database, schema, tbl);
        if (!currentSchema) continue;

        const previousSnapshot = await snapshotStore.getSnapshot(customerId, source, database, schema, tbl);
        if (!previousSnapshot) {
          await snapshotStore.saveSnapshot(customerId, source, database, schema, tbl, currentSchema.columns);
          hasBaseline = true;
          continue;
        }

        const changes = diffSchemas(previousSnapshot, currentSchema.columns, {
          customerId, source, database, schema, table: tbl,
        });
        if (changes.length > 0) {
          await snapshotStore.saveSnapshot(customerId, source, database, schema, tbl, currentSchema.columns);
          allChanges.push(...changes);
        }
      }

      // Publish detection event
      if (allChanges.length > 0) {
        await publishDetectionEvent(customerId, allChanges);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...(hasBaseline ? { baseline: true } : {}),
            changesDetected: allChanges.length,
            changes: allChanges,
            detectionTimeMs: Date.now() - start,
            source,
            scanType: 'full_schema',
            ...(hasBaseline ? { summary: `Baseline snapshots saved for new table(s). ${allChanges.length} change(s) detected in existing tables.` } : {}),
          }, null, 2),
        }],
      };
    }

    // Single table scan
    const currentSchema = await warehouseConnector.getTableSchema(customerId, source, database, schema, table);
    if (!currentSchema) {
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

    const previousSnapshot = await snapshotStore.getSnapshot(customerId, source, database, schema, table);

    // First scan — save baseline
    if (!previousSnapshot) {
      await snapshotStore.saveSnapshot(customerId, source, database, schema, table, currentSchema.columns);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            baseline: true,
            changesDetected: 0,
            changes: [],
            detectionTimeMs: Date.now() - start,
            source,
            scanType: 'single_table',
            summary: `Baseline snapshot saved for ${database}.${schema}.${table} (${currentSchema.columns.length} columns).`,
          }, null, 2),
        }],
      };
    }

    // Diff against previous snapshot
    const changes = diffSchemas(previousSnapshot, currentSchema.columns, {
      customerId, source, database, schema, table,
    });

    // Save new snapshot
    await snapshotStore.saveSnapshot(customerId, source, database, schema, table, currentSchema.columns);

    // Publish detection event
    if (changes.length > 0) {
      await publishDetectionEvent(customerId, changes);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          changesDetected: changes.length,
          changes,
          detectionTimeMs: Date.now() - start,
          source,
          scanType: 'single_table',
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          source,
          customerId,
        }, null, 2),
      }],
      isError: true,
    };
  }
};

/**
 * Publish schema.change.detected events to the message bus.
 */
async function publishDetectionEvent(customerId: string, changes: SchemaChange[]): Promise<void> {
  try {
    await messageBus.publish('schema.events', {
      id: `evt-detect-${Date.now()}`,
      type: 'schema.change.detected',
      payload: {
        changesDetected: changes.length,
        changeIds: changes.map(c => c.id),
        breakingCount: changes.filter(c => c.severity === 'breaking').length,
      },
      timestamp: Date.now(),
      customerId,
    });
  } catch {
    // Non-fatal: event publishing failure should not break detection
  }
}
