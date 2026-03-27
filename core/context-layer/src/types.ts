/**
 * Type definitions for the cross-agent context layer.
 * Covers Redis (REQ-CTX-001 through REQ-CTX-005, REQ-CTX-016)
 * and Kafka (REQ-CTX-006 through REQ-CTX-008, REQ-CTX-013, REQ-CTX-017).
 */

// ── Configuration ──

export interface ContextLayerConfig {
  redis: RedisConfig;
  kafka: KafkaConfig;
}

export interface RedisConfig {
  /** Redis Cluster nodes (min 6: 3 primary + 3 replica) */
  nodes: Array<{ host: string; port: number }>;
  /** Key prefix for tenant isolation. Default: 'customer' */
  keyPrefix: string;
  /** Default TTL in seconds. Default: 86400 (24h) per REQ-CTX-001 */
  ttlSeconds: number;
  /** Checkpoint interval in ms. Default: 30000 (30s) per REQ-CTX-002 */
  checkpointIntervalMs: number;
  /** Password for Redis AUTH */
  password?: string;
  /** Failover buffer timeout in ms. Default: 60000 (60s) per REQ-CTX-003 */
  failoverBufferMs: number;
}

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

// ── Context Entries ──

export interface ContextEntry {
  key: string;
  value: unknown;
  customerId: string;
  agentId: string;
  timestamp: number;
  ttlSeconds?: number;
}

// ── Event Messages ──

export type EventType =
  | 'schema_changed'
  | 'quality_alert'
  | 'pipeline_completed'
  | 'access_granted'
  | 'incident_detected'
  | 'agent_spawned'
  | 'agent_retired'
  | 'stream_configured'
  | 'stream_health_changed'
  | 'sla_breached'
  | 'connector_status_changed'
  | 'tool_invoked'
  | 'usage_anomaly_detected'
  | 'adoption_changed'
  | 'unused_data_found'
  | 'archival_recommended'
  | 'savings_opportunity'
  | 'governance_policy_violated'
  | 'governance_review_requested'
  | 'governance_pii_detected'
  | 'governance_compliance_evaluated'
  | 'dataset_discovered'
  | 'schema_change_detected'
  | 'migration_assessment_completed'
  | 'migration_translation_completed'
  | 'migration_validation_completed'
  | 'migration_comparison_completed'
  | 'migration_batch_translation_completed';

export interface EventMessage {
  eventType: EventType;
  customerId: string;
  agentId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  correlationId: string;
  idempotencyKey?: string;
}

// ── Redis State Management ──

export type RedisConnectionState =
  | 'connected'
  | 'reconnecting'
  | 'suspended'
  | 'degraded'
  | 'disconnected';

export interface AgentCheckpoint {
  agentId: string;
  customerId: string;
  state: string;
  context: Record<string, unknown>;
  timestamp: number;
  version: number;
}

// ── Memory Quotas (REQ-CTX-005, REQ-CTX-016) ──

export type PricingTier = 'community' | 'pro' | 'growth' | 'enterprise' | 'custom';

export interface MemoryQuota {
  customerId: string;
  tier: PricingTier;
  /** Max memory in bytes */
  maxBytes: number;
  /** Current usage in bytes */
  currentBytes: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
}

export const DEFAULT_QUOTAS: Record<PricingTier, number> = {
  community: 128 * 1024 * 1024,    // 128MB
  pro: 256 * 1024 * 1024,           // 256MB
  growth: 512 * 1024 * 1024,        // 512MB
  enterprise: 2 * 1024 * 1024 * 1024, // 2GB
  custom: 4 * 1024 * 1024 * 1024,   // 4GB
};

// ── Failover Buffer ──

export interface BufferedOperation {
  type: 'set' | 'delete';
  key: string;
  value?: string;
  ttlSeconds?: number;
  timestamp: number;
}
