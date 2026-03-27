/**
 * @data-workers/medallion — Types
 *
 * All types and interfaces for the Medallion Architecture package.
 * Core type definitions for Bronze→Silver→Gold lakehouse management.
 */

// ─── Layer Primitives ────────────────────────────────────────────────

export type MedallionLayer = 'bronze' | 'silver' | 'gold';

export interface LayerMapping {
  layer: MedallionLayer;
  table: string;
  platform: string;
  location: string; // Fully qualified: db.schema.table
  partitionKeys?: string[];
  clusterKeys?: string[];
}

// ─── Promotion Rules & Transforms ────────────────────────────────────

export interface PromotionRule {
  id: string;
  name: string;
  sourceLayer: MedallionLayer;
  targetLayer: MedallionLayer;
  sourceTable: string;
  targetTable: string;
  transforms: TransformStep[];
  qualityGates: QualityGate[];
  schedule?: string; // cron expression
  enabled: boolean;
}

export interface TransformStep {
  type:
    | 'deduplicate'
    | 'typecast'
    | 'null_handle'
    | 'pii_mask'
    | 'aggregate'
    | 'join'
    | 'filter'
    | 'rename'
    | 'custom';
  config: Record<string, unknown>;
}

// ─── Quality Gates ───────────────────────────────────────────────────

export interface QualityGate {
  name: string;
  dimension:
    | 'completeness'
    | 'uniqueness'
    | 'freshness'
    | 'accuracy'
    | 'schema_conformance';
  threshold: number; // 0-100
  onFailure: 'block' | 'quarantine' | 'alert';
}

export interface QualityGateResult {
  gate: QualityGate;
  score: number;
  passed: boolean;
  details: string;
}

// ─── Promotion Results ───────────────────────────────────────────────

export interface PromotionResult {
  promotionId: string;
  rule: PromotionRule;
  status: 'success' | 'failed' | 'quarantined' | 'rolled_back';
  rowsProcessed: number;
  rowsPromoted: number;
  rowsQuarantined: number;
  qualityResults: QualityGateResult[];
  durationMs: number;
  timestamp: number;
  lineageEdgeId?: string;
}

// ─── Platform Adapter ────────────────────────────────────────────────

export interface MedallionPlatformAdapter {
  name: string;
  resolveLayerLocation(layer: MedallionLayer, table: string): string;
  executePromotion(rule: PromotionRule): Promise<PromotionResult>;
  rollbackPromotion(promotionId: string): Promise<void>;
  compact(layer: MedallionLayer, table: string): Promise<void>;
}

// ─── Retention ───────────────────────────────────────────────────────

export interface RetentionPolicy {
  layer: MedallionLayer;
  table: string;
  retentionDays: number;
  compactionEnabled: boolean;
  compactionIntervalHours: number;
}

export interface RetentionResult {
  layer: MedallionLayer;
  table: string;
  rowsPurged: number;
  bytesFreed: number;
  timestamp: number;
}

export interface CompactionResult {
  layer: MedallionLayer;
  table: string;
  filesCompacted: number;
  bytesReclaimed: number;
  timestamp: number;
}

// ─── Audit & RBAC ────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: number;
  action: 'promote' | 'rollback' | 'quarantine' | 'compact' | 'retention_purge';
  actor: string;
  sourceLayer: MedallionLayer;
  targetLayer?: MedallionLayer;
  table: string;
  details: Record<string, unknown>;
}

export interface RBACPermission {
  role: string;
  layer: MedallionLayer;
  actions: Array<'read' | 'write' | 'promote' | 'rollback' | 'admin'>;
}

// ─── Schema Drift ────────────────────────────────────────────────────

export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
}

export interface SchemaDrift {
  kind: 'column_added' | 'column_removed' | 'type_widened' | 'type_narrowed' | 'nullable_changed';
  column: string;
  sourceType?: string;
  targetType?: string;
  autoHealable: boolean;
  suggestedAction: string;
}

export interface HealResult {
  healed: SchemaDrift[];
  unhealed: SchemaDrift[];
  migrations: string[];
}

// ─── Gold Promoter ───────────────────────────────────────────────────

export interface AggregationConfig {
  dimensions: string[];
  measures: Array<{
    column: string;
    function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
    alias: string;
  }>;
}

export interface JoinConfig {
  leftTable: string;
  rightTable: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  joinKeys: Array<{ left: string; right: string }>;
  selectColumns: string[];
}

// ─── Lineage ─────────────────────────────────────────────────────────

export interface LineageEdge {
  id: string;
  sourceLayer: MedallionLayer;
  sourceTable: string;
  targetLayer: MedallionLayer;
  targetTable: string;
  promotionId: string;
  timestamp: number;
}
