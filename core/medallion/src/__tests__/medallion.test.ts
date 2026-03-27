/**
 * @data-workers/medallion — Comprehensive Tests
 *
 * 50+ tests covering all medallion components:
 * - LayerRegistry, QualityGateEvaluator, MedallionCoordinator
 * - PromotionEngine, SchemaDriftHealer, GoldPromoter
 * - LineageTracker, RetentionManager, RBACEnforcer, AuditLog
 * - Platform adapters (Iceberg, Snowflake, Databricks, BigQuery, dbt)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { LayerRegistry } from '../layer-registry.js';
import { QualityGateEvaluator } from '../quality-gate-evaluator.js';
import { MedallionCoordinator } from '../medallion-coordinator.js';
import { PromotionEngine } from '../promotion-engine.js';
import { IcebergMedallionAdapter } from '../iceberg-adapter.js';
import {
  SnowflakeMedallionAdapter,
  DatabricksMedallionAdapter,
  BigQueryMedallionAdapter,
  DbtMedallionAdapter,
} from '../platform-adapters.js';
import { SchemaDriftHealer } from '../schema-drift-healer.js';
import { GoldPromoter } from '../gold-promoter.js';
import { LineageTracker } from '../lineage-tracker.js';
import { RetentionManager } from '../retention-manager.js';
import { AuditLog, RBACEnforcer } from '../rbac-audit.js';

import type {
  PromotionRule,
  QualityGate,
  ColumnDef,
} from '../types.js';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeRule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: 'rule-1',
    name: 'Bronze events to Silver',
    sourceLayer: 'bronze',
    targetLayer: 'silver',
    sourceTable: 'events',
    targetTable: 'events',
    transforms: [{ type: 'deduplicate', config: { keys: ['id'] } }],
    qualityGates: [],
    enabled: true,
    ...overrides,
  };
}

function makeSampleData(count: number = 10): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `item_${i + 1}`,
    value: Math.random() * 100,
    timestamp: Date.now() - i * 60000,
  }));
}

// ═════════════════════════════════════════════════════════════════════
// LayerRegistry
// ═════════════════════════════════════════════════════════════════════

describe('LayerRegistry', () => {
  let registry: LayerRegistry;

  beforeEach(() => {
    registry = new LayerRegistry();
  });

  it('should register and resolve a table mapping', () => {
    registry.register({
      layer: 'bronze',
      table: 'events',
      platform: 'iceberg',
      location: 'bronze_db.default.events',
    });

    const mapping = registry.resolve('bronze', 'events');
    expect(mapping).toBeDefined();
    expect(mapping!.location).toBe('bronze_db.default.events');
  });

  it('should return undefined for unregistered tables', () => {
    expect(registry.resolve('bronze', 'nonexistent')).toBeUndefined();
  });

  it('should get all tables in a layer', () => {
    registry.register({
      layer: 'bronze',
      table: 'events',
      platform: 'iceberg',
      location: 'bronze_db.default.events',
    });
    registry.register({
      layer: 'bronze',
      table: 'users',
      platform: 'iceberg',
      location: 'bronze_db.default.users',
    });
    registry.register({
      layer: 'silver',
      table: 'events',
      platform: 'iceberg',
      location: 'silver_db.default.events',
    });

    const bronzeTables = registry.getTablesInLayer('bronze');
    expect(bronzeTables).toHaveLength(2);
    expect(bronzeTables.map((t) => t.table)).toContain('events');
    expect(bronzeTables.map((t) => t.table)).toContain('users');
  });

  it('should validate bronze→silver promotion order', () => {
    expect(registry.validatePromotionOrder('bronze', 'silver')).toBe(true);
  });

  it('should validate silver→gold promotion order', () => {
    expect(registry.validatePromotionOrder('silver', 'gold')).toBe(true);
  });

  it('should reject bronze→gold (skip layer)', () => {
    expect(registry.validatePromotionOrder('bronze', 'gold')).toBe(false);
  });

  it('should reject gold→bronze (reverse)', () => {
    expect(registry.validatePromotionOrder('gold', 'bronze')).toBe(false);
  });

  it('should reject same-layer promotion', () => {
    expect(registry.validatePromotionOrder('silver', 'silver')).toBe(false);
  });

  it('should find adjacent layers for a table', () => {
    registry.register({
      layer: 'bronze',
      table: 'events',
      platform: 'iceberg',
      location: 'bronze_db.default.events',
    });
    registry.register({
      layer: 'silver',
      table: 'events',
      platform: 'iceberg',
      location: 'silver_db.default.events',
    });
    registry.register({
      layer: 'gold',
      table: 'events',
      platform: 'iceberg',
      location: 'gold_db.default.events',
    });

    const adj = registry.getAdjacentLayers('events');
    expect(adj.upstream).toBeDefined();
    expect(adj.downstream).toBeDefined();
  });

  it('should seed example tables', () => {
    registry.seed();
    const bronze = registry.getTablesInLayer('bronze');
    expect(bronze.length).toBeGreaterThanOrEqual(4);

    const silver = registry.getTablesInLayer('silver');
    expect(silver.length).toBeGreaterThanOrEqual(4);

    const gold = registry.getTablesInLayer('gold');
    expect(gold.length).toBeGreaterThanOrEqual(4);
  });
});

// ═════════════════════════════════════════════════════════════════════
// QualityGateEvaluator
// ═════════════════════════════════════════════════════════════════════

describe('QualityGateEvaluator', () => {
  let evaluator: QualityGateEvaluator;

  beforeEach(() => {
    evaluator = new QualityGateEvaluator();
  });

  it('should evaluate completeness — all non-null', () => {
    const data = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ];
    const gate: QualityGate = {
      name: 'completeness',
      dimension: 'completeness',
      threshold: 90,
      onFailure: 'block',
    };
    const results = evaluator.evaluateGates([gate], data);
    expect(results[0].score).toBe(100);
    expect(results[0].passed).toBe(true);
  });

  it('should evaluate completeness — with nulls', () => {
    const data = [
      { id: 1, name: 'a' },
      { id: 2, name: null },
      { id: null, name: 'c' },
    ];
    const gate: QualityGate = {
      name: 'completeness',
      dimension: 'completeness',
      threshold: 90,
      onFailure: 'block',
    };
    const results = evaluator.evaluateGates([gate], data);
    // 4 out of 6 cells are non-null = 66.7%
    expect(results[0].score).toBeCloseTo(66.67, 0);
    expect(results[0].passed).toBe(false);
  });

  it('should evaluate completeness — empty data returns 0', () => {
    const gate: QualityGate = {
      name: 'completeness',
      dimension: 'completeness',
      threshold: 50,
      onFailure: 'block',
    };
    const results = evaluator.evaluateGates([gate], []);
    expect(results[0].score).toBe(0);
    expect(results[0].passed).toBe(false);
  });

  it('should evaluate uniqueness — all unique', () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const gate: QualityGate = {
      name: 'unique-ids',
      dimension: 'uniqueness',
      threshold: 95,
      onFailure: 'block',
    };
    const results = evaluator.evaluateGates([gate], data);
    expect(results[0].score).toBe(100);
    expect(results[0].passed).toBe(true);
  });

  it('should evaluate uniqueness — with duplicates', () => {
    const data = [{ id: 1 }, { id: 1 }, { id: 2 }, { id: 3 }];
    const gate: QualityGate = {
      name: 'unique-ids',
      dimension: 'uniqueness',
      threshold: 95,
      onFailure: 'block',
    };
    const results = evaluator.evaluateGates([gate], data);
    // 3 unique out of 4 = 75%
    expect(results[0].score).toBe(75);
    expect(results[0].passed).toBe(false);
  });

  it('should evaluate freshness — recent data passes', () => {
    const data = [{ timestamp: Date.now() - 60000 }]; // 1 minute ago
    const gate: QualityGate = {
      name: 'fresh',
      dimension: 'freshness',
      threshold: 90,
      onFailure: 'alert',
    };
    const results = evaluator.evaluateGates([gate], data);
    expect(results[0].score).toBe(100);
    expect(results[0].passed).toBe(true);
  });

  it('should evaluate freshness — stale data fails', () => {
    const data = [{ timestamp: Date.now() - 48 * 60 * 60 * 1000 }]; // 48h ago
    const gate: QualityGate = {
      name: 'fresh',
      dimension: 'freshness',
      threshold: 90,
      onFailure: 'block',
    };
    const results = evaluator.evaluateGates([gate], data);
    expect(results[0].score).toBeLessThan(90);
    expect(results[0].passed).toBe(false);
  });

  it('should evaluate accuracy — valid data', () => {
    const data = [
      { id: 1, name: 'test', value: 42 },
      { id: 2, name: 'foo', value: 99 },
    ];
    const gate: QualityGate = {
      name: 'accuracy',
      dimension: 'accuracy',
      threshold: 90,
      onFailure: 'block',
    };
    const results = evaluator.evaluateGates([gate], data);
    expect(results[0].score).toBe(100);
    expect(results[0].passed).toBe(true);
  });

  it('should evaluate schema conformance — consistent schema', () => {
    const data = [
      { id: 1, name: 'a', value: 10 },
      { id: 2, name: 'b', value: 20 },
    ];
    const gate: QualityGate = {
      name: 'schema',
      dimension: 'schema_conformance',
      threshold: 100,
      onFailure: 'block',
    };
    const results = evaluator.evaluateGates([gate], data);
    expect(results[0].score).toBe(100);
    expect(results[0].passed).toBe(true);
  });

  it('should evaluate multiple gates at once', () => {
    const data = makeSampleData(5);
    const gates: QualityGate[] = [
      { name: 'complete', dimension: 'completeness', threshold: 90, onFailure: 'block' },
      { name: 'unique', dimension: 'uniqueness', threshold: 90, onFailure: 'block' },
    ];
    const results = evaluator.evaluateGates(gates, data);
    expect(results).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// MedallionCoordinator
// ═════════════════════════════════════════════════════════════════════

describe('MedallionCoordinator', () => {
  let coordinator: MedallionCoordinator;
  let registry: LayerRegistry;
  let adapter: IcebergMedallionAdapter;
  let lineageTracker: LineageTracker;
  let auditLog: AuditLog;

  beforeEach(() => {
    registry = new LayerRegistry();
    registry.seed();
    lineageTracker = new LineageTracker();
    auditLog = new AuditLog();
    coordinator = new MedallionCoordinator(registry, lineageTracker, auditLog);
    adapter = new IcebergMedallionAdapter();
  });

  it('should execute a successful bronze→silver promotion', async () => {
    const rule = makeRule();
    const result = await coordinator.executePromotion(rule, adapter);

    expect(result.status).toBe('success');
    expect(result.rowsPromoted).toBeGreaterThan(0);
    expect(result.lineageEdgeId).toBeDefined();
  });

  it('should fail on invalid promotion order', async () => {
    const rule = makeRule({ sourceLayer: 'gold', targetLayer: 'bronze' });
    const result = await coordinator.executePromotion(rule, adapter);

    expect(result.status).toBe('failed');
  });

  it('should fail when source table is not registered', async () => {
    const rule = makeRule({ sourceTable: 'nonexistent' });
    const result = await coordinator.executePromotion(rule, adapter);

    expect(result.status).toBe('failed');
  });

  it('should block promotion on quality gate failure', async () => {
    const rule = makeRule({
      qualityGates: [
        {
          name: 'completeness',
          dimension: 'completeness',
          threshold: 99,
          onFailure: 'block',
        },
      ],
    });

    const data = [
      { id: 1, name: null },
      { id: null, name: 'test' },
    ];

    const result = await coordinator.executePromotion(rule, adapter, data);
    expect(result.status).toBe('failed');
    expect(result.qualityResults.length).toBeGreaterThan(0);
  });

  it('should quarantine on quarantine gate failure', async () => {
    const rule = makeRule({
      qualityGates: [
        {
          name: 'completeness',
          dimension: 'completeness',
          threshold: 99,
          onFailure: 'quarantine',
        },
      ],
    });

    const data = [
      { id: 1, name: null },
      { id: null, name: 'test' },
    ];

    const result = await coordinator.executePromotion(rule, adapter, data);
    expect(result.status).toBe('quarantined');
  });

  it('should rollback a promotion', async () => {
    const rule = makeRule();
    const result = await coordinator.executePromotion(rule, adapter);

    await coordinator.rollback(result.promotionId, adapter);

    const entries = auditLog.getEntries({ action: 'rollback' });
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('should log audit entries for promotions', async () => {
    const rule = makeRule();
    await coordinator.executePromotion(rule, adapter);

    const entries = auditLog.getEntries({ action: 'promote' });
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].sourceLayer).toBe('bronze');
  });
});

// ═════════════════════════════════════════════════════════════════════
// PromotionEngine
// ═════════════════════════════════════════════════════════════════════

describe('PromotionEngine', () => {
  let engine: PromotionEngine;
  let registry: LayerRegistry;

  beforeEach(() => {
    registry = new LayerRegistry();
    registry.seed();
    engine = new PromotionEngine(registry);
  });

  it('should execute end-to-end promotion', async () => {
    const rule = makeRule();
    const result = await engine.promote(rule);

    expect(result.status).toBe('success');
    expect(result.promotionId).toBeDefined();
  });

  it('should reject invalid promotion order', async () => {
    const rule = makeRule({ sourceLayer: 'bronze', targetLayer: 'gold' });
    const result = await engine.promote(rule);

    expect(result.status).toBe('failed');
  });

  it('should perform a dry run without actual promotion', async () => {
    const rule = makeRule({
      qualityGates: [
        { name: 'complete', dimension: 'completeness', threshold: 50, onFailure: 'block' },
      ],
    });
    const data = makeSampleData(10);

    const dryResult = await engine.dryRun(rule, data);
    expect(dryResult.wouldPromote).toBe(true);
    expect(dryResult.qualityResults).toHaveLength(1);
    expect(dryResult.validationErrors).toHaveLength(0);
  });

  it('should dry-run catch validation errors', async () => {
    const rule = makeRule({ sourceLayer: 'gold', targetLayer: 'bronze' });
    const dryResult = await engine.dryRun(rule);

    expect(dryResult.wouldPromote).toBe(false);
    expect(dryResult.validationErrors.length).toBeGreaterThan(0);
  });

  it('should track lineage after promotion', async () => {
    const rule = makeRule();
    await engine.promote(rule);

    const tracker = engine.getLineageTracker();
    const history = tracker.getPromotionHistory('events');
    expect(history.length).toBeGreaterThan(0);
  });

  it('should log audit after promotion', async () => {
    const rule = makeRule();
    await engine.promote(rule);

    const log = engine.getAuditLog();
    const entries = log.getEntries({ action: 'promote' });
    expect(entries.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SchemaDriftHealer
// ═════════════════════════════════════════════════════════════════════

describe('SchemaDriftHealer', () => {
  let healer: SchemaDriftHealer;

  beforeEach(() => {
    healer = new SchemaDriftHealer();
  });

  it('should detect added columns', () => {
    const source: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'name', type: 'string', nullable: true },
      { name: 'email', type: 'string', nullable: true },
    ];
    const target: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'name', type: 'string', nullable: true },
    ];

    const drifts = healer.detectDrift(source, target);
    const added = drifts.filter((d) => d.kind === 'column_added');
    expect(added).toHaveLength(1);
    expect(added[0].column).toBe('email');
    expect(added[0].autoHealable).toBe(true);
  });

  it('should detect removed columns', () => {
    const source: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
    ];
    const target: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'deleted_col', type: 'string', nullable: true },
    ];

    const drifts = healer.detectDrift(source, target);
    const removed = drifts.filter((d) => d.kind === 'column_removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].column).toBe('deleted_col');
    expect(removed[0].autoHealable).toBe(false);
  });

  it('should detect type widening (safe)', () => {
    const source: ColumnDef[] = [
      { name: 'count', type: 'bigint', nullable: false },
    ];
    const target: ColumnDef[] = [
      { name: 'count', type: 'int', nullable: false },
    ];

    const drifts = healer.detectDrift(source, target);
    const widened = drifts.filter((d) => d.kind === 'type_widened');
    expect(widened).toHaveLength(1);
    expect(widened[0].autoHealable).toBe(true);
  });

  it('should detect type narrowing (breaking)', () => {
    const source: ColumnDef[] = [
      { name: 'count', type: 'int', nullable: false },
    ];
    const target: ColumnDef[] = [
      { name: 'count', type: 'bigint', nullable: false },
    ];

    const drifts = healer.detectDrift(source, target);
    const narrowed = drifts.filter((d) => d.kind === 'type_narrowed');
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0].autoHealable).toBe(false);
  });

  it('should detect nullable changes', () => {
    const source: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: true },
    ];
    const target: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
    ];

    const drifts = healer.detectDrift(source, target);
    const nullable = drifts.filter((d) => d.kind === 'nullable_changed');
    expect(nullable).toHaveLength(1);
  });

  it('should auto-heal healable drifts', () => {
    const source: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'email', type: 'string', nullable: true },
      { name: 'count', type: 'bigint', nullable: false },
    ];
    const target: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'count', type: 'int', nullable: false },
    ];

    const drifts = healer.detectDrift(source, target);
    const result = healer.autoHeal(drifts);

    expect(result.healed.length).toBeGreaterThan(0);
    expect(result.migrations.length).toBeGreaterThan(0);
  });

  it('should report unhealed drifts for breaking changes', () => {
    const source: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
    ];
    const target: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'removed', type: 'string', nullable: true },
    ];

    const drifts = healer.detectDrift(source, target);
    const result = healer.autoHeal(drifts);

    expect(result.unhealed).toHaveLength(1);
    expect(result.unhealed[0].kind).toBe('column_removed');
  });

  it('should return no drifts for identical schemas', () => {
    const schema: ColumnDef[] = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'name', type: 'string', nullable: true },
    ];

    const drifts = healer.detectDrift(schema, schema);
    expect(drifts).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GoldPromoter
// ═════════════════════════════════════════════════════════════════════

describe('GoldPromoter', () => {
  let promoter: GoldPromoter;

  beforeEach(() => {
    promoter = new GoldPromoter();
  });

  it('should build aggregation transform steps', () => {
    const steps = promoter.buildAggregation({
      dimensions: ['category', 'region'],
      measures: [
        { column: 'revenue', function: 'SUM', alias: 'total_revenue' },
        { column: 'orders', function: 'COUNT', alias: 'order_count' },
      ],
    });

    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps[0].type).toBe('aggregate');
    expect(steps[0].config['dimensions']).toEqual(['category', 'region']);
  });

  it('should build join transform steps', () => {
    const steps = promoter.buildJoin({
      leftTable: 'orders',
      rightTable: 'customers',
      joinType: 'inner',
      joinKeys: [{ left: 'customer_id', right: 'id' }],
      selectColumns: ['order_id', 'customer_name', 'total'],
    });

    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps[0].type).toBe('join');
    expect(steps[0].config['joinType']).toBe('inner');
  });

  it('should add dedup step after join', () => {
    const steps = promoter.buildJoin({
      leftTable: 'a',
      rightTable: 'b',
      joinType: 'left',
      joinKeys: [{ left: 'id', right: 'id' }],
      selectColumns: ['id', 'value'],
    });

    const dedupStep = steps.find((s) => s.type === 'deduplicate');
    expect(dedupStep).toBeDefined();
  });

  it('should build feature engineering transforms', () => {
    const steps = promoter.buildFeatureEngineering([
      { name: 'revenue_per_order', expression: 'revenue / order_count', type: 'double' },
      { name: 'is_high_value', expression: 'revenue > 1000', type: 'boolean' },
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0].type).toBe('custom');
    expect(steps[0].config['outputColumn']).toBe('revenue_per_order');
  });
});

// ═════════════════════════════════════════════════════════════════════
// LineageTracker
// ═════════════════════════════════════════════════════════════════════

describe('LineageTracker', () => {
  let tracker: LineageTracker;

  beforeEach(() => {
    tracker = new LineageTracker();
  });

  it('should track a promotion and return edge ID', () => {
    const rule = makeRule();
    const result = {
      promotionId: 'promo-1',
      rule,
      status: 'success' as const,
      rowsProcessed: 1000,
      rowsPromoted: 980,
      rowsQuarantined: 20,
      qualityResults: [],
      durationMs: 500,
      timestamp: Date.now(),
    };

    const edgeId = tracker.trackPromotion(result);
    expect(edgeId).toBeDefined();
    expect(edgeId).toContain('lineage_');
  });

  it('should retrieve promotion history for a table', () => {
    const rule = makeRule();
    tracker.trackPromotion({
      promotionId: 'promo-1',
      rule,
      status: 'success',
      rowsProcessed: 1000,
      rowsPromoted: 980,
      rowsQuarantined: 20,
      qualityResults: [],
      durationMs: 500,
      timestamp: Date.now(),
    });

    const history = tracker.getPromotionHistory('events');
    expect(history).toHaveLength(1);
    expect(history[0].promotionId).toBe('promo-1');
  });

  it('should trace gold table back to source', () => {
    // Track bronze→silver
    tracker.trackPromotion({
      promotionId: 'promo-b2s',
      rule: makeRule({ sourceLayer: 'bronze', targetLayer: 'silver' }),
      status: 'success',
      rowsProcessed: 1000,
      rowsPromoted: 980,
      rowsQuarantined: 20,
      qualityResults: [],
      durationMs: 500,
      timestamp: Date.now(),
    });

    // Track silver→gold
    tracker.trackPromotion({
      promotionId: 'promo-s2g',
      rule: makeRule({ sourceLayer: 'silver', targetLayer: 'gold' }),
      status: 'success',
      rowsProcessed: 980,
      rowsPromoted: 970,
      rowsQuarantined: 10,
      qualityResults: [],
      durationMs: 300,
      timestamp: Date.now(),
    });

    const trace = tracker.traceGoldToSource('events');
    expect(trace.length).toBeGreaterThanOrEqual(2);
    expect(trace.some((t) => t.layer === 'gold')).toBe(true);
    expect(trace.some((t) => t.layer === 'silver')).toBe(true);
  });

  it('should return all lineage edges', () => {
    tracker.trackPromotion({
      promotionId: 'promo-1',
      rule: makeRule(),
      status: 'success',
      rowsProcessed: 100,
      rowsPromoted: 100,
      rowsQuarantined: 0,
      qualityResults: [],
      durationMs: 100,
      timestamp: Date.now(),
    });

    const edges = tracker.getEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceLayer).toBe('bronze');
    expect(edges[0].targetLayer).toBe('silver');
  });
});

// ═════════════════════════════════════════════════════════════════════
// RetentionManager
// ═════════════════════════════════════════════════════════════════════

describe('RetentionManager', () => {
  let manager: RetentionManager;

  beforeEach(() => {
    manager = new RetentionManager();
  });

  it('should return default policy for bronze (90 days)', () => {
    const policy = manager.getDefaultPolicy('bronze');
    expect(policy.retentionDays).toBe(90);
    expect(policy.compactionIntervalHours).toBe(6);
  });

  it('should return default policy for silver (365 days)', () => {
    const policy = manager.getDefaultPolicy('silver');
    expect(policy.retentionDays).toBe(365);
    expect(policy.compactionIntervalHours).toBe(12);
  });

  it('should return default policy for gold (indefinite)', () => {
    const policy = manager.getDefaultPolicy('gold');
    expect(policy.retentionDays).toBe(-1);
    expect(policy.compactionIntervalHours).toBe(168);
  });

  it('should apply retention and return result', () => {
    const policy = manager.getDefaultPolicy('bronze');
    const result = manager.applyRetention(policy);

    expect(result.layer).toBe('bronze');
    expect(result.rowsPurged).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('should not purge rows for indefinite retention', () => {
    const policy = manager.getDefaultPolicy('gold');
    const result = manager.applyRetention(policy);

    expect(result.rowsPurged).toBe(0);
  });

  it('should compact a table', () => {
    const result = manager.compact('bronze', 'events');

    expect(result.layer).toBe('bronze');
    expect(result.table).toBe('events');
    expect(result.filesCompacted).toBeGreaterThan(0);
    expect(result.bytesReclaimed).toBeGreaterThan(0);
  });

  it('should allow custom policy override', () => {
    manager.setPolicy({
      layer: 'bronze',
      table: 'events',
      retentionDays: 30,
      compactionEnabled: true,
      compactionIntervalHours: 1,
    });

    const policy = manager.getPolicy('bronze', 'events');
    expect(policy.retentionDays).toBe(30);
    expect(policy.compactionIntervalHours).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// RBACEnforcer
// ═════════════════════════════════════════════════════════════════════

describe('RBACEnforcer', () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = new RBACEnforcer();
  });

  it('should grant access when permission exists', () => {
    enforcer.addPermission({
      role: 'engineer',
      layer: 'bronze',
      actions: ['read', 'write', 'promote'],
    });

    expect(enforcer.checkAccess('engineer', 'bronze', 'read')).toBe(true);
    expect(enforcer.checkAccess('engineer', 'bronze', 'promote')).toBe(true);
  });

  it('should deny access when permission is missing', () => {
    enforcer.addPermission({
      role: 'viewer',
      layer: 'bronze',
      actions: ['read'],
    });

    expect(enforcer.checkAccess('viewer', 'bronze', 'write')).toBe(false);
    expect(enforcer.checkAccess('viewer', 'bronze', 'promote')).toBe(false);
  });

  it('should deny access for unknown roles', () => {
    expect(enforcer.checkAccess('unknown', 'bronze', 'read')).toBe(false);
  });

  it('should seed default roles correctly', () => {
    enforcer.seed();

    // Admin has full access everywhere
    expect(enforcer.checkAccess('admin', 'bronze', 'admin')).toBe(true);
    expect(enforcer.checkAccess('admin', 'gold', 'promote')).toBe(true);

    // Engineer can promote but not admin gold
    expect(enforcer.checkAccess('engineer', 'silver', 'promote')).toBe(true);
    expect(enforcer.checkAccess('engineer', 'gold', 'admin')).toBe(false);

    // Analyst can read all, write gold
    expect(enforcer.checkAccess('analyst', 'bronze', 'read')).toBe(true);
    expect(enforcer.checkAccess('analyst', 'gold', 'write')).toBe(true);
    expect(enforcer.checkAccess('analyst', 'bronze', 'write')).toBe(false);

    // Viewer is read-only
    expect(enforcer.checkAccess('viewer', 'silver', 'read')).toBe(true);
    expect(enforcer.checkAccess('viewer', 'silver', 'write')).toBe(false);
  });

  it('should return permissions for a role', () => {
    enforcer.seed();
    const perms = enforcer.getPermissions('admin');
    expect(perms.length).toBe(3); // one per layer
  });
});

// ═════════════════════════════════════════════════════════════════════
// AuditLog
// ═════════════════════════════════════════════════════════════════════

describe('AuditLog', () => {
  let log: AuditLog;

  beforeEach(() => {
    log = new AuditLog();
  });

  it('should log and retrieve entries', () => {
    log.log({
      id: 'audit-1',
      timestamp: Date.now(),
      action: 'promote',
      actor: 'system',
      sourceLayer: 'bronze',
      targetLayer: 'silver',
      table: 'events',
      details: { rowsPromoted: 1000 },
    });

    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('promote');
  });

  it('should filter by layer', () => {
    log.log({
      id: 'audit-1',
      timestamp: Date.now(),
      action: 'promote',
      actor: 'system',
      sourceLayer: 'bronze',
      table: 'events',
      details: {},
    });
    log.log({
      id: 'audit-2',
      timestamp: Date.now(),
      action: 'compact',
      actor: 'system',
      sourceLayer: 'silver',
      table: 'events',
      details: {},
    });

    const bronzeEntries = log.getEntries({ layer: 'bronze' });
    expect(bronzeEntries).toHaveLength(1);
  });

  it('should filter by action', () => {
    log.log({
      id: 'audit-1',
      timestamp: Date.now(),
      action: 'promote',
      actor: 'system',
      sourceLayer: 'bronze',
      table: 'events',
      details: {},
    });
    log.log({
      id: 'audit-2',
      timestamp: Date.now(),
      action: 'rollback',
      actor: 'system',
      sourceLayer: 'bronze',
      table: 'events',
      details: {},
    });

    const rollbacks = log.getEntries({ action: 'rollback' });
    expect(rollbacks).toHaveLength(1);
    expect(rollbacks[0].id).toBe('audit-2');
  });

  it('should filter by timestamp', () => {
    const now = Date.now();
    log.log({
      id: 'old',
      timestamp: now - 100000,
      action: 'promote',
      actor: 'system',
      sourceLayer: 'bronze',
      table: 'events',
      details: {},
    });
    log.log({
      id: 'new',
      timestamp: now,
      action: 'promote',
      actor: 'system',
      sourceLayer: 'bronze',
      table: 'events',
      details: {},
    });

    const recent = log.getEntries({ since: now - 50000 });
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe('new');
  });

  it('should clear entries', () => {
    log.log({
      id: 'audit-1',
      timestamp: Date.now(),
      action: 'promote',
      actor: 'system',
      sourceLayer: 'bronze',
      table: 'events',
      details: {},
    });

    log.clear();
    expect(log.getEntries()).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Platform Adapters (, )
// ═════════════════════════════════════════════════════════════════════

describe('Platform Adapters', () => {
  it('IcebergMedallionAdapter resolves location correctly', () => {
    const adapter = new IcebergMedallionAdapter();
    expect(adapter.resolveLayerLocation('bronze', 'events')).toBe(
      'bronze_db.default.events'
    );
    expect(adapter.name).toBe('iceberg');
  });

  it('IcebergMedallionAdapter executes promotion', async () => {
    const adapter = new IcebergMedallionAdapter();
    const result = await adapter.executePromotion(makeRule());
    expect(result.status).toBe('success');
    expect(result.rowsProcessed).toBeGreaterThan(0);
  });

  it('SnowflakeMedallionAdapter resolves location correctly', () => {
    const adapter = new SnowflakeMedallionAdapter();
    expect(adapter.resolveLayerLocation('silver', 'orders')).toBe(
      'SILVER_DB.PUBLIC.ORDERS'
    );
  });

  it('DatabricksMedallionAdapter resolves location correctly', () => {
    const adapter = new DatabricksMedallionAdapter();
    expect(adapter.resolveLayerLocation('gold', 'metrics')).toBe(
      'gold_catalog.default.metrics'
    );
  });

  it('BigQueryMedallionAdapter resolves location correctly', () => {
    const adapter = new BigQueryMedallionAdapter();
    expect(adapter.resolveLayerLocation('bronze', 'raw_events')).toBe(
      'project.bronze_dataset.raw_events'
    );
  });

  it('DbtMedallionAdapter resolves as dbt ref', () => {
    const adapter = new DbtMedallionAdapter();
    expect(adapter.resolveLayerLocation('silver', 'clean_events')).toBe(
      "{{ ref('silver_clean_events') }}"
    );
  });

  it('All adapters implement executePromotion', async () => {
    const adapters = [
      new SnowflakeMedallionAdapter(),
      new DatabricksMedallionAdapter(),
      new BigQueryMedallionAdapter(),
      new DbtMedallionAdapter(),
    ];
    const rule = makeRule();

    for (const adapter of adapters) {
      const result = await adapter.executePromotion(rule);
      expect(result.status).toBe('success');
      expect(result.promotionId).toContain(`promo_${adapter.name}`);
    }
  });
});
