/**
 * Integration tests for real infrastructure adapters.
 * Only runs when INTEGRATION_TEST=true and real services are available.
 *
 * Prerequisites:
 *   docker compose up -d
 *   INTEGRATION_TEST=true npx vitest run tests/integration/infrastructure-real.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SKIP = process.env.INTEGRATION_TEST !== 'true';

import {
  createKeyValueStore,
  createRelationalStore,
  createGraphDB,
  createMessageBus,
  createVectorStore,
  createFullTextSearch,
  createOrchestratorAPI,
  disconnectAll,
  type IKeyValueStore,
  type IRelationalStore,
  type IGraphDB,
  type IMessageBus,
  type IVectorStore,
  type IFullTextSearch,
  InMemoryKeyValueStore,
  InMemoryRelationalStore,
  InMemoryGraphDB,
  InMemoryMessageBus,
  InMemoryVectorStore,
  InMemoryFullTextSearch,
} from '@data-workers/infrastructure-stubs';

describe.skipIf(SKIP)('Real Infrastructure Integration', () => {
  let kv: IKeyValueStore;
  let sql: IRelationalStore;
  let graph: IGraphDB;
  let bus: IMessageBus;
  let vector: IVectorStore;
  let fts: IFullTextSearch;

  beforeAll(async () => {
    kv = await createKeyValueStore();
    sql = await createRelationalStore();
    graph = await createGraphDB();
    bus = await createMessageBus();
    vector = await createVectorStore();
    fts = await createFullTextSearch();
  });

  afterAll(async () => {
    await disconnectAll(kv, sql, graph, bus, vector, fts);
  });

  describe('KeyValueStore (Redis)', () => {
    it('uses real adapter when REDIS_URL is set', () => {
      if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        expect(kv).not.toBeInstanceOf(InMemoryKeyValueStore);
      }
    });

    it('set and get round-trip', async () => {
      await kv.set('test:integration', 'hello');
      const val = await kv.get('test:integration');
      expect(val).toBe('hello');
      await kv.delete('test:integration');
    });

    it('TTL expiration', async () => {
      await kv.set('test:ttl', 'expires', 100);
      const before = await kv.get('test:ttl');
      expect(before).toBe('expires');
      await new Promise(r => setTimeout(r, 150));
      const after = await kv.get('test:ttl');
      expect(after).toBeNull();
    });
  });

  describe('RelationalStore (PostgreSQL)', () => {
    it('uses real adapter when DATABASE_URL is set', () => {
      if (process.env.DATABASE_URL || process.env.PG_HOST) {
        expect(sql).not.toBeInstanceOf(InMemoryRelationalStore);
      }
    });

    it('create table, insert, query', async () => {
      await sql.createTable('integration_test', { id: 'SERIAL PRIMARY KEY', name: 'TEXT', value: 'INTEGER' });
      await sql.insert('integration_test', { name: 'test-row', value: 42 });
      const rows = await sql.query('integration_test', r => r.name === 'test-row');
      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe(42);
      await sql.clear('integration_test');
    });
  });

  describe('GraphDB (Neo4j)', () => {
    it('uses real adapter when NEO4J_URI is set', () => {
      if (process.env.NEO4J_URI) {
        expect(graph).not.toBeInstanceOf(InMemoryGraphDB);
      }
    });

    it('add node and retrieve', async () => {
      await graph.addNode({ id: 'int-test-1', type: 'test', name: 'integration', platform: 'test', properties: {}, customerId: 'test' });
      const node = await graph.getNode('int-test-1');
      expect(node).toBeDefined();
      expect(node!.name).toBe('integration');
      await graph.removeNode('int-test-1');
    });
  });

  describe('MessageBus (Kafka)', () => {
    it('uses real adapter when KAFKA_BROKERS is set', () => {
      if (process.env.KAFKA_BROKERS) {
        expect(bus).not.toBeInstanceOf(InMemoryMessageBus);
      }
    });

    it('publish and get events', async () => {
      const event = { id: 'int-evt-1', type: 'test', payload: { key: 'value' }, timestamp: Date.now(), customerId: 'test' };
      await bus.publish('integration-test', event);
      const events = await bus.getEvents('integration-test');
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('VectorStore (pgvector)', () => {
    it('uses real adapter when PGVECTOR_ENABLED is set', () => {
      if (process.env.PGVECTOR_ENABLED === 'true') {
        expect(vector).not.toBeInstanceOf(InMemoryVectorStore);
      }
    });

    it('embed, upsert, query round-trip', async () => {
      const embedding = await vector.embed('test document about orders');
      expect(embedding.length).toBeGreaterThan(0);
      await vector.upsert('int-vec-1', embedding, { name: 'test' }, 'integration');
      const results = await vector.query(embedding, 5, 'integration');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('int-vec-1');
      await vector.delete('int-vec-1', 'integration');
    });
  });

  describe('FullTextSearch (PG tsvector)', () => {
    it('uses real adapter when PG_FTS_ENABLED is set', () => {
      if (process.env.PG_FTS_ENABLED === 'true') {
        expect(fts).not.toBeInstanceOf(InMemoryFullTextSearch);
      }
    });

    it('index and search', async () => {
      await fts.index('int-fts-1', 'customer orders revenue daily pipeline', { type: 'test' }, 'test-customer');
      const results = await fts.search('orders revenue', 'test-customer', 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('int-fts-1');
      await fts.remove('int-fts-1');
    });
  });
});
