/**
 * @data-workers/medallion
 *
 * Medallion Architecture — autonomous Bronze→Silver→Gold lakehouse management.
 * Core library that orchestrates layer promotion, quality gates,
 * schema healing, lineage tracking, and retention management.
 */

// ─── Types ───────────────────────────────────────────────────────────
export type {
  MedallionLayer,
  LayerMapping,
  PromotionRule,
  TransformStep,
  QualityGate,
  QualityGateResult,
  PromotionResult,
  MedallionPlatformAdapter,
  RetentionPolicy,
  RetentionResult,
  CompactionResult,
  AuditEntry,
  RBACPermission,
  ColumnDef,
  SchemaDrift,
  HealResult,
  AggregationConfig,
  JoinConfig,
  LineageEdge,
} from './types.js';

// ─── Core Components ─────────────────────────────────────────────────
export { LayerRegistry } from './layer-registry.js';
export { QualityGateEvaluator } from './quality-gate-evaluator.js';
export { MedallionCoordinator } from './medallion-coordinator.js';
export { PromotionEngine } from './promotion-engine.js';

// ─── Adapters ────────────────────────────────────────────────────────
export { IcebergMedallionAdapter } from './iceberg-adapter.js';
export {
  SnowflakeMedallionAdapter,
  DatabricksMedallionAdapter,
  BigQueryMedallionAdapter,
  DbtMedallionAdapter,
} from './platform-adapters.js';

// ─── Schema & Data Management ────────────────────────────────────────
export { SchemaDriftHealer } from './schema-drift-healer.js';
export { GoldPromoter } from './gold-promoter.js';
export { LineageTracker } from './lineage-tracker.js';
export { RetentionManager } from './retention-manager.js';

// ─── Security & Audit ────────────────────────────────────────────────
export { AuditLog, RBACEnforcer } from './rbac-audit.js';
