/**
 * @data-workers/context-layer
 *
 * Cross-agent context layer providing:
 * - Redis Cluster shared memory (REQ-CTX-001 through REQ-CTX-005, REQ-CTX-016)
 * - Kafka event bus (REQ-CTX-006 through REQ-CTX-008, REQ-CTX-013, REQ-CTX-017)
 * - Saga Coordinator (REQ-CTX-008)
 * - Context Propagation Engine (REQ-CTX-010, REQ-CTX-011)
 * - Vector Store abstraction (REQ-CTX-012, REQ-RAG-010)
 * - Lineage Graph (REQ-CTX-014)
 * - Memory quota management (REQ-CTX-005, REQ-CTX-016)
 * - Health monitoring
 */

export { RedisContextStore } from './redis-store.js';
export { KafkaEventBus } from './kafka-bus.js';
export type { KafkaConnectionState, KafkaEventBusConfig } from './kafka-bus.js';
export { SagaCoordinator } from './saga-coordinator.js';
export type { Saga, SagaStep, SagaStatus } from './saga-coordinator.js';
export { ContextPropagationEngine } from './context-propagation.js';
export type {
  ContextItem,
  ContextPriority,
  ContextConflict,
  ContextSelectionResult,
  ContextBudget,
} from './context-propagation.js';
export { VectorStore } from './vector-store.js';
export type {
  VectorSearchResult,
  VectorStoreConfig,
  VectorDocument,
} from './vector-store.js';
export { LineageGraph } from './lineage-graph.js';
export type {
  LineageEntity,
  LineageEntityType,
  LineageRelation,
  LineageRelationType,
  LineageTraversalResult,
} from './lineage-graph.js';
export { MemoryQuotaManager } from './memory-quota.js';
export { RedisHealthMonitor } from './redis-health.js';
export type { HealthCheckResult } from './redis-health.js';

export type {
  ContextLayerConfig,
  RedisConfig,
  KafkaConfig,
  ContextEntry,
  EventType,
  EventMessage,
  RedisConnectionState,
  AgentCheckpoint,
  PricingTier,
  MemoryQuota,
  BufferedOperation,
} from './types.js';

export { DEFAULT_QUOTAS } from './types.js';
