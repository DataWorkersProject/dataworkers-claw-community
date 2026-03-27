/**
 * Shared connector context types used across agents for cross-agent communication.
 * Canonical definitions for connector metadata, column schemas, and table context.
 */

/**
 * Metadata for a single column in a table schema.
 */
export interface ColumnMetadata {
  name: string;
  type: string;
  nullable?: boolean;
  description?: string;
}

/**
 * Context resolved from a connector (Iceberg, Polaris, or any catalog).
 * Used by pipeline, schema, catalog, and quality agents for cross-agent data exchange.
 */
export interface ConnectorContext {
  connectorType: 'iceberg' | 'polaris' | string;
  catalog?: string;
  namespace: string;
  table: string;
  columns?: ColumnMetadata[];
  partitionSpec?: Array<{ sourceId: number; fieldName: string; transform: string }>;
  permissions?: { allowed: boolean; reason: string };
  statistics?: { recordCount: number; fileSizeBytes: number; fileCount: number };
  seedFallback?: boolean;
}

/**
 * Payload for cross-agent schema compatibility checks.
 */
export interface SchemaCompatibilityRequest {
  sourceColumns: Array<{ name: string; type: string }>;
  targetTable: string;
  customerId: string;
}

/**
 * Result of a cross-agent schema compatibility check.
 */
export interface SchemaCompatibilityResult {
  compatible: boolean;
  breakingChanges: Array<{
    column: string;
    issue: string;
    sourceType: string;
    targetType?: string;
  }>;
  suggestedMigrations: string[];
}

/**
 * Payload for cross-agent pipeline asset registration.
 */
export interface PipelineAssetRegistration {
  pipelineId: string;
  name: string;
  sources: Array<{ platform: string; table: string }>;
  targets: Array<{ platform: string; table: string }>;
  owner?: string;
  schedule?: string;
  customerId: string;
}
