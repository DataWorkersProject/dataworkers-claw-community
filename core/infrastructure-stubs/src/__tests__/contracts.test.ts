/**
 * Contract tests for all 9 infrastructure interfaces.
 * Verifies InMemory stubs implement identical behavior that real adapters
 * must also satisfy. These tests can be parameterized with real adapter
 * factories when backing services are available.
 *
 * 
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryKeyValueStore,
  InMemoryRelationalStore,
  InMemoryMessageBus,
  InMemoryGraphDB,
  InMemoryVectorStore,
  InMemoryFullTextSearch,
  InMemoryLLMClient,
  InMemoryWarehouseConnector,
  InMemoryOrchestratorAPI,
} from '../index.js';
import type {
  IKeyValueStore,
  IRelationalStore,
  IMessageBus,
  IGraphDB,
  IVectorStore,
  IFullTextSearch,
  ILLMClient,
  IWarehouseConnector,
  IOrchestratorAPI,
  GraphNode,
  MessageBusEvent,
} from '../interfaces/index.js';

// ---------------------------------------------------------------------------
// 1. IKeyValueStore
// ---------------------------------------------------------------------------
describe('IKeyValueStore contract', () => {
  let store: IKeyValueStore;

  beforeEach(() => {
    store = new InMemoryKeyValueStore();
  });

  it('set and get a value', async () => {
    await store.set('k1', 'v1');
    expect(await store.get('k1')).toBe('v1');
  });

  it('get returns null for missing key', async () => {
    expect(await store.get('nonexistent')).toBeNull();
  });

  it('delete removes a key and returns true', async () => {
    await store.set('k1', 'v1');
    expect(await store.delete('k1')).toBe(true);
    expect(await store.get('k1')).toBeNull();
  });

  it('delete returns false for missing key', async () => {
    expect(await store.delete('nope')).toBe(false);
  });

  it('exists returns true for present keys, false otherwise', async () => {
    await store.set('k1', 'v1');
    expect(await store.exists('k1')).toBe(true);
    expect(await store.exists('missing')).toBe(false);
  });

  it('keys returns all keys when no pattern given', async () => {
    await store.set('a:1', 'x');
    await store.set('a:2', 'y');
    await store.set('b:1', 'z');
    const all = await store.keys();
    expect(all).toHaveLength(3);
    expect(all.sort()).toEqual(['a:1', 'a:2', 'b:1']);
  });

  it('keys supports wildcard prefix pattern', async () => {
    await store.set('ns:foo', '1');
    await store.set('ns:bar', '2');
    await store.set('other:baz', '3');
    const matched = await store.keys('ns:*');
    expect(matched.sort()).toEqual(['ns:bar', 'ns:foo']);
  });

  it('TTL causes key to expire', async () => {
    await store.set('ephemeral', 'val', 1); // 1ms TTL
    // Wait just enough for expiry
    await new Promise((r) => setTimeout(r, 10));
    expect(await store.get('ephemeral')).toBeNull();
    expect(await store.exists('ephemeral')).toBe(false);
  });

  it('overwriting a key updates the value', async () => {
    await store.set('k', 'old');
    await store.set('k', 'new');
    expect(await store.get('k')).toBe('new');
  });

  it('expired keys are excluded from keys()', async () => {
    await store.set('live', 'yes');
    await store.set('dead', 'no', 1);
    await new Promise((r) => setTimeout(r, 10));
    const result = await store.keys();
    expect(result).toEqual(['live']);
  });
});

// ---------------------------------------------------------------------------
// 2. IRelationalStore
// ---------------------------------------------------------------------------
describe('IRelationalStore contract', () => {
  let store: IRelationalStore;

  beforeEach(() => {
    store = new InMemoryRelationalStore();
  });

  it('createTable and insert rows', async () => {
    await store.createTable('users');
    await store.insert('users', { id: 1, name: 'Alice' });
    const rows = await store.query('users');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, name: 'Alice' });
  });

  it('insert into nonexistent table throws', async () => {
    await expect(store.insert('missing', { x: 1 })).rejects.toThrow(
      /does not exist/,
    );
  });

  it('query returns empty for nonexistent table', async () => {
    const rows = await store.query('ghost');
    expect(rows).toEqual([]);
  });

  it('query with filter', async () => {
    await store.createTable('items');
    await store.insert('items', { id: 1, status: 'active' });
    await store.insert('items', { id: 2, status: 'inactive' });
    await store.insert('items', { id: 3, status: 'active' });
    const active = await store.query('items', (r) => r.status === 'active');
    expect(active).toHaveLength(2);
  });

  it('query with orderBy and limit', async () => {
    await store.createTable('scores');
    await store.insert('scores', { name: 'A', score: 30 });
    await store.insert('scores', { name: 'B', score: 10 });
    await store.insert('scores', { name: 'C', score: 20 });
    const top2 = await store.query(
      'scores',
      undefined,
      { column: 'score', direction: 'desc' },
      2,
    );
    expect(top2).toHaveLength(2);
    expect(top2[0].name).toBe('A');
    expect(top2[1].name).toBe('C');
  });

  it('count with and without filter', async () => {
    await store.createTable('t');
    await store.insert('t', { v: 1 });
    await store.insert('t', { v: 2 });
    await store.insert('t', { v: 3 });
    expect(await store.count('t')).toBe(3);
    expect(await store.count('t', (r) => (r.v as number) > 1)).toBe(2);
  });

  it('count returns 0 for nonexistent table', async () => {
    expect(await store.count('nope')).toBe(0);
  });

  it('aggregate functions: sum, avg, min, max, count_distinct', async () => {
    await store.createTable('metrics');
    await store.insert('metrics', { val: 10, cat: 'a' });
    await store.insert('metrics', { val: 20, cat: 'b' });
    await store.insert('metrics', { val: 30, cat: 'a' });
    await store.insert('metrics', { val: 20, cat: 'c' });

    expect(await store.aggregate('metrics', 'val', 'sum')).toBe(80);
    expect(await store.aggregate('metrics', 'val', 'avg')).toBe(20);
    expect(await store.aggregate('metrics', 'val', 'min')).toBe(10);
    expect(await store.aggregate('metrics', 'val', 'max')).toBe(30);
    expect(await store.aggregate('metrics', 'cat', 'count_distinct')).toBe(3);
  });

  it('clear empties the table but table still exists', async () => {
    await store.createTable('t');
    await store.insert('t', { x: 1 });
    await store.clear('t');
    expect(await store.count('t')).toBe(0);
    // Should still be able to insert after clear
    await store.insert('t', { x: 2 });
    expect(await store.count('t')).toBe(1);
  });

  it('createTable is idempotent', async () => {
    await store.createTable('dup');
    await store.insert('dup', { v: 1 });
    await store.createTable('dup'); // should not wipe
    expect(await store.count('dup')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. IMessageBus
// ---------------------------------------------------------------------------
describe('IMessageBus contract', () => {
  let bus: IMessageBus;

  const mkEvent = (id: string, type: string, _topic?: string): MessageBusEvent => ({
    id,
    type,
    payload: { data: id },
    timestamp: Date.now(),
    customerId: 'cust-1',
  });

  beforeEach(() => {
    bus = new InMemoryMessageBus();
  });

  it('publish stores events retrievable via getEvents', async () => {
    const evt = mkEvent('e1', 'test');
    await bus.publish('topicA', evt);
    const events = await bus.getEvents('topicA');
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('e1');
  });

  it('getEvents returns empty for unknown topic', async () => {
    expect(await bus.getEvents('unknown')).toEqual([]);
  });

  it('subscribe handler is invoked on publish', async () => {
    const received: MessageBusEvent[] = [];
    await bus.subscribe('topicB', (e) => received.push(e));
    const evt = mkEvent('e2', 'notify');
    await bus.publish('topicB', evt);
    expect(received).toHaveLength(1);
    expect(received[0].id).toBe('e2');
  });

  it('multiple subscribers all receive events', async () => {
    const r1: string[] = [];
    const r2: string[] = [];
    await bus.subscribe('t', (e) => r1.push(e.id));
    await bus.subscribe('t', (e) => r2.push(e.id));
    await bus.publish('t', mkEvent('e3', 'x'));
    expect(r1).toEqual(['e3']);
    expect(r2).toEqual(['e3']);
  });

  it('topics are isolated', async () => {
    await bus.publish('A', mkEvent('ea', 'x'));
    await bus.publish('B', mkEvent('eb', 'x'));
    expect(await bus.getEvents('A')).toHaveLength(1);
    expect(await bus.getEvents('B')).toHaveLength(1);
    expect((await bus.getEvents('A'))[0].id).toBe('ea');
  });

  it('subscriber on topic A does not fire for topic B', async () => {
    const received: string[] = [];
    await bus.subscribe('A', (e) => received.push(e.id));
    await bus.publish('B', mkEvent('eb', 'x'));
    expect(received).toHaveLength(0);
  });

  it('clear removes all events and subscribers', async () => {
    const received: string[] = [];
    await bus.subscribe('t', (e) => received.push(e.id));
    await bus.publish('t', mkEvent('e1', 'x'));
    await bus.clear();
    expect(await bus.getEvents('t')).toEqual([]);
    // Subscriber should have been cleared too
    await bus.publish('t', mkEvent('e2', 'x'));
    expect(received).toHaveLength(1); // only e1 from before clear
  });

  it('publishes multiple events in order', async () => {
    await bus.publish('t', mkEvent('e1', 'x'));
    await bus.publish('t', mkEvent('e2', 'x'));
    await bus.publish('t', mkEvent('e3', 'x'));
    const events = await bus.getEvents('t');
    expect(events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });
});

// ---------------------------------------------------------------------------
// 4. IGraphDB
// ---------------------------------------------------------------------------
describe('IGraphDB contract', () => {
  let graph: IGraphDB;

  const mkNode = (id: string, type: string, name: string): GraphNode => ({
    id,
    type,
    name,
    platform: 'test',
    properties: {},
    customerId: 'cust-1',
  });

  beforeEach(() => {
    graph = new InMemoryGraphDB();
  });

  it('addNode and getNode', async () => {
    await graph.addNode(mkNode('n1', 'table', 'orders'));
    const node = await graph.getNode('n1');
    expect(node).toBeDefined();
    expect(node!.name).toBe('orders');
  });

  it('getNode returns undefined for missing node', async () => {
    expect(await graph.getNode('missing')).toBeUndefined();
  });

  it('removeNode returns true for existing, false for missing', async () => {
    await graph.addNode(mkNode('n1', 'table', 'orders'));
    expect(await graph.removeNode('n1')).toBe(true);
    expect(await graph.removeNode('n1')).toBe(false);
    expect(await graph.getNode('n1')).toBeUndefined();
  });

  it('addEdge and traverseDownstream', async () => {
    await graph.addNode(mkNode('a', 'source', 'src'));
    await graph.addNode(mkNode('b', 'model', 'stg'));
    await graph.addNode(mkNode('c', 'model', 'mart'));
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'derives_from', properties: {} });
    await graph.addEdge({ source: 'b', target: 'c', relationship: 'derives_from', properties: {} });

    const downstream = await graph.traverseDownstream('a', 10);
    expect(downstream).toHaveLength(2);
    expect(downstream.map((d) => d.node.id).sort()).toEqual(['b', 'c']);
  });

  it('traverseUpstream walks incoming edges', async () => {
    await graph.addNode(mkNode('a', 'source', 'src'));
    await graph.addNode(mkNode('b', 'model', 'stg'));
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'derives_from', properties: {} });

    const upstream = await graph.traverseUpstream('b', 10);
    expect(upstream).toHaveLength(1);
    expect(upstream[0].node.id).toBe('a');
  });

  it('traversal respects maxDepth', async () => {
    await graph.addNode(mkNode('a', 's', 'a'));
    await graph.addNode(mkNode('b', 's', 'b'));
    await graph.addNode(mkNode('c', 's', 'c'));
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'r', properties: {} });
    await graph.addEdge({ source: 'b', target: 'c', relationship: 'r', properties: {} });

    const depth1 = await graph.traverseDownstream('a', 1);
    expect(depth1).toHaveLength(1);
    expect(depth1[0].node.id).toBe('b');
  });

  it('getImpact returns all downstream nodes', async () => {
    await graph.addNode(mkNode('root', 'source', 'root'));
    await graph.addNode(mkNode('mid', 'model', 'mid'));
    await graph.addNode(mkNode('leaf', 'dashboard', 'leaf'));
    await graph.addEdge({ source: 'root', target: 'mid', relationship: 'feeds', properties: {} });
    await graph.addEdge({ source: 'mid', target: 'leaf', relationship: 'feeds', properties: {} });

    const impact = await graph.getImpact('root');
    expect(impact).toHaveLength(2);
  });

  it('findByType filters by type and optionally customerId', async () => {
    await graph.addNode(mkNode('t1', 'table', 'a'));
    await graph.addNode(mkNode('t2', 'table', 'b'));
    await graph.addNode(mkNode('m1', 'model', 'c'));

    const tables = await graph.findByType('table');
    expect(tables).toHaveLength(2);

    const custTables = await graph.findByType('table', 'cust-1');
    expect(custTables).toHaveLength(2);

    const noMatch = await graph.findByType('table', 'other-cust');
    expect(noMatch).toHaveLength(0);
  });

  it('findByName does case-insensitive substring match', async () => {
    await graph.addNode(mkNode('n1', 'table', 'OrdersTable'));
    await graph.addNode(mkNode('n2', 'table', 'customers'));

    const results = await graph.findByName('orders');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('n1');
  });

  it('removeNode cleans up edges referencing it', async () => {
    await graph.addNode(mkNode('a', 's', 'a'));
    await graph.addNode(mkNode('b', 's', 'b'));
    await graph.addNode(mkNode('c', 's', 'c'));
    await graph.addEdge({ source: 'a', target: 'b', relationship: 'r', properties: {} });
    await graph.addEdge({ source: 'b', target: 'c', relationship: 'r', properties: {} });

    await graph.removeNode('b');
    // Traversal from a should find nothing downstream
    const downstream = await graph.traverseDownstream('a', 10);
    expect(downstream).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. IVectorStore
// ---------------------------------------------------------------------------
describe('IVectorStore contract', () => {
  let vs: IVectorStore;

  beforeEach(() => {
    vs = new InMemoryVectorStore();
  });

  it('upsert and query returns matching entries', async () => {
    const vec = await vs.embed('orders data');
    await vs.upsert('doc1', vec, { name: 'orders' }, 'ns1');

    const results = await vs.query(vec, 5, 'ns1');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc1');
    expect(results[0].score).toBeGreaterThan(0.99); // identical vector
  });

  it('query returns empty for empty namespace', async () => {
    const vec = await vs.embed('anything');
    const results = await vs.query(vec, 5, 'empty-ns');
    expect(results).toEqual([]);
  });

  it('namespace isolation: different namespaces do not mix', async () => {
    const vec = await vs.embed('test');
    await vs.upsert('d1', vec, {}, 'ns-a');
    await vs.upsert('d2', vec, {}, 'ns-b');

    const resultsA = await vs.query(vec, 10, 'ns-a');
    expect(resultsA).toHaveLength(1);
    expect(resultsA[0].id).toBe('d1');

    const resultsB = await vs.query(vec, 10, 'ns-b');
    expect(resultsB).toHaveLength(1);
    expect(resultsB[0].id).toBe('d2');
  });

  it('delete removes entry and returns true', async () => {
    const vec = await vs.embed('data');
    await vs.upsert('d1', vec, {}, 'ns');
    expect(await vs.delete('d1', 'ns')).toBe(true);
    const results = await vs.query(vec, 5, 'ns');
    expect(results).toEqual([]);
  });

  it('delete returns false for missing entry', async () => {
    expect(await vs.delete('nope', 'ns')).toBe(false);
  });

  it('embed produces consistent vectors for same input', async () => {
    const v1 = await vs.embed('hello world');
    const v2 = await vs.embed('hello world');
    expect(v1).toEqual(v2);
  });

  it('embed produces different vectors for different input', async () => {
    const v1 = await vs.embed('hello');
    const v2 = await vs.embed('goodbye');
    expect(v1).not.toEqual(v2);
  });

  it('similarity scoring ranks closer vectors higher', async () => {
    const vecOrders = await vs.embed('customer orders');
    const vecRevenue = await vs.embed('revenue metrics');
    const vecRandom = await vs.embed('completely unrelated topic about space');

    await vs.upsert('orders', vecOrders, {}, 'test');
    await vs.upsert('revenue', vecRevenue, {}, 'test');
    await vs.upsert('random', vecRandom, {}, 'test');

    const queryVec = await vs.embed('customer orders');
    const results = await vs.query(queryVec, 3, 'test');
    // The exact same text should be the top result
    expect(results[0].id).toBe('orders');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('metadata filter excludes non-matching entries', async () => {
    const vec = await vs.embed('data');
    await vs.upsert('a', vec, { type: 'table' }, 'ns');
    await vs.upsert('b', vec, { type: 'model' }, 'ns');

    const results = await vs.query(vec, 10, 'ns', (m) => m.type === 'table');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a');
  });

  it('topK limits the number of results', async () => {
    const vec = await vs.embed('item');
    for (let i = 0; i < 10; i++) {
      await vs.upsert(`d${i}`, vec, {}, 'ns');
    }
    const results = await vs.query(vec, 3, 'ns');
    expect(results).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 6. IFullTextSearch
// ---------------------------------------------------------------------------
describe('IFullTextSearch contract', () => {
  let fts: IFullTextSearch;

  beforeEach(() => {
    fts = new InMemoryFullTextSearch();
  });

  it('index and search returns matching documents', async () => {
    await fts.index('d1', 'customer orders revenue data', { type: 'table' }, 'cust-1');
    const results = await fts.search('orders', 'cust-1', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('d1');
  });

  it('search returns empty for no matches', async () => {
    await fts.index('d1', 'hello world', {}, 'cust-1');
    const results = await fts.search('zzzznonexistent', 'cust-1', 10);
    expect(results).toEqual([]);
  });

  it('customer isolation: search scoped to customerId', async () => {
    await fts.index('d1', 'shared keyword alpha', {}, 'cust-1');
    await fts.index('d2', 'shared keyword alpha', {}, 'cust-2');

    const r1 = await fts.search('alpha', 'cust-1', 10);
    expect(r1).toHaveLength(1);
    expect(r1[0].id).toBe('d1');

    const r2 = await fts.search('alpha', 'cust-2', 10);
    expect(r2).toHaveLength(1);
    expect(r2[0].id).toBe('d2');
  });

  it('relevance scoring: documents with query terms score higher than those without', async () => {
    // Need enough docs so IDF (log(N / (df+1))) is positive
    await fts.index('d1', 'orders revenue data pipeline', {}, 'cust-1');
    await fts.index('d2', 'completely unrelated content about weather', {}, 'cust-1');
    await fts.index('d3', 'another unrelated document about animals', {}, 'cust-1');
    await fts.index('d4', 'yet another filler document here', {}, 'cust-1');

    const results = await fts.search('orders revenue', 'cust-1', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    // d1 matches the query terms
    expect(results[0].id).toBe('d1');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('remove deletes document from index', async () => {
    await fts.index('d1', 'test document content', {}, 'cust-1');
    expect(await fts.remove('d1')).toBe(true);
    const results = await fts.search('document', 'cust-1', 10);
    expect(results).toEqual([]);
  });

  it('remove returns false for nonexistent document', async () => {
    expect(await fts.remove('nope')).toBe(false);
  });

  it('re-indexing replaces old content', async () => {
    await fts.index('d1', 'alpha beta gamma', {}, 'cust-1');
    await fts.index('d1', 'delta epsilon zeta', {}, 'cust-1');

    const old = await fts.search('alpha', 'cust-1', 10);
    expect(old).toEqual([]);

    const updated = await fts.search('delta', 'cust-1', 10);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('d1');
  });

  it('search with empty query returns empty', async () => {
    await fts.index('d1', 'some content here', {}, 'cust-1');
    const results = await fts.search('', 'cust-1', 10);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. ILLMClient
// ---------------------------------------------------------------------------
describe('ILLMClient contract', () => {
  let llm: ILLMClient;

  beforeEach(() => {
    llm = new InMemoryLLMClient();
  });

  it('complete returns a response with content and token usage', async () => {
    const resp = await llm.complete('Hello, how are you?');
    expect(resp.content).toBeTruthy();
    expect(resp.tokensUsed.input).toBeGreaterThan(0);
    expect(resp.tokensUsed.output).toBeGreaterThan(0);
    expect(resp.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('getTotalSpend starts at zero', async () => {
    expect(await llm.getTotalSpend()).toBe(0);
  });

  it('getCallCount starts at zero', async () => {
    expect(await llm.getCallCount()).toBe(0);
  });

  it('complete increments call count and spend', async () => {
    await llm.complete('test');
    expect(await llm.getCallCount()).toBe(1);
    expect(await llm.getTotalSpend()).toBeGreaterThan(0);

    await llm.complete('test again');
    expect(await llm.getCallCount()).toBe(2);
  });

  it('reset clears call count and spend', async () => {
    await llm.complete('test');
    await llm.reset();
    expect(await llm.getCallCount()).toBe(0);
    expect(await llm.getTotalSpend()).toBe(0);
  });

  it('pattern matching: parse pipeline prompt returns JSON', async () => {
    const resp = await llm.complete('parse pipeline description for ETL');
    const parsed = JSON.parse(resp.content);
    expect(parsed).toHaveProperty('pipelineName');
    expect(parsed).toHaveProperty('confidence');
  });

  it('pattern matching: generate prompt returns SQL-like code', async () => {
    const resp = await llm.complete('generate a pipeline');
    expect(resp.content).toContain('SELECT');
  });

  it('multiple calls accumulate spend correctly', async () => {
    await llm.complete('hello');
    const spend1 = await llm.getTotalSpend();
    await llm.complete('hello');
    const spend2 = await llm.getTotalSpend();
    expect(spend2).toBeGreaterThan(spend1);
  });
});

// ---------------------------------------------------------------------------
// 8. IWarehouseConnector
// ---------------------------------------------------------------------------
describe('IWarehouseConnector contract', () => {
  let wh: IWarehouseConnector;

  beforeEach(() => {
    wh = new InMemoryWarehouseConnector();
    wh.seed(); // loads seed tables
  });

  it('getTableSchema returns schema for seeded table', async () => {
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(schema).toBeDefined();
    expect(schema!.columns.length).toBeGreaterThan(0);
    const colNames = schema!.columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('total_amount');
  });

  it('getTableSchema returns undefined for nonexistent table', async () => {
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'nonexistent');
    expect(schema).toBeUndefined();
  });

  it('listTables returns seeded tables', async () => {
    const tables = await wh.listTables('cust-1', 'snowflake');
    expect(tables.length).toBeGreaterThanOrEqual(4);
    expect(tables.some((t) => t.includes('orders'))).toBe(true);
  });

  it('listTables filters by database and schema', async () => {
    const tables = await wh.listTables('cust-1', 'snowflake', 'analytics', 'public');
    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) {
      expect(t).toMatch(/^analytics\.public\./);
    }
  });

  it('listTables returns empty for unknown source', async () => {
    const tables = await wh.listTables('cust-1', 'unknown_source');
    expect(tables).toEqual([]);
  });

  it('alterTable add_column adds a column', async () => {
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'add_column',
      column: { name: 'notes', type: 'TEXT', nullable: true },
    });
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(schema!.columns.map((c) => c.name)).toContain('notes');
  });

  it('alterTable remove_column removes a column', async () => {
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'remove_column',
      columnName: 'status',
    });
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(schema!.columns.map((c) => c.name)).not.toContain('status');
  });

  it('alterTable rename_column renames a column', async () => {
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'rename_column',
      oldName: 'status',
      newName: 'order_status',
    });
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    const colNames = schema!.columns.map((c) => c.name);
    expect(colNames).toContain('order_status');
    expect(colNames).not.toContain('status');
  });

  it('alterTable on nonexistent table throws', async () => {
    await expect(
      wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'ghost', {
        action: 'add_column',
        column: { name: 'x', type: 'INT', nullable: true },
      }),
    ).rejects.toThrow(/Table not found/);
  });
});

// ---------------------------------------------------------------------------
// 9. IOrchestratorAPI
// ---------------------------------------------------------------------------
describe('IOrchestratorAPI contract', () => {
  let orch: IOrchestratorAPI;

  beforeEach(() => {
    orch = new InMemoryOrchestratorAPI();
  });

  it('restartTask returns success result', async () => {
    const result = await orch.restartTask('dag1', 'task1');
    expect(result.success).toBe(true);
    expect(result.dagId).toBe('dag1');
    expect(result.taskId).toBe('task1');
    expect(result.restartedAt).toBeGreaterThan(0);
  });

  it('getTaskStatus returns null for unknown task', async () => {
    const status = await orch.getTaskStatus('no-dag', 'no-task');
    expect(status).toBeNull();
  });

  it('getTaskStatus returns status after restart', async () => {
    await orch.restartTask('d1', 't1');
    const status = await orch.getTaskStatus('d1', 't1');
    expect(status).toBeDefined();
    expect(status!.status).toBe('success');
    expect(status!.dagId).toBe('d1');
    expect(status!.taskId).toBe('t1');
  });

  it('triggerDag returns a queued run result', async () => {
    const result = await orch.triggerDag('my_dag', { key: 'value' });
    expect(result.dagId).toBe('my_dag');
    expect(result.state).toBe('queued');
    expect(result.dagRunId).toBeTruthy();
    expect(result.triggeredAt).toBeGreaterThan(0);
  });

  it('triggerDag generates dagRunIds containing the dagId', async () => {
    const r1 = await orch.triggerDag('dag1');
    const r2 = await orch.triggerDag('dag2');
    expect(r1.dagRunId).toContain('dag1');
    expect(r2.dagRunId).toContain('dag2');
    expect(r1.dagRunId).not.toBe(r2.dagRunId);
  });

  it('scaleCompute returns previous and new size', async () => {
    const result = await orch.scaleCompute('wh1', 'XL');
    expect(result.success).toBe(true);
    expect(result.resourceId).toBe('wh1');
    expect(result.previousSize).toBe('XS'); // default
    expect(result.newSize).toBe('XL');
  });

  it('scaleCompute remembers previous scaling', async () => {
    await orch.scaleCompute('wh1', 'M');
    const result = await orch.scaleCompute('wh1', 'L');
    expect(result.previousSize).toBe('M');
    expect(result.newSize).toBe('L');
  });

  it('seed loads tasks and seeded task has failed status', async () => {
    orch.seed();
    const status = await orch.getTaskStatus('etl_orders_daily', 'transform_orders');
    expect(status).toBeDefined();
    expect(status!.status).toBe('failed');
  });

  it('seed loads compute sizes', async () => {
    orch.seed();
    const result = await orch.scaleCompute('warehouse_primary', 'M');
    expect(result.previousSize).toBe('XS');
    const result2 = await orch.scaleCompute('warehouse_analytics', 'L');
    expect(result2.previousSize).toBe('S');
  });
});
