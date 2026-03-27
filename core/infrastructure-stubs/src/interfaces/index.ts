/**
 * Infrastructure adapter interfaces.
 * Each interface mirrors the public API of its corresponding InMemory stub class,
 * enabling production adapters to be swapped in via dependency injection.
 */

import type { VectorEntry, VectorQueryResult } from '../vector-store.js';
import type { GraphNode, GraphEdge } from '../graph-db.js';
import type { FTSDocument, FTSResult } from '../full-text-search.js';
import type { ColumnDef, TableSchema, AlterationType } from '../warehouse-connector.js';
import type { LLMResponse, LLMCompleteOptions } from '../llm-client-stub.js';
import type { TaskStatus, RestartResult, DagRunResult, ScaleResult } from '../orchestrator-api.js';
import type { MessageBusEvent } from '../message-bus.js';
import type { AggregateFunction } from '../relational-store.js';

// Re-export imported types so consumers can import everything from this module
export type {
  VectorEntry, VectorQueryResult,
  GraphNode, GraphEdge,
  FTSDocument, FTSResult,
  ColumnDef, TableSchema, AlterationType,
  LLMResponse, LLMCompleteOptions,
  TaskStatus, RestartResult, DagRunResult, ScaleResult,
  MessageBusEvent,
  AggregateFunction,
};

/* ------------------------------------------------------------------ */
/*  IKeyValueStore                                                     */
/* ------------------------------------------------------------------ */
export interface IKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IMessageBus                                                        */
/* ------------------------------------------------------------------ */
export interface IMessageBus {
  publish(topic: string, event: MessageBusEvent): Promise<void>;
  subscribe(topic: string, handler: (event: MessageBusEvent) => void): Promise<void>;
  unsubscribe(topic: string, handler: (event: MessageBusEvent) => void): void;
  getEvents(topic: string): Promise<MessageBusEvent[]>;
  request(topic: string, payload: Record<string, unknown>, timeoutMs?: number): Promise<Record<string, unknown>>;
  onRequest(topic: string, handler: (payload: unknown) => Promise<unknown>): void;
  clear(): Promise<void>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IRelationalStore                                                   */
/* ------------------------------------------------------------------ */
export interface IRelationalStore {
  createTable(name: string, schema?: Record<string, string>): Promise<void>;
  insert(table: string, row: Record<string, unknown>): Promise<void>;
  query(
    table: string,
    filter?: (row: Record<string, unknown>) => boolean,
    orderBy?: { column: string; direction: 'asc' | 'desc' },
    limit?: number,
  ): Promise<Record<string, unknown>[]>;
  count(table: string, filter?: (row: Record<string, unknown>) => boolean): Promise<number>;
  aggregate(
    table: string,
    column: string,
    fn: AggregateFunction,
    filter?: (row: Record<string, unknown>) => boolean,
  ): Promise<number>;
  clear(table: string): Promise<void>;
  /** Execute a raw SQL string against the relational store. Returns rows as key-value objects. */
  executeSQL?(sql: string, timeoutMs?: number): Promise<Record<string, unknown>[]>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IGraphDB                                                           */
/* ------------------------------------------------------------------ */
export interface IGraphDB {
  addNode(node: GraphNode): Promise<void>;
  addEdge(edge: GraphEdge): Promise<void>;
  getNode(id: string): Promise<GraphNode | undefined>;
  removeNode(id: string): Promise<boolean>;
  traverseUpstream(nodeId: string, maxDepth: number): Promise<Array<{ node: GraphNode; depth: number; relationship: string }>>;
  traverseDownstream(nodeId: string, maxDepth: number): Promise<Array<{ node: GraphNode; depth: number; relationship: string }>>;
  getImpact(nodeId: string): Promise<Array<{ node: GraphNode; depth: number; relationship: string }>>;
  findByType(type: string, customerId?: string): Promise<GraphNode[]>;
  findByName(query: string, customerId?: string): Promise<GraphNode[]>;
  getAllNodes(): Promise<GraphNode[]>;
  getEdgesBetween(sourceId: string, targetId: string): Promise<GraphEdge[]>;
  getColumnEdgesForNode(nodeId: string): Promise<GraphEdge[]>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IVectorStore                                                       */
/* ------------------------------------------------------------------ */
export interface IVectorStore {
  upsert(id: string, vector: number[], metadata: Record<string, unknown>, namespace: string): Promise<void>;
  query(vector: number[], topK: number, namespace: string, filter?: (metadata: Record<string, unknown>) => boolean): Promise<VectorQueryResult[]>;
  delete(id: string, namespace: string): Promise<boolean>;
  embed(text: string): Promise<number[]>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IFullTextSearch                                                    */
/* ------------------------------------------------------------------ */
export interface IFullTextSearch {
  index(id: string, content: string, metadata: Record<string, unknown>, customerId: string): Promise<void>;
  search(query: string, customerId: string, limit: number): Promise<FTSResult[]>;
  remove(id: string): Promise<boolean>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  ILLMClient                                                         */
/* ------------------------------------------------------------------ */
export interface ILLMClient {
  complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMResponse>;
  getTotalSpend(): Promise<number>;
  getCallCount(): Promise<number>;
  reset(): Promise<void>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IWarehouseConnector                                                */
/* ------------------------------------------------------------------ */
export interface IWarehouseConnector {
  getTableSchema(customerId: string, source: string, database: string, schema: string, table: string): Promise<TableSchema | undefined>;
  listTables(customerId: string, source: string, database?: string, schema?: string): Promise<string[]>;
  alterTable(customerId: string, source: string, database: string, schema: string, table: string, alteration: AlterationType): Promise<void>;
  /** Execute a raw SQL query against the warehouse. Returns rows as key-value objects. */
  executeQuery(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IOrchestratorAPI                                                   */
/* ------------------------------------------------------------------ */
export interface IOrchestratorAPI {
  restartTask(dagId: string, taskId: string): Promise<RestartResult>;
  getTaskStatus(dagId: string, taskId: string): Promise<TaskStatus | null>;
  triggerDag(dagId: string, conf?: Record<string, unknown>): Promise<DagRunResult>;
  scaleCompute(resourceId: string, targetSize: string): Promise<ScaleResult>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IBusinessRuleStore                                       */
/* ------------------------------------------------------------------ */
export interface BusinessRuleRecord {
  id: string;
  customerId: string;
  assetId: string;
  columnName?: string;
  ruleType: string;
  content: string;
  author: string;
  confidence: number;
  source: string;
  conditions: Array<{ field?: string; operator?: string; value?: unknown }>;
  createdAt: number;
  lastConfirmedAt: number;
  deprecated: boolean;
}

export interface IBusinessRuleStore {
  addRule(rule: BusinessRuleRecord): Promise<void>;
  getRulesForAsset(assetId: string, customerId?: string): Promise<BusinessRuleRecord[]>;
  searchRules(query: string, customerId?: string): Promise<BusinessRuleRecord[]>;
  updateRule(id: string, updates: Partial<BusinessRuleRecord>): Promise<BusinessRuleRecord | null>;
  deprecateRule(id: string): Promise<boolean>;
  seed(): void;
}

/* ------------------------------------------------------------------ */
/*  IContextFeedbackStore                                    */
/* ------------------------------------------------------------------ */
export interface ContextFeedbackRecord {
  id: string;
  assetId: string;
  userId: string;
  feedbackType: string;
  content: string;
  timestamp: number;
}

export interface IContextFeedbackStore {
  recordFeedback(feedback: ContextFeedbackRecord): Promise<void>;
  getFeedbackForAsset(assetId: string): Promise<ContextFeedbackRecord[]>;
  getAggregatedScore(assetId: string): Promise<{ positive: number; negative: number; total: number; score: number }>;
  seed(): void;
}

