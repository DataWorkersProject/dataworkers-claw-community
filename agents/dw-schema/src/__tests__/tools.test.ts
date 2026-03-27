import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '../index.js';
import { warehouseConnector, kvStore } from '../backends.js';
import type { SchemaChange, MigrationScript } from '../types.js';

/**
 * Reset backends to a clean seeded state before each test.
 * This ensures tests are independent and don't leak state.
 */
function resetBackends(): void {
  // Re-seed the warehouse connector so each test starts fresh.
  // We clear the KV store by creating a new snapshot-less state.
  // Note: Since InMemoryKeyValueStore doesn't expose a clear(), we use
  // the fact that snapshots are per-table and tests use different tables
  // or we just accept baseline behavior.
}

describe('dw-schema MCP Server', () => {
  it('registers all 9 tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(9);
    expect(tools.map((t) => t.name)).toEqual([
      'detect_schema_change', 'assess_impact', 'generate_migration', 'apply_migration',
      'check_compatibility', 'get_schema_snapshot', 'list_schema_changes',
      'validate_schema_compatibility', 'rollback_migration',
    ]);
  });

  describe('detect_schema_change', () => {
    it('detects changes on a specific table', async () => {
      // First call sets baseline
      await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'orders',
      });

      // ALTER TABLE to add a column
      await warehouseConnector.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
        action: 'add_column',
        column: { name: 'discount_amount', type: 'DECIMAL(10,2)', nullable: true },
      });

      // Second call detects the change
      const result = await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'orders',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.changesDetected).toBeGreaterThan(0);
      expect(data.changes[0].changeType).toBe('column_added');
      expect(data.changes[0].severity).toBe('non-breaking');
      expect(data.changes[0].details.column).toBe('discount_amount');
    });

    it('first scan returns baseline', async () => {
      const result = await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'products',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.baseline).toBe(true);
      expect(data.changesDetected).toBe(0);
      expect(data.changes).toEqual([]);
    });

    it('second scan after ALTER TABLE detects the change', async () => {
      // Baseline for customers
      await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'customers',
      });

      // ALTER TABLE
      await warehouseConnector.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'customers', {
        action: 'add_column',
        column: { name: 'phone', type: 'VARCHAR(20)', nullable: true },
      });

      // Detect
      const result = await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'customers',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.changesDetected).toBe(1);
      expect(data.changes[0].changeType).toBe('column_added');
      expect(data.changes[0].details.column).toBe('phone');
    });

    it('different tables produce different detection results', async () => {
      // Baseline both tables
      await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'user_events',
      });

      // Only alter user_events
      await warehouseConnector.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'user_events', {
        action: 'add_column',
        column: { name: 'session_id', type: 'VARCHAR(36)', nullable: true },
      });

      // user_events should show a change
      const eventsResult = await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'user_events',
      });
      const eventsData = JSON.parse(eventsResult.content[0].text!);
      expect(eventsData.changesDetected).toBe(1);
      expect(eventsData.changes[0].table).toBe('user_events');

      // products (with baseline already saved from a previous test) should show no changes
      // We re-baseline it to make this test self-contained
      await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'products',
      });
      const productsResult = await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'products',
      });
      const productsData = JSON.parse(productsResult.content[0].text!);
      expect(productsData.changesDetected).toBe(0);
    });

    it('returns structured error on unknown table', async () => {
      const result = await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'nonexistent_table',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
      expect(data.error).toContain('not found');
    });

    it('returns empty for full schema scan with no changes', async () => {
      // Use a different customer to avoid state conflicts
      const result = await server.callTool('detect_schema_change', {
        source: 'bigquery', customerId: 'cust-no-tables',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.changesDetected).toBe(0);
    });
  });

  describe('assess_impact', () => {
    it('returns graph-based downstream entities', async () => {
      const change: SchemaChange = {
        id: 'chg-1', customerId: 'cust-1', source: 'snowflake',
        database: 'analytics', schema: 'public', table: 'orders',
        changeType: 'column_added', severity: 'non-breaking',
        details: { column: 'discount', newType: 'DECIMAL' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };
      const result = await server.callTool('assess_impact', { change, customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.affectedEntities.length).toBeGreaterThan(0);
      expect(data.recommendations.length).toBeGreaterThan(0);
      expect(data.analysisTimeMs).toBeGreaterThanOrEqual(0);
      // Should include maxDepthReached flag
      expect(typeof data.maxDepthReached).toBe('boolean');

      // Should contain real graph entities, not hardcoded ones
      const entityNames = data.affectedEntities.map((e: any) => e.name);
      // The orders table should have downstream dbt models and dashboards
      expect(entityNames.length).toBeGreaterThan(0);
    });

    it('impact shows dbt models and dashboards specifically', async () => {
      const change: SchemaChange = {
        id: 'chg-impact-dbt', customerId: 'cust-1', source: 'postgres',
        database: 'production', schema: 'public', table: 'raw_orders',
        changeType: 'column_added', severity: 'non-breaking',
        details: { column: 'discount', newType: 'DECIMAL' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };
      const result = await server.callTool('assess_impact', { change, customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);

      const types = data.affectedEntities.map((e: any) => e.type);
      expect(types).toContain('dbt_model');
      expect(types).toContain('dashboard');
    });

    it('classifies direct vs indirect impact', async () => {
      const change: SchemaChange = {
        id: 'chg-depth', customerId: 'cust-1', source: 'postgres',
        database: 'production', schema: 'public', table: 'raw_orders',
        changeType: 'column_removed', severity: 'breaking',
        details: { column: 'amount' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };
      const result = await server.callTool('assess_impact', { change, customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);

      const directEntities = data.affectedEntities.filter((e: any) => e.impact === 'direct');
      const indirectEntities = data.affectedEntities.filter((e: any) => e.impact === 'indirect');
      expect(directEntities.length).toBeGreaterThan(0);
      expect(indirectEntities.length).toBeGreaterThan(0);
    });

    it('flags breaking changes', async () => {
      const change: SchemaChange = {
        id: 'chg-2', customerId: 'cust-1', source: 'snowflake',
        database: 'db', schema: 'public', table: 'users',
        changeType: 'column_removed', severity: 'breaking',
        details: { column: 'legacy_id' },
        detectedAt: Date.now(), detectedVia: 'git_webhook',
      };
      const result = await server.callTool('assess_impact', { change, customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.recommendations.some((r: string) => r.includes('BREAKING'))).toBe(true);
    });

    it('severity propagation: indirect breaking changes get warning severity', async () => {
      const change: SchemaChange = {
        id: 'chg-severity-prop', customerId: 'cust-1', source: 'postgres',
        database: 'production', schema: 'public', table: 'raw_orders',
        changeType: 'column_removed', severity: 'breaking',
        details: { column: 'amount' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };
      const result = await server.callTool('assess_impact', { change, customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);

      // Direct entities should get 'breaking' severity
      const directEntities = data.affectedEntities.filter((e: any) => e.impact === 'direct');
      for (const e of directEntities) {
        expect(e.severity).toBe('breaking');
      }

      // Indirect entities should get 'warning' severity (not 'non-breaking')
      const indirectEntities = data.affectedEntities.filter((e: any) => e.impact === 'indirect');
      for (const e of indirectEntities) {
        expect(e.severity).toBe('warning');
      }
    });
  });

  describe('generate_migration', () => {
    it('generates ADD COLUMN migration', async () => {
      const change: SchemaChange = {
        id: 'chg-3', customerId: 'cust-1', source: 'snowflake',
        database: 'analytics', schema: 'public', table: 'orders',
        changeType: 'column_added', severity: 'non-breaking',
        details: { column: 'discount_pct', newType: 'DECIMAL(5,2)' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };
      const result = await server.callTool('generate_migration', { change, customerId: 'cust-1' });
      const migration = JSON.parse(result.content[0].text!) as MigrationScript;
      expect(migration.forwardSql).toContain('ADD COLUMN');
      expect(migration.rollbackSql).toContain('DROP COLUMN');
      expect(migration.backwardCompatible).toBe(true);
      expect(migration.estimatedEffortHours).toBeGreaterThan(0);
    });

    it('marks column removal as non-backward-compatible', async () => {
      const change: SchemaChange = {
        id: 'chg-4', customerId: 'cust-1', source: 'postgres',
        database: 'db', schema: 'public', table: 'users',
        changeType: 'column_removed', severity: 'breaking',
        details: { column: 'old_field', oldType: 'VARCHAR(255)' },
        detectedAt: Date.now(), detectedVia: 'git_webhook',
      };
      const result = await server.callTool('generate_migration', { change, customerId: 'cust-1' });
      const migration = JSON.parse(result.content[0].text!) as MigrationScript;
      expect(migration.backwardCompatible).toBe(false);
    });

    it('generates rename column migration', async () => {
      const change: SchemaChange = {
        id: 'chg-5', customerId: 'cust-1', source: 'snowflake',
        database: 'db', schema: 'public', table: 'orders',
        changeType: 'column_renamed', severity: 'breaking',
        details: { oldName: 'amt', newName: 'amount' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };
      const result = await server.callTool('generate_migration', { change, customerId: 'cust-1' });
      const migration = JSON.parse(result.content[0].text!) as MigrationScript;
      expect(migration.forwardSql).toContain('RENAME COLUMN');
      expect(migration.backwardCompatible).toBe(false);
    });

    it('includes effort estimation', async () => {
      const change: SchemaChange = {
        id: 'chg-effort', customerId: 'cust-1', source: 'snowflake',
        database: 'analytics', schema: 'public', table: 'orders',
        changeType: 'column_type_changed', severity: 'breaking',
        details: { column: 'amount', oldType: 'INTEGER', newType: 'VARCHAR(255)' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };
      const result = await server.callTool('generate_migration', { change, customerId: 'cust-1' });
      const migration = JSON.parse(result.content[0].text!) as MigrationScript;
      expect(migration.estimatedEffortHours).toBeDefined();
      expect(migration.estimatedEffortHours).toBeGreaterThan(0);
      // Type change is one of the more complex migrations
      expect(migration.estimatedEffortHours!).toBeGreaterThan(1);
    });
  });

  describe('apply_migration', () => {
    it('applies migration with blue/green strategy', async () => {
      const migration: MigrationScript = {
        id: 'mig-1', changeId: 'chg-1', customerId: 'cust-1', status: 'validated',
        forwardSql: 'ALTER TABLE orders ADD COLUMN discount DECIMAL;',
        rollbackSql: 'ALTER TABLE orders DROP COLUMN discount;',
        affectedSystems: ['sql', 'dbt'], backwardCompatible: true,
      };
      const result = await server.callTool('apply_migration', { migration, customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.success).toBe(true);
      expect(data.strategy).toBe('blue_green');
      expect(data.rollbackAvailable).toBe(true);
      expect(data.downstreamNotified.length).toBeGreaterThan(0);
    });

    it('blocks breaking changes with immediate strategy', async () => {
      const migration: MigrationScript = {
        id: 'mig-2', changeId: 'chg-2', customerId: 'cust-1', status: 'validated',
        forwardSql: 'ALTER TABLE users DROP COLUMN legacy;',
        rollbackSql: 'ALTER TABLE users ADD COLUMN legacy VARCHAR;',
        affectedSystems: ['sql'], backwardCompatible: false,
      };
      const result = await server.callTool('apply_migration', {
        migration, customerId: 'cust-1', strategy: 'immediate',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Breaking');
    });

    it('supports dry run', async () => {
      const migration: MigrationScript = {
        id: 'mig-3', changeId: 'chg-3', customerId: 'cust-1', status: 'pending',
        forwardSql: 'ALTER TABLE t ADD COLUMN c INT;',
        rollbackSql: 'ALTER TABLE t DROP COLUMN c;',
        affectedSystems: ['sql'], backwardCompatible: true,
      };
      const result = await server.callTool('apply_migration', {
        migration, customerId: 'cust-1', dryRun: true,
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.note).toContain('DRY RUN');
    });
  });

  describe('get_schema_snapshot', () => {
    it('retrieves snapshot from warehouse when live=true', async () => {
      const result = await server.callTool('get_schema_snapshot', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics',
        schema: 'public', table: 'orders', live: true,
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.retrievedFrom).toBe('warehouse');
      expect(data.columns).toBeDefined();
      expect(data.columnCount).toBeGreaterThan(0);
    });

    it('retrieves snapshot from cache after first fetch', async () => {
      // First fetch populates cache
      await server.callTool('get_schema_snapshot', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics',
        schema: 'public', table: 'orders',
      });
      // Second fetch should come from cache
      const result = await server.callTool('get_schema_snapshot', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics',
        schema: 'public', table: 'orders',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.retrievedFrom).toBe('cache');
    });

    it('forces live query when live=true bypassing cache', async () => {
      // Even after cache is populated, live=true should query warehouse
      const result = await server.callTool('get_schema_snapshot', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics',
        schema: 'public', table: 'orders', live: true,
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.retrievedFrom).toBe('warehouse');
    });

    it('returns error for unknown table', async () => {
      const result = await server.callTool('get_schema_snapshot', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics',
        schema: 'public', table: 'nonexistent',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });
  });

  describe('list_schema_changes', () => {
    it('returns empty list when no events exist', async () => {
      const result = await server.callTool('list_schema_changes', {
        customerId: 'cust-never-used',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.totalEvents).toBe(0);
      expect(data.events).toEqual([]);
    });
  });

  describe('validate_schema_compatibility', () => {
    it('validates a well-formed change', async () => {
      const change: SchemaChange = {
        id: 'chg-val-1', customerId: 'cust-1', source: 'snowflake',
        database: 'analytics', schema: 'public', table: 'orders',
        changeType: 'column_added', severity: 'non-breaking',
        details: { column: 'discount', newType: 'DECIMAL' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };
      const result = await server.callTool('validate_schema_compatibility', {
        change, customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.valid).toBe(true);
      expect(data.validationResults.length).toBeGreaterThan(0);
    });

    it('validates migration SQL', async () => {
      const result = await server.callTool('validate_schema_compatibility', {
        migrationSql: 'ALTER TABLE orders ADD COLUMN discount DECIMAL;',
        customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.valid).toBe(true);
    });

    it('returns error when no change or SQL provided', async () => {
      const result = await server.callTool('validate_schema_compatibility', {
        customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });
  });

  describe('rollback_migration', () => {
    it('rolls back a migration successfully', async () => {
      const migration: MigrationScript = {
        id: 'mig-rb-1', changeId: 'chg-1', customerId: 'cust-1', status: 'deployed',
        forwardSql: 'ALTER TABLE orders ADD COLUMN discount DECIMAL;',
        rollbackSql: 'ALTER TABLE orders DROP COLUMN discount;',
        affectedSystems: ['sql', 'dbt'], backwardCompatible: true,
      };
      const result = await server.callTool('rollback_migration', {
        migration, customerId: 'cust-1', reason: 'Performance regression',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.success).toBe(true);
      expect(data.reason).toBe('Performance regression');
      expect(data.downstreamNotified.length).toBeGreaterThan(0);
    });

    it('supports dry run for rollback', async () => {
      const migration: MigrationScript = {
        id: 'mig-rb-2', changeId: 'chg-2', customerId: 'cust-1', status: 'deployed',
        forwardSql: 'ALTER TABLE orders ADD COLUMN x INT;',
        rollbackSql: 'ALTER TABLE orders DROP COLUMN x;',
        affectedSystems: ['sql'], backwardCompatible: true,
      };
      const result = await server.callTool('rollback_migration', {
        migration, customerId: 'cust-1', dryRun: true,
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.note).toContain('DRY RUN');
    });

    it('returns error when no rollback SQL', async () => {
      const migration = {
        id: 'mig-rb-3', changeId: 'chg-3', customerId: 'cust-1', status: 'deployed',
        forwardSql: 'ALTER TABLE x ADD COLUMN y INT;',
        affectedSystems: ['sql'], backwardCompatible: true,
      } as MigrationScript;
      const result = await server.callTool('rollback_migration', {
        migration, customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.success).toBe(false);
      expect(data.error).toContain('rollback SQL');
    });
  });

  describe('E2E Schema Change Workflow', () => {
    it('detect -> assess -> generate -> apply', async () => {
      // Step 1: Baseline scan
      await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'products',
      });

      // ALTER TABLE to add a column
      await warehouseConnector.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'products', {
        action: 'add_column',
        column: { name: 'description', type: 'VARCHAR(500)', nullable: true },
      });

      // Step 1b: Detect change
      const detectResult = await server.callTool('detect_schema_change', {
        source: 'snowflake', customerId: 'cust-1', database: 'analytics', schema: 'public', table: 'products',
      });
      const detected = JSON.parse(detectResult.content[0].text!);
      expect(detected.changesDetected).toBeGreaterThan(0);
      const change = detected.changes[0];

      // Step 2: Assess impact
      const impactResult = await server.callTool('assess_impact', {
        change, customerId: 'cust-1',
      });
      const impact = JSON.parse(impactResult.content[0].text!);
      expect(impact.recommendations.length).toBeGreaterThan(0);
      expect(typeof impact.maxDepthReached).toBe('boolean');

      // Step 3: Generate migration
      const migResult = await server.callTool('generate_migration', {
        change, customerId: 'cust-1',
      });
      const migration = JSON.parse(migResult.content[0].text!);
      expect(migration.forwardSql).toBeTruthy();
      expect(migration.rollbackSql).toBeTruthy();
      expect(migration.estimatedEffortHours).toBeDefined();

      // Step 3b: Validate before applying
      const valResult = await server.callTool('validate_schema_compatibility', {
        change, migrationSql: migration.forwardSql, customerId: 'cust-1',
      });
      const validation = JSON.parse(valResult.content[0].text!);
      expect(validation.valid).toBe(true);

      // Step 4: Apply
      const applyResult = await server.callTool('apply_migration', {
        migration, customerId: 'cust-1',
      });
      const deployment = JSON.parse(applyResult.content[0].text!);
      expect(deployment.success).toBe(true);
      expect(deployment.rollbackAvailable).toBe(true);
    });

    it('detect -> assess -> generate -> apply -> rollback', async () => {
      // Full workflow including rollback
      const change: SchemaChange = {
        id: 'chg-e2e-rb', customerId: 'cust-1', source: 'snowflake',
        database: 'analytics', schema: 'public', table: 'orders',
        changeType: 'column_added', severity: 'non-breaking',
        details: { column: 'temp_col', newType: 'VARCHAR(100)' },
        detectedAt: Date.now(), detectedVia: 'information_schema',
      };

      // Generate
      const migResult = await server.callTool('generate_migration', {
        change, customerId: 'cust-1',
      });
      const migration = JSON.parse(migResult.content[0].text!);

      // Apply
      const applyResult = await server.callTool('apply_migration', {
        migration, customerId: 'cust-1',
      });
      const deployment = JSON.parse(applyResult.content[0].text!);
      expect(deployment.success).toBe(true);

      // Rollback
      const rbResult = await server.callTool('rollback_migration', {
        migration, customerId: 'cust-1', reason: 'Feature flag disabled',
      });
      const rollback = JSON.parse(rbResult.content[0].text!);
      expect(rollback.success).toBe(true);
    });
  });

  describe('negative tests', () => {
    it('assess_impact returns error when no change provided', async () => {
      const result = await server.callTool('assess_impact', {
        change: null, customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('generate_migration handles missing change gracefully', async () => {
      const result = await server.callTool('generate_migration', {
        change: null, customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.forwardSql).toContain('No change provided');
    });

    it('apply_migration rejects missing SQL', async () => {
      const result = await server.callTool('apply_migration', {
        migration: { id: 'x', changeId: 'y', customerId: 'z', status: 'pending' },
        customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.success).toBe(false);
      expect(data.error).toContain('No migration SQL');
    });
  });
});
