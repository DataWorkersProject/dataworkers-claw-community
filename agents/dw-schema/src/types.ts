/**
 * Type definitions for the Schema Evolution Agent.
 */

export type ChangeType = 'column_added' | 'column_removed' | 'column_type_changed' | 'column_renamed' | 'table_created' | 'table_dropped' | 'constraint_added' | 'constraint_removed' | 'index_changed';
export type ChangeSeverity = 'breaking' | 'non-breaking' | 'warning';
export type MigrationStatus = 'pending' | 'validated' | 'deploying' | 'deployed' | 'rolled_back' | 'failed';
export type DetectionMethod = 'information_schema' | 'schema_registry' | 'git_webhook' | 'iceberg_snapshot';
export type ValidationKind = 'syntax_check' | 'dry_run' | 'schema_match' | 'constraint_check';

/**
 * Migration event types for cross-agent communication via message bus.
 */
export type MigrationEventType =
  | 'migration.generated'
  | 'migration.validated'
  | 'migration.applied'
  | 'migration.rolled_back'
  | 'migration.failed'
  | 'schema.change.detected'
  | 'schema.impact.assessed';

export interface SchemaChange {
  id: string;
  customerId: string;
  source: string;
  database: string;
  schema: string;
  table: string;
  changeType: ChangeType;
  severity: ChangeSeverity;
  details: {
    column?: string;
    oldType?: string;
    newType?: string;
    oldName?: string;
    newName?: string;
  };
  detectedAt: number;
  detectedVia: DetectionMethod;
  /** Confidence score for rename detection (0-1). Present when changeType is 'column_renamed'. */
  confidence?: number;
}

export interface ImpactAnalysis {
  changeId: string;
  affectedEntities: AffectedEntity[];
  totalImpact: number;
  breakingDownstream: number;
  recommendations: string[];
  analysisTimeMs: number;
  /** True when lineage traversal hit the maxDepth limit and results may be incomplete. */
  maxDepthReached: boolean;
}

export interface AffectedEntity {
  id: string;
  name: string;
  type: 'pipeline' | 'view' | 'table' | 'dashboard' | 'ml_model' | 'api' | 'dbt_model';
  impact: 'direct' | 'indirect';
  severity: ChangeSeverity;
  requiredAction: string;
}

export interface MigrationScript {
  id: string;
  changeId: string;
  customerId: string;
  status: MigrationStatus;
  forwardSql: string;
  rollbackSql: string;
  affectedSystems: string[];
  backwardCompatible: boolean;
  validatedAt?: number;
  deployedAt?: number;
  /** The validation types that were performed. */
  validationTypes?: ValidationKind[];
  /** Effort estimate in hours for this migration. */
  estimatedEffortHours?: number;
}

export interface DeploymentResult {
  migrationId: string;
  success: boolean;
  strategy: 'blue_green' | 'rolling' | 'immediate';
  deployedAt?: number;
  rollbackAvailable: boolean;
  downstreamNotified: string[];
  error?: string;
}

/**
 * Schema snapshot metadata for the get_schema_snapshot tool.
 */
export interface SchemaSnapshot {
  customerId: string;
  source: string;
  database: string;
  schema: string;
  table: string;
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  capturedAt: number;
}

/**
 * Configuration for the schema agent, loaded from environment variables with defaults.
 */
export interface SchemaAgentConfig {
  /** Max lineage traversal depth for assess_impact. Default: 5 */
  maxImpactDepth: number;
  /** Snapshot cache TTL in milliseconds. Default: 86400000 (24h) */
  snapshotCacheTtlMs: number;
  /** Max entries in the snapshot cache before LRU eviction. Default: 10000 */
  snapshotCacheMaxEntries: number;
  /** Default deployment strategy. Default: 'blue_green' */
  defaultDeployStrategy: 'blue_green' | 'rolling' | 'immediate';
  /** Levenshtein distance threshold for rename detection. Default: 3 */
  renameDistanceThreshold: number;
  /** Minimum confidence for rename detection (0-1). Default: 0.5 */
  renameMinConfidence: number;
  /** SQL translate cache max entries. Default: 1000 */
  translateCacheMaxEntries: number;
}

/**
 * Load schema agent config from env vars with sensible defaults.
 */
export function loadSchemaAgentConfig(): SchemaAgentConfig {
  return {
    maxImpactDepth: parseInt(process.env.SCHEMA_MAX_IMPACT_DEPTH ?? '5', 10),
    snapshotCacheTtlMs: parseInt(process.env.SCHEMA_SNAPSHOT_CACHE_TTL_MS ?? '86400000', 10),
    snapshotCacheMaxEntries: parseInt(process.env.SCHEMA_SNAPSHOT_CACHE_MAX_ENTRIES ?? '10000', 10),
    defaultDeployStrategy: (process.env.SCHEMA_DEFAULT_DEPLOY_STRATEGY as SchemaAgentConfig['defaultDeployStrategy']) ?? 'blue_green',
    renameDistanceThreshold: parseInt(process.env.SCHEMA_RENAME_DISTANCE_THRESHOLD ?? '3', 10),
    renameMinConfidence: parseFloat(process.env.SCHEMA_RENAME_MIN_CONFIDENCE ?? '0.5'),
    translateCacheMaxEntries: parseInt(process.env.SCHEMA_TRANSLATE_CACHE_MAX_ENTRIES ?? '1000', 10),
  };
}
