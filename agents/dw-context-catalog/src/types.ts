/**
 * Type definitions for the Data Context & Catalog Agent.
 */

export interface DataAsset {
  id: string;
  customerId: string;
  name: string;
  type: AssetType;
  platform: string;
  database?: string;
  schema?: string;
  description: string;
  columns?: ColumnInfo[];
  tags: string[];
  owner?: string;
  qualityScore: number;
  freshnessScore: number;
  lastUpdated: number;
  lastCrawled: number;
  metadata: Record<string, unknown>;
}

export type AssetType = 'table' | 'view' | 'model' | 'pipeline' | 'dashboard' | 'metric' | 'source';

export interface ColumnInfo {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  tags: string[];
}

export interface SearchResult {
  asset: DataAsset;
  relevanceScore: number;
  matchedFields: string[];
}

export interface LineageResult {
  assetId: string;
  upstream: LineageNode[];
  downstream: LineageNode[];
  columnLineage?: ColumnLineage[];
  depth: number;
}

export interface LineageNode {
  id: string;
  name: string;
  type: AssetType;
  platform: string;
  relationship: 'derives_from' | 'consumed_by' | 'transforms';
  depth: number;
}

export interface ColumnLineage {
  sourceColumn: string;
  sourceTable: string;
  targetColumn: string;
  targetTable: string;
  transformation?: string;
}

export interface MetricDefinition {
  id: string;
  name: string;
  canonicalName: string;
  description: string;
  formula: string;
  source: string;
  domain: string;
  aliases: string[];
  owner?: string;
}

export interface SemanticDefinition {
  id: string;
  name: string;
  type: 'metric' | 'dimension' | 'entity';
  definition: string;
  source: 'dbt' | 'looker' | 'cube' | 'custom';
  domain: string;
  metadata: Record<string, unknown>;
}

export interface Documentation {
  assetId: string;
  assetName: string;
  description: string;
  columns?: Array<{ name: string; description: string; type: string }>;
  lineageSummary: string;
  usageStats: { queryCount30d: number; uniqueUsers30d: number };
  qualityScore: number;
  freshnessInfo: FreshnessInfo;
  generatedAt: number;
  confidence: number;
}

export interface FreshnessInfo {
  lastUpdated: number;
  freshnessScore: number;
  slaTarget?: number;
  slaCompliant: boolean;
  staleSince?: number;
}

/** Source provenance for a documentation section. */
export type DocumentationSourceType =
  | 'snowflake_comment'
  | 'dbt_description'
  | 'pattern_match'
  | 'graph_inference'
  | 'connector_metadata';

/** A single documentation section with provenance tracking. */
export interface DocumentationSection {
  content: string;
  source: DocumentationSourceType;
  confidence: number;
}

/** Documentation with full provenance tracking. */
export interface DocumentationWithProvenance extends Documentation {
  provenance?: {
    description?: DocumentationSection;
    columns?: Array<{ name: string; description: string; type: string; source: DocumentationSourceType; confidence: number }>;
    lineageSummary?: DocumentationSection;
  };
  connectorSources?: string[];
}

// ── Context Intelligence types ──

/** Condition under which a business rule applies. */
export interface ApplicabilityCondition {
  field?: string;
  operator?: string;
  value?: unknown;
}

/** Authority level for an asset or business rule. */
export type AuthorityLevel = 'canonical' | 'authoritative' | 'derived' | 'deprecated';

/** Trust flag for context endorsement/warning. */
export type TrustFlag = 'endorsed' | 'warned' | 'deprecated';

/** A business rule attached to a data asset or column. */
export interface BusinessRule {
  id?: string;
  customerId?: string;
  assetId?: string;
  columnName?: string;
  ruleType?: string;
  content?: string;
  author?: string;
  confidence?: number;
  source?: string;
  conditions?: ApplicabilityCondition[];
  createdAt?: number;
  lastConfirmedAt?: number;
  deprecated?: boolean;
}

/** User feedback on context or documentation quality. */
export interface ContextFeedback {
  id?: string;
  assetId?: string;
  userId?: string;
  feedbackType?: string;
  content?: string;
  timestamp?: number;
}

/** Query history signal for an asset (usage analytics). */
export interface QueryHistorySignal {
  assetId?: string;
  queryCount?: number;
  uniqueUsers?: number;
  lastQueried?: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
}

/** Staleness assessment for an asset. */
export interface StalenessAssessment {
  assetId?: string;
  freshnessScore?: number;
  lastUpdated?: number;
  isStale?: boolean;
  staleSince?: number;
}
