/**
 * check_compatibility MCP tool — checks schema compatibility between
 * source columns and a target table.
 *
 * Used by the pipeline agent to verify that source data is compatible
 * with the target schema before deployment.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { warehouseConnector } from '../backends.js';

export const checkCompatibilityDefinition: ToolDefinition = {
  name: 'check_compatibility',
  description: 'Check schema compatibility between source columns and a target table. Returns whether the schemas are compatible, any breaking changes, and suggested migrations.',
  inputSchema: {
    type: 'object',
    properties: {
      sourceColumns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
          },
          required: ['name', 'type'],
        },
        description: 'Source column definitions to check against the target.',
      },
      targetTable: { type: 'string', description: 'Target table name to check compatibility against.' },
      targetSource: { type: 'string', description: 'Target data source (snowflake, bigquery, etc.). Defaults to snowflake.' },
      targetDatabase: { type: 'string', description: 'Target database. Defaults to analytics.' },
      targetSchema: { type: 'string', description: 'Target schema. Defaults to public.' },
      customerId: { type: 'string' },
    },
    required: ['sourceColumns', 'targetTable', 'customerId'],
  },
};

/** Type widening rules — source type can safely widen to target type. */
const TYPE_WIDENING: Record<string, string[]> = {
  'int': ['bigint', 'long', 'decimal', 'float', 'double', 'numeric'],
  'integer': ['bigint', 'long', 'decimal', 'float', 'double', 'numeric'],
  'bigint': ['decimal', 'numeric'],
  'long': ['decimal', 'numeric'],
  'float': ['double', 'decimal', 'numeric'],
  'varchar': ['text', 'string'],
  'string': ['text', 'varchar'],
  'date': ['timestamp', 'timestamptz'],
  'timestamp': ['timestamptz'],
};

function areTypesCompatible(sourceType: string, targetType: string): boolean {
  const src = sourceType.toLowerCase().replace(/\(.*\)/, '').trim();
  const tgt = targetType.toLowerCase().replace(/\(.*\)/, '').trim();

  if (src === tgt) return true;

  // Check widening rules
  const widenable = TYPE_WIDENING[src];
  if (widenable && widenable.includes(tgt)) return true;

  return false;
}

function suggestMigration(sourceType: string, targetType: string, columnName: string): string {
  const src = sourceType.toLowerCase().replace(/\(.*\)/, '').trim();
  const tgt = targetType.toLowerCase().replace(/\(.*\)/, '').trim();

  // Can widen the target
  const widenable = TYPE_WIDENING[tgt];
  if (widenable && widenable.includes(src)) {
    return `ALTER TABLE ... ALTER COLUMN ${columnName} TYPE ${sourceType}; -- widen from ${targetType} to ${sourceType}`;
  }

  // Cast needed
  return `-- Add CAST(${columnName} AS ${targetType}) in the transform step, or ALTER TABLE ... ALTER COLUMN ${columnName} TYPE ${sourceType}`;
}

export const checkCompatibilityHandler: ToolHandler = async (args) => {
  const sourceColumns = args.sourceColumns as Array<{ name: string; type: string }>;
  const targetTable = args.targetTable as string;
  const customerId = args.customerId as string;
  const targetSource = (args.targetSource as string) ?? 'snowflake';
  const targetDatabase = (args.targetDatabase as string) ?? 'analytics';
  const targetSchema = (args.targetSchema as string) ?? 'public';

  try {
    // Resolve target table schema
    const targetTableSchema = await warehouseConnector.getTableSchema(
      customerId,
      targetSource,
      targetDatabase,
      targetSchema,
      targetTable,
    );

    if (!targetTableSchema) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            compatible: true,
            targetTableExists: false,
            breakingChanges: [],
            suggestedMigrations: [],
            message: `Target table ${targetTable} does not exist yet — any schema is compatible.`,
          }, null, 2),
        }],
      };
    }

    // Build a map of target columns
    const targetColumnMap = new Map(
      targetTableSchema.columns.map(c => [c.name.toLowerCase(), c]),
    );

    const breakingChanges: Array<{
      column: string;
      issue: string;
      sourceType: string;
      targetType?: string;
    }> = [];
    const suggestedMigrations: string[] = [];

    for (const srcCol of sourceColumns) {
      const tgtCol = targetColumnMap.get(srcCol.name.toLowerCase());

      if (!tgtCol) {
        // New column — non-breaking addition
        suggestedMigrations.push(
          `ALTER TABLE ${targetTable} ADD COLUMN ${srcCol.name} ${srcCol.type}; -- new column from source`,
        );
        continue;
      }

      // Check type compatibility
      if (!areTypesCompatible(srcCol.type, tgtCol.type)) {
        breakingChanges.push({
          column: srcCol.name,
          issue: 'type_mismatch',
          sourceType: srcCol.type,
          targetType: tgtCol.type,
        });
        suggestedMigrations.push(suggestMigration(srcCol.type, tgtCol.type, srcCol.name));
      }
    }

    // Check for target columns missing from source (potential data loss)
    const sourceColumnNames = new Set(sourceColumns.map(c => c.name.toLowerCase()));
    for (const [colName] of targetColumnMap) {
      if (!sourceColumnNames.has(colName)) {
        breakingChanges.push({
          column: colName,
          issue: 'missing_in_source',
          sourceType: 'N/A',
          targetType: targetColumnMap.get(colName)?.type,
        });
      }
    }

    const compatible = breakingChanges.length === 0;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          compatible,
          targetTableExists: true,
          breakingChanges,
          suggestedMigrations,
          sourceColumnCount: sourceColumns.length,
          targetColumnCount: targetTableSchema.columns.length,
          checkedAt: Date.now(),
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Compatibility check failed: ${err instanceof Error ? err.message : String(err)}`,
          targetTable,
        }, null, 2),
      }],
      isError: true,
    };
  }
};
