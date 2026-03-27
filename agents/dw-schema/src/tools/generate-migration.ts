/**
 * generate_migration tool — generates backward-compatible migration scripts
 * for a schema change. Includes forward SQL, rollback SQL, affected system
 * updates, and effort estimation.
 *
 * fixes:
 * - Removed false sqlglot claim from description (we don't use sqlglot)
 * - Added input validation
 * - Added effort estimation formula
 * - Added event publishing for migration.generated
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import type { MigrationScript, SchemaChange } from '../types.js';
import { messageBus } from '../backends.js';

export const generateMigrationDefinition: ToolDefinition = {
  name: 'generate_migration',
  description: 'Generate backward-compatible migration scripts for a schema change. Includes forward SQL, rollback SQL, affected system updates, and effort estimation.',
  inputSchema: {
    type: 'object',
    properties: {
      change: { type: 'object', description: 'The schema change to migrate.' },
      customerId: { type: 'string' },
      targetSystems: { type: 'array', items: { type: 'string' }, description: 'Systems to generate migrations for (sql, dbt, api).' },
    },
    required: ['change', 'customerId'],
  },
};

export const generateMigrationHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('generate_migration')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: 'generate_migration' }) }],
      isError: true,
    };
  }

  const rawChange = args.change as SchemaChange & { type?: string } | undefined;
  // Accept both change.type and change.changeType for backward compat
  const change = rawChange ? {
    ...rawChange,
    changeType: rawChange.changeType ?? rawChange.type ?? 'column_added',
  } as SchemaChange : undefined as unknown as SchemaChange;
  const customerId = args.customerId as string;

  // Input validation
  if (!customerId) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'customerId is required' }, null, 2) }],
      isError: true,
    };
  }

  const migration = generateMigration(change, customerId);

  // Publish migration.generated event
  try {
    await messageBus.publish('schema.events', {
      id: `evt-mig-gen-${Date.now()}`,
      type: 'migration.generated',
      payload: {
        migrationId: migration.id,
        changeId: migration.changeId,
        backwardCompatible: migration.backwardCompatible,
        estimatedEffortHours: migration.estimatedEffortHours,
      },
      timestamp: Date.now(),
      customerId,
    });
  } catch {
    // Non-fatal
  }

  return { content: [{ type: 'text', text: JSON.stringify(migration, null, 2) }] };
};

/**
 * Estimate effort in hours based on change type and backward compatibility.
 * Formula: base hours by change type + compatibility penalty + system count factor.
 */
function estimateEffort(change: SchemaChange | undefined, affectedSystems: string[], backwardCompatible: boolean): number {
  if (!change) return 0.5;

  const baseHoursByType: Record<string, number> = {
    'column_added': 0.5,
    'column_removed': 2,
    'column_type_changed': 3,
    'column_renamed': 2,
    'table_created': 1,
    'table_dropped': 4,
    'constraint_added': 1,
    'constraint_removed': 1.5,
    'index_changed': 1,
  };

  let hours = baseHoursByType[change.changeType] ?? 1;

  // Non-backward-compatible changes require more coordination
  if (!backwardCompatible) {
    hours *= 1.5;
  }

  // More affected systems = more work
  hours += affectedSystems.length * 0.25;

  return Math.round(hours * 10) / 10; // Round to 1 decimal
}

function generateMigration(change: SchemaChange | undefined, customerId: string): MigrationScript {
  const id = `mig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!change) {
    return {
      id, changeId: 'unknown', customerId, status: 'pending',
      forwardSql: '-- No change provided', rollbackSql: '-- No rollback needed',
      affectedSystems: [], backwardCompatible: true,
      estimatedEffortHours: 0.5,
    };
  }

  let forwardSql = '';
  let rollbackSql = '';
  let backwardCompatible = true;

  switch (change.changeType) {
    case 'column_added':
      forwardSql = `ALTER TABLE ${change.database}.${change.schema}.${change.table}\nADD COLUMN ${change.details.column} ${change.details.newType};`;
      rollbackSql = `ALTER TABLE ${change.database}.${change.schema}.${change.table}\nDROP COLUMN ${change.details.column};`;
      break;
    case 'column_removed':
      forwardSql = `ALTER TABLE ${change.database}.${change.schema}.${change.table}\nDROP COLUMN ${change.details.column};`;
      rollbackSql = `ALTER TABLE ${change.database}.${change.schema}.${change.table}\nADD COLUMN ${change.details.column} ${change.details.oldType};`;
      backwardCompatible = false;
      break;
    case 'column_type_changed':
      forwardSql = `ALTER TABLE ${change.database}.${change.schema}.${change.table}\nALTER COLUMN ${change.details.column} SET DATA TYPE ${change.details.newType};`;
      rollbackSql = `ALTER TABLE ${change.database}.${change.schema}.${change.table}\nALTER COLUMN ${change.details.column} SET DATA TYPE ${change.details.oldType};`;
      backwardCompatible = isTypeChangeCompatible(change.details.oldType, change.details.newType);
      break;
    case 'column_renamed':
      forwardSql = `ALTER TABLE ${change.database}.${change.schema}.${change.table}\nRENAME COLUMN ${change.details.oldName} TO ${change.details.newName};`;
      rollbackSql = `ALTER TABLE ${change.database}.${change.schema}.${change.table}\nRENAME COLUMN ${change.details.newName} TO ${change.details.oldName};`;
      backwardCompatible = false;
      break;
    default:
      forwardSql = `-- Migration for ${change.changeType} on ${change.table}`;
      rollbackSql = `-- Rollback for ${change.changeType} on ${change.table}`;
  }

  const affectedSystems = ['sql', 'dbt'];

  return {
    id, changeId: change.id, customerId, status: 'pending',
    forwardSql, rollbackSql,
    affectedSystems,
    backwardCompatible,
    estimatedEffortHours: estimateEffort(change, affectedSystems, backwardCompatible),
  };
}

function isTypeChangeCompatible(oldType?: string, newType?: string): boolean {
  if (!oldType || !newType) return false;
  const wideningChanges: Record<string, string[]> = {
    'INT': ['BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'],
    'FLOAT': ['DOUBLE'],
    'VARCHAR(50)': ['VARCHAR(100)', 'VARCHAR(255)', 'TEXT'],
  };
  return wideningChanges[oldType.toUpperCase()]?.includes(newType.toUpperCase()) ?? false;
}
