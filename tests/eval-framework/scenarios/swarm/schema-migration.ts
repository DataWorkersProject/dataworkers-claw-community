/**
 * Eval Framework — Swarm Scenario: Schema Migration
 *
 * Simulates a schema migration workflow: detect a schema change,
 * generate a migration, run quality checks on the affected table,
 * and produce an audit report.
 *
 * Flow:
 * 1. detect_schema_change -> identify what changed in the orders table
 * 2. generate_migration -> create migration SQL for adding a column
 * 3. run_quality_check -> verify data quality post-migration
 * 4. generate_audit_report -> document the change for compliance
 */

import type { SwarmScenario } from './types.js';
import { runSwarmScenario } from './onboarding.js';

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

export const schemaMigrationScenario: SwarmScenario = {
  name: 'schema-migration',
  description: 'Detect schema change, generate migration, check quality, and audit',
  steps: [
    {
      id: 'detect-change',
      agent: 'dw-schema',
      tool: 'detect_schema_change',
      inputTemplate: {
        source: 'snowflake',
        customerId: 'test-customer-1',
        database: 'analytics',
        schema: 'public',
      },
      extractFields: {
        changes: 'changes',
        changeCount: 'changeCount',
        table: 'table',
      },
      expectedFields: ['changes'],
    },
    {
      id: 'generate-migration',
      agent: 'dw-schema',
      tool: 'generate_migration',
      inputTemplate: {
        change: {
          type: 'add_column',
          table: 'orders',
          column: 'shipping_date',
          dataType: 'TIMESTAMP',
        },
        customerId: 'test-customer-1',
      },
      extractFields: {
        migrationId: 'id',
        sql: 'sql',
        rollbackSql: 'rollbackSql',
      },
      expectedFields: ['sql'],
    },
    {
      id: 'quality-check',
      agent: 'dw-quality',
      tool: 'run_quality_check',
      inputTemplate: {
        datasetId: 'orders',
        customerId: 'test-customer-1',
      },
      extractFields: {
        qualityScore: 'score',
        checks: 'checks',
        passed: 'passed',
      },
      expectedFields: ['score'],
    },
    {
      id: 'audit-report',
      agent: 'dw-governance',
      tool: 'generate_audit_report',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      extractFields: {
        reportId: 'reportId',
        events: 'events',
        summary: 'summary',
      },
      expectedFields: ['events'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function runSchemaMigrationScenario(
  servers: Record<string, { callTool: (name: string, args: Record<string, unknown>) => Promise<any> }>,
) {
  return runSwarmScenario(schemaMigrationScenario, servers);
}
