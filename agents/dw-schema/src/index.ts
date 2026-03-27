/**
 * dw-schema — Schema Evolution Agent
 *
 * MCP server exposing schema management tools:
 * - detect_schema_change: real-time schema monitoring (<60s)
 * - assess_impact: downstream impact analysis via lineage
 * - generate_migration: backward-compatible migration scripts
 * - apply_migration: blue/green deployment with rollback
 * - check_compatibility: schema compatibility checks
 * - get_schema_snapshot: retrieve cached/live schema snapshots
 * - list_schema_changes: audit change event history
 * - validate_schema_compatibility: multi-type validation
 * - rollback_migration: rollback with downstream notification
 *
 * See REQ-SCH-001 through REQ-SCH-006.
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';
import { detectSchemaChangeDefinition, detectSchemaChangeHandler } from './tools/detect-schema-change.js';
import { assessImpactDefinition, assessImpactHandler } from './tools/assess-impact.js';
import { generateMigrationDefinition, generateMigrationHandler } from './tools/generate-migration.js';
import { applyMigrationDefinition, applyMigrationHandler } from './tools/apply-migration.js';
import { checkCompatibilityDefinition, checkCompatibilityHandler } from './tools/check-compatibility.js';
import { getSchemaSnapshotDefinition, getSchemaSnapshotHandler } from './tools/get-schema-snapshot.js';
import { listSchemaChangesDefinition, listSchemaChangesHandler } from './tools/list-schema-changes.js';
import { validateSchemaCompatibilityDefinition, validateSchemaCompatibilityHandler } from './tools/validate-schema-compatibility.js';
import { rollbackMigrationDefinition, rollbackMigrationHandler } from './tools/rollback-migration.js';

const AGENT_ID = 'dw-schema';

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.2.0',
  description: 'Schema Evolution Agent — real-time detection, impact analysis, migration, deployment, rollback',
});

// Core tools
server.registerTool(detectSchemaChangeDefinition, withMiddleware(AGENT_ID, 'detect_schema_change', detectSchemaChangeHandler));
server.registerTool(assessImpactDefinition, withMiddleware(AGENT_ID, 'assess_impact', assessImpactHandler));
server.registerTool(generateMigrationDefinition, withMiddleware(AGENT_ID, 'generate_migration', generateMigrationHandler));
server.registerTool(applyMigrationDefinition, withMiddleware(AGENT_ID, 'apply_migration', applyMigrationHandler));
server.registerTool(checkCompatibilityDefinition, withMiddleware(AGENT_ID, 'check_compatibility', checkCompatibilityHandler));

// New tools (P3)
server.registerTool(getSchemaSnapshotDefinition, withMiddleware(AGENT_ID, 'get_schema_snapshot', getSchemaSnapshotHandler));
server.registerTool(listSchemaChangesDefinition, withMiddleware(AGENT_ID, 'list_schema_changes', listSchemaChangesHandler));
server.registerTool(validateSchemaCompatibilityDefinition, withMiddleware(AGENT_ID, 'validate_schema_compatibility', validateSchemaCompatibilityHandler));
server.registerTool(rollbackMigrationDefinition, withMiddleware(AGENT_ID, 'rollback_migration', rollbackMigrationHandler));

server.captureCapabilities();

export { server };
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
