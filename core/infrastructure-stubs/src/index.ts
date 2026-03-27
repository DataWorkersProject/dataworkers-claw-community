/**
 * Infrastructure stubs barrel export (OSS edition).
 * In-memory implementations for development and testing.
 * Real infrastructure adapters are available in the enterprise edition.
 */

export { InMemoryVectorStore, getSeedAssets } from './vector-store.js';
export type { VectorEntry, VectorQueryResult, SeedAsset } from './vector-store.js';

export { InMemoryGraphDB } from './graph-db.js';
export type { GraphNode, GraphEdge } from './graph-db.js';

export { InMemoryFullTextSearch } from './full-text-search.js';
export type { FTSDocument, FTSResult } from './full-text-search.js';

export { InMemoryKeyValueStore } from './key-value-store.js';

export { InMemoryWarehouseConnector } from './warehouse-connector.js';
export type { ColumnDef, TableSchema, AlterationType } from './warehouse-connector.js';

export { InMemoryRelationalStore } from './relational-store.js';
export type { AggregateFunction } from './relational-store.js';

export { InMemoryMessageBus } from './message-bus.js';
export type { MessageBusEvent } from './message-bus.js';

export { InMemoryLLMClient } from './llm-client-stub.js';
export type { LLMResponse, LLMCompleteOptions } from './llm-client-stub.js';

export { InMemoryOrchestratorAPI } from './orchestrator-api.js';
export type { TaskStatus, RestartResult, DagRunResult, ScaleResult } from './orchestrator-api.js';

export { InMemoryBusinessRuleStore } from './business-rule-store.js';
export { InMemoryContextFeedbackStore } from './context-feedback-store.js';

export * from './interfaces/index.js';

// Factory functions for auto-detecting infrastructure (OSS: always InMemory)
export {
  createKeyValueStore,
  createMessageBus,
  createRelationalStore,
  createGraphDB,
  createVectorStore,
  createFullTextSearch,
  createLLMClient,
  createWarehouseConnector,
  createOrchestratorAPI,
  disconnectAll,
} from './adapters/factory.js';
