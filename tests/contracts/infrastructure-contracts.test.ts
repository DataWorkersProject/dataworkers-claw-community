/**
 * Infrastructure adapter contract tests.
 *
 * Verifies that every in-memory stub correctly implements its interface,
 * including method signatures, return types, and seed data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryKeyValueStore,
  InMemoryMessageBus,
  InMemoryRelationalStore,
  InMemoryGraphDB,
  InMemoryVectorStore,
  InMemoryFullTextSearch,
  InMemoryLLMClient,
  InMemoryWarehouseConnector,
  InMemoryOrchestratorAPI,
} from '../../core/infrastructure-stubs/src/index.js';
import type {
  IKeyValueStore,
  IMessageBus,
  IRelationalStore,
  IGraphDB,
  IVectorStore,
  IFullTextSearch,
  ILLMClient,
  IWarehouseConnector,
  IOrchestratorAPI,
  MessageBusEvent,
} from '../../core/infrastructure-stubs/src/interfaces/index.js';

// ---------------------------------------------------------------------------
// IKeyValueStore
// ---------------------------------------------------------------------------
describe('IKeyValueStore contract (InMemoryKeyValueStore)', () => {
  let store: IKeyValueStore;

  beforeEach(() => {
    store = new InMemoryKeyValueStore();
  });

  it('implements get/set correctly', async () => {
    await store.set('key1', 'value1');
    expect(await store.get('key1')).toBe('value1');
  });

  it('returns null for missing keys', async () => {
    expect(await store.get('nonexistent')).toBeNull();
  });

  it('deletes a key and returns boolean', async () => {
    await store.set('k', 'v');
    expect(await store.delete('k')).toBe(true);
    expect(await store.delete('k')).toBe(false);
    expect(await store.get('k')).toBeNull();
  });

  it('checks existence', async () => {
    await store.set('exists', 'yes');
    expect(await store.exists('exists')).toBe(true);
    expect(await store.exists('nope')).toBe(false);
  });

  it('lists keys with pattern', async () => {
    await store.set('prefix:a', '1');
    await store.set('prefix:b', '2');
    await store.set('other', '3');
    const matched = await store.keys('prefix:*');
    expect(matched).toHaveLength(2);
    expect(matched).toContain('prefix:a');
  });

  it('lists all keys without pattern', async () => {
    await store.set('a', '1');
    await store.set('b', '2');
    expect(await store.keys()).toHaveLength(2);
  });

  it('seed method exists and does not throw', () => {
    expect(() => store.seed()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// IMessageBus
// ---------------------------------------------------------------------------
describe('IMessageBus contract (InMemoryMessageBus)', () => {
  let bus: IMessageBus;
  const makeEvent = (type: string): MessageBusEvent => ({
    id: `evt-${Date.now()}`,
    type,
    payload: { data: 'test' },
    timestamp: Date.now(),
    customerId: 'cust-1',
  });

  beforeEach(() => {
    bus = new InMemoryMessageBus();
  });

  it('publishes and retrieves events by topic', async () => {
    const evt = makeEvent('test.event');
    await bus.publish('topic-a', evt);
    const events = await bus.getEvents('topic-a');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('test.event');
  });

  it('subscribes and receives published events', async () => {
    const received: MessageBusEvent[] = [];
    await bus.subscribe('topic-b', (e) => received.push(e));
    await bus.publish('topic-b', makeEvent('sub.test'));
    expect(received).toHaveLength(1);
  });

  it('returns empty array for unknown topic', async () => {
    expect(await bus.getEvents('nonexistent')).toEqual([]);
  });

  it('clears all topics and subscribers', async () => {
    await bus.publish('t', makeEvent('x'));
    await bus.clear();
    expect(await bus.getEvents('t')).toEqual([]);
  });

  it('seed method exists and does not throw', () => {
    expect(() => bus.seed()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// IRelationalStore
// ---------------------------------------------------------------------------
describe('IRelationalStore contract (InMemoryRelationalStore)', () => {
  let store: IRelationalStore;

  beforeEach(() => {
    store = new InMemoryRelationalStore();
  });

  it('creates a table and inserts rows', async () => {
    await store.createTable('users');
    await store.insert('users', { id: 1, name: 'Alice' });
    const rows = await store.query('users');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alice');
  });

  it('throws when inserting into nonexistent table', async () => {
    await expect(store.insert('missing', { a: 1 })).rejects.toThrow();
  });

  it('queries with filter', async () => {
    await store.createTable('t');
    await store.insert('t', { x: 1 });
    await store.insert('t', { x: 2 });
    const filtered = await store.query('t', (r) => (r.x as number) > 1);
    expect(filtered).toHaveLength(1);
  });

  it('queries with orderBy and limit', async () => {
    await store.createTable('t');
    await store.insert('t', { v: 3 });
    await store.insert('t', { v: 1 });
    await store.insert('t', { v: 2 });
    const result = await store.query('t', undefined, { column: 'v', direction: 'asc' }, 2);
    expect(result).toHaveLength(2);
    expect(result[0].v).toBe(1);
  });

  it('counts rows with optional filter', async () => {
    await store.createTable('t');
    await store.insert('t', { a: 1 });
    await store.insert('t', { a: 2 });
    expect(await store.count('t')).toBe(2);
    expect(await store.count('t', (r) => (r.a as number) === 1)).toBe(1);
  });

  it('aggregates sum', async () => {
    await store.createTable('nums');
    await store.insert('nums', { val: 10 });
    await store.insert('nums', { val: 20 });
    expect(await store.aggregate('nums', 'val', 'sum')).toBe(30);
  });

  it('aggregates avg', async () => {
    await store.createTable('nums');
    await store.insert('nums', { val: 10 });
    await store.insert('nums', { val: 30 });
    expect(await store.aggregate('nums', 'val', 'avg')).toBe(20);
  });

  it('clears a table', async () => {
    await store.createTable('t');
    await store.insert('t', { x: 1 });
    await store.clear('t');
    expect(await store.count('t')).toBe(0);
  });

  it('seed populates quality_metrics', async () => {
    store.seed();
    const count = await store.count('quality_metrics');
    expect(count).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// IGraphDB
// ---------------------------------------------------------------------------
describe('IGraphDB contract (InMemoryGraphDB)', () => {
  let graph: IGraphDB;
  const customerId = 'cust-1';

  beforeEach(() => {
    graph = new InMemoryGraphDB();
  });

  it('adds and retrieves a node', async () => {
    await graph.addNode({ id: 'n1', type: 'table', name: 'orders', platform: 'pg', properties: {}, customerId });
    const node = await graph.getNode('n1');
    expect(node).toBeDefined();
    expect(node!.name).toBe('orders');
  });

  it('removes a node and returns boolean', async () => {
    await graph.addNode({ id: 'n1', type: 'table', name: 'x', platform: 'pg', properties: {}, customerId });
    expect(await graph.removeNode('n1')).toBe(true);
    expect(await graph.removeNode('n1')).toBe(false);
    expect(await graph.getNode('n1')).toBeUndefined();
  });

  it('traverses upstream', async () => {
    await graph.addNode({ id: 'a', type: 'source', name: 'a', platform: 'pg', properties: {}, customerId });
    await graph.addNode({ id: 'b', type: 'model', name: 'b', platform: 'dbt', properties: {}, customerId });
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'derives_from', properties: {} });
    const upstream = await graph.traverseUpstream('b', 2);
    expect(upstream).toHaveLength(1);
    expect(upstream[0].node.id).toBe('a');
  });

  it('traverses downstream', async () => {
    await graph.addNode({ id: 'a', type: 'source', name: 'a', platform: 'pg', properties: {}, customerId });
    await graph.addNode({ id: 'b', type: 'model', name: 'b', platform: 'dbt', properties: {}, customerId });
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'derives_from', properties: {} });
    const downstream = await graph.traverseDownstream('a', 2);
    expect(downstream).toHaveLength(1);
    expect(downstream[0].node.id).toBe('b');
  });

  it('getImpact returns downstream nodes', async () => {
    await graph.addNode({ id: 'a', type: 'source', name: 'a', platform: 'pg', properties: {}, customerId });
    await graph.addNode({ id: 'b', type: 'model', name: 'b', platform: 'dbt', properties: {}, customerId });
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'feeds', properties: {} });
    const impact = await graph.getImpact('a');
    expect(impact.length).toBeGreaterThanOrEqual(1);
  });

  it('findByType filters correctly', async () => {
    await graph.addNode({ id: 'n1', type: 'table', name: 'a', platform: 'pg', properties: {}, customerId });
    await graph.addNode({ id: 'n2', type: 'model', name: 'b', platform: 'dbt', properties: {}, customerId });
    expect(await graph.findByType('table')).toHaveLength(1);
  });

  it('findByName is case-insensitive', async () => {
    await graph.addNode({ id: 'n1', type: 'table', name: 'Orders', platform: 'pg', properties: {}, customerId });
    expect(await graph.findByName('orders')).toHaveLength(1);
  });

  it('getAllNodes returns all', async () => {
    await graph.addNode({ id: 'a', type: 't', name: 'a', platform: 'x', properties: {}, customerId });
    await graph.addNode({ id: 'b', type: 't', name: 'b', platform: 'x', properties: {}, customerId });
    expect(await graph.getAllNodes()).toHaveLength(2);
  });

  it('getEdgesBetween returns edges', async () => {
    await graph.addNode({ id: 'a', type: 't', name: 'a', platform: 'x', properties: {}, customerId });
    await graph.addNode({ id: 'b', type: 't', name: 'b', platform: 'x', properties: {}, customerId });
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'feeds', properties: {} });
    expect(await graph.getEdgesBetween('a', 'b')).toHaveLength(1);
  });

  it('getColumnEdgesForNode returns column_lineage edges', async () => {
    await graph.addNode({ id: 'a', type: 't', name: 'a', platform: 'x', properties: {}, customerId });
    await graph.addNode({ id: 'b', type: 't', name: 'b', platform: 'x', properties: {}, customerId });
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'column_lineage', properties: { sourceColumn: 'id' } });
    expect(await graph.getColumnEdgesForNode('b')).toHaveLength(1);
  });

  it('seed populates lineage graph', async () => {
    graph.seed();
    expect((await graph.getAllNodes()).length).toBeGreaterThan(5);
    expect(await graph.getNode('src-raw-orders')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// IVectorStore
// ---------------------------------------------------------------------------
describe('IVectorStore contract (InMemoryVectorStore)', () => {
  let store: IVectorStore;

  beforeEach(() => {
    store = new InMemoryVectorStore();
  });

  it('upserts and queries vectors', async () => {
    const vec = await store.embed('test document');
    await store.upsert('doc-1', vec, { title: 'Test' }, 'ns');
    const results = await store.query(vec, 5, 'ns');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc-1');
    expect(results[0].score).toBeCloseTo(1.0, 1);
  });

  it('embed returns a 384-dim vector', async () => {
    const vec = await store.embed('hello');
    expect(vec).toHaveLength(384);
  });

  it('deletes an entry', async () => {
    const vec = await store.embed('x');
    await store.upsert('d1', vec, {}, 'ns');
    expect(await store.delete('d1', 'ns')).toBe(true);
    expect(await store.delete('d1', 'ns')).toBe(false);
  });

  it('filters by namespace', async () => {
    const vec = await store.embed('shared');
    await store.upsert('a', vec, {}, 'ns1');
    await store.upsert('b', vec, {}, 'ns2');
    expect(await store.query(vec, 10, 'ns1')).toHaveLength(1);
  });

  it('seed populates catalog namespace', async () => {
    store.seed();
    const vec = await store.embed('orders');
    const results = await store.query(vec, 100, 'catalog');
    expect(results.length).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// IFullTextSearch
// ---------------------------------------------------------------------------
describe('IFullTextSearch contract (InMemoryFullTextSearch)', () => {
  let fts: IFullTextSearch;

  beforeEach(() => {
    fts = new InMemoryFullTextSearch();
  });

  it('indexes and searches documents', async () => {
    await fts.index('doc-1', 'orders revenue data', { type: 'table' }, 'cust-1');
    const results = await fts.search('orders', 'cust-1', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('doc-1');
  });

  it('respects customer isolation', async () => {
    await fts.index('doc-1', 'secret data', {}, 'cust-1');
    await fts.index('doc-2', 'secret data', {}, 'cust-2');
    const results = await fts.search('secret', 'cust-1', 10);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc-1');
  });

  it('removes a document', async () => {
    await fts.index('doc-1', 'test', {}, 'cust-1');
    expect(await fts.remove('doc-1')).toBe(true);
    expect(await fts.remove('doc-1')).toBe(false);
    expect(await fts.search('test', 'cust-1', 10)).toHaveLength(0);
  });

  it('seed populates search index', async () => {
    fts.seed();
    const results = await fts.search('orders', 'cust-1', 10);
    expect(results.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ILLMClient
// ---------------------------------------------------------------------------
describe('ILLMClient contract (InMemoryLLMClient)', () => {
  let llm: ILLMClient;

  beforeEach(() => {
    llm = new InMemoryLLMClient();
  });

  it('completes prompts and returns LLMResponse', async () => {
    const response = await llm.complete('generate some code');
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe('string');
    expect(response.tokensUsed.input).toBeGreaterThan(0);
    expect(response.tokensUsed.output).toBeGreaterThan(0);
    expect(typeof response.latencyMs).toBe('number');
  });

  it('tracks spend and call count', async () => {
    await llm.complete('test');
    expect(await llm.getCallCount()).toBe(1);
    expect(await llm.getTotalSpend()).toBeGreaterThan(0);
  });

  it('resets tracking', async () => {
    await llm.complete('test');
    await llm.reset();
    expect(await llm.getCallCount()).toBe(0);
    expect(await llm.getTotalSpend()).toBe(0);
  });

  it('returns pipeline parse JSON for parse prompts', async () => {
    const response = await llm.complete('parse pipeline description: load orders daily');
    const parsed = JSON.parse(response.content);
    expect(parsed.pipelineName).toBeDefined();
    expect(parsed.confidence).toBeGreaterThan(0);
  });

  it('seed method exists and does not throw', () => {
    expect(() => llm.seed()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// IWarehouseConnector
// ---------------------------------------------------------------------------
describe('IWarehouseConnector contract (InMemoryWarehouseConnector)', () => {
  let wh: IWarehouseConnector;

  beforeEach(() => {
    wh = new InMemoryWarehouseConnector();
    wh.seed();
  });

  it('seed populates tables', async () => {
    const tables = await wh.listTables('cust-1', 'snowflake');
    expect(tables.length).toBeGreaterThanOrEqual(4);
  });

  it('getTableSchema returns schema for seeded table', async () => {
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(schema).toBeDefined();
    expect(schema!.columns.length).toBeGreaterThan(0);
    expect(schema!.columns.find((c) => c.name === 'id')).toBeDefined();
  });

  it('getTableSchema returns undefined for missing table', async () => {
    expect(await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'nonexistent')).toBeUndefined();
  });

  it('listTables filters by database and schema', async () => {
    const tables = await wh.listTables('cust-1', 'snowflake', 'analytics', 'public');
    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) {
      expect(t.startsWith('analytics.public.')).toBe(true);
    }
  });

  it('alterTable adds a column', async () => {
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'add_column',
      column: { name: 'notes', type: 'TEXT', nullable: true },
    });
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(schema!.columns.find((c) => c.name === 'notes')).toBeDefined();
  });

  it('alterTable removes a column', async () => {
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'remove_column',
      columnName: 'status',
    });
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(schema!.columns.find((c) => c.name === 'status')).toBeUndefined();
  });

  it('alterTable throws for missing table', async () => {
    await expect(
      wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'missing', {
        action: 'add_column',
        column: { name: 'x', type: 'INT', nullable: true },
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// IOrchestratorAPI
// ---------------------------------------------------------------------------
describe('IOrchestratorAPI contract (InMemoryOrchestratorAPI)', () => {
  let api: IOrchestratorAPI;

  beforeEach(() => {
    api = new InMemoryOrchestratorAPI();
    api.seed();
  });

  it('restartTask returns RestartResult', async () => {
    const result = await api.restartTask('etl_orders_daily', 'transform_orders');
    expect(result.success).toBe(true);
    expect(result.taskId).toBe('transform_orders');
    expect(result.dagId).toBe('etl_orders_daily');
    expect(result.restartedAt).toBeGreaterThan(0);
  });

  it('getTaskStatus returns seeded status', async () => {
    const status = await api.getTaskStatus('etl_orders_daily', 'extract_orders');
    expect(status).not.toBeNull();
    expect(status!.taskId).toBe('extract_orders');
    expect(status!.status).toBe('success');
  });

  it('getTaskStatus returns null for unknown task', async () => {
    const status = await api.getTaskStatus('unknown_dag', 'unknown_task');
    expect(status).toBeNull();
  });

  it('triggerDag returns DagRunResult', async () => {
    const result = await api.triggerDag('etl_orders_daily', { full_refresh: true });
    expect(result.dagId).toBe('etl_orders_daily');
    expect(result.state).toBe('queued');
    expect(result.dagRunId).toBeTruthy();
  });

  it('scaleCompute returns ScaleResult', async () => {
    const result = await api.scaleCompute('warehouse_primary', 'XL');
    expect(result.success).toBe(true);
    expect(result.previousSize).toBe('XS');
    expect(result.newSize).toBe('XL');
  });

  it('seed populates tasks with a failed task', async () => {
    const failed = await api.getTaskStatus('etl_orders_daily', 'transform_orders');
    expect(failed).not.toBeNull();
    expect(failed!.status).toBe('failed');
  });
});
