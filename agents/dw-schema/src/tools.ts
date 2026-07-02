/**
 * dw-schema — Exported tool definitions and handlers.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

import { detectSchemaChangeDefinition, detectSchemaChangeHandler } from './tools/detect-schema-change.js';
import { assessImpactDefinition, assessImpactHandler } from './tools/assess-impact.js';
import { generateMigrationDefinition, generateMigrationHandler } from './tools/generate-migration.js';
import { applyMigrationDefinition, applyMigrationHandler } from './tools/apply-migration.js';
import { checkCompatibilityDefinition, checkCompatibilityHandler } from './tools/check-compatibility.js';
import { getSchemaSnapshotDefinition, getSchemaSnapshotHandler } from './tools/get-schema-snapshot.js';
import { listSchemaChangesDefinition, listSchemaChangesHandler } from './tools/list-schema-changes.js';
import { validateSchemaCompatibilityDefinition, validateSchemaCompatibilityHandler } from './tools/validate-schema-compatibility.js';
import { rollbackMigrationDefinition, rollbackMigrationHandler } from './tools/rollback-migration.js';

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const schemaTools: ToolEntry[] = [
  { definition: detectSchemaChangeDefinition, handler: detectSchemaChangeHandler },
  { definition: assessImpactDefinition, handler: assessImpactHandler },
  { definition: generateMigrationDefinition, handler: generateMigrationHandler },
  { definition: applyMigrationDefinition, handler: applyMigrationHandler },
  { definition: checkCompatibilityDefinition, handler: checkCompatibilityHandler },
  { definition: getSchemaSnapshotDefinition, handler: getSchemaSnapshotHandler },
  { definition: listSchemaChangesDefinition, handler: listSchemaChangesHandler },
  { definition: validateSchemaCompatibilityDefinition, handler: validateSchemaCompatibilityHandler },
  { definition: rollbackMigrationDefinition, handler: rollbackMigrationHandler },
];
