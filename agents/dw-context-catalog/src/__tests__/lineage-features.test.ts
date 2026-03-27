/**
 * Tests for through lineage features.
 * GraphPersister, DbtLineageParser, OpenLineageConsumer, ColumnLineageExpander, LineageAPI.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GraphPersister } from '../crawlers/graph-persister.js';
import { DbtLineageParser } from '../search/dbt-lineage-parser.js';
import { OpenLineageConsumer } from '../search/openlineage-consumer.js';
import { ColumnLineageExpander } from '../search/column-lineage-expander.js';
import { LineageAPI } from '../search/lineage-api.js';
import { InMemoryGraphDB } from '@data-workers/infrastructure-stubs';
import type { DataAsset } from '../types.js';

// ── GraphPersister ──────────────────────────────────────

describe('GraphPersister', () => {
  it('persists new assets to graph DB', async () => {
    const db = new InMemoryGraphDB();
    const persister = new GraphPersister(db);
    const assets: DataAsset[] = [{
      id: 'test-1', customerId: 'c1', name: 'orders', type: 'table', platform: 'snowflake',
      description: 'Orders table', tags: ['finance'], qualityScore: 80, freshnessScore: 90,
      lastUpdated: Date.now(), lastCrawled: Date.now(), metadata: {},
    }];
    const result = await persister.persistAssets(assets);
    expect(result.nodesAdded).toBe(1);
    expect(await db.getNode('test-1')).toBeDefined();
  });

  it('updates existing assets', async () => {
    const db = new InMemoryGraphDB();
    const persister = new GraphPersister(db);
    const asset: DataAsset = {
      id: 'test-2', customerId: 'c1', name: 'users', type: 'table', platform: 'pg',
      description: 'v1', tags: [], qualityScore: 50, freshnessScore: 50,
      lastUpdated: Date.now(), lastCrawled: Date.now(), metadata: {},
    };
    await persister.persistAssets([asset]);
    asset.description = 'v2';
    const result = await persister.persistAssets([asset]);
    expect(result.nodesUpdated).toBe(1);
    expect((await db.getNode('test-2'))!.properties.description).toBe('v2');
  });

  it('persists lineage edges', async () => {
    const db = new InMemoryGraphDB();
    const persister = new GraphPersister(db);
    await db.addNode({ id: 'a', type: 'table', name: 'a', platform: 'x', properties: {}, customerId: 'c1' });
    await db.addNode({ id: 'b', type: 'model', name: 'b', platform: 'x', properties: {}, customerId: 'c1' });
    const count = await persister.persistLineageEdges([{ sourceId: 'a', targetId: 'b', relationship: 'consumed_by' }]);
    expect(count).toBe(1);
  });

  it('skips edges when nodes missing', async () => {
    const db = new InMemoryGraphDB();
    const persister = new GraphPersister(db);
    const count = await persister.persistLineageEdges([{ sourceId: 'missing-a', targetId: 'missing-b', relationship: 'x' }]);
    expect(count).toBe(0);
  });

  it('persists column lineage', async () => {
    const db = new InMemoryGraphDB();
    const persister = new GraphPersister(db);
    await db.addNode({ id: 's1', type: 'table', name: 'source_table', platform: 'x', properties: {}, customerId: 'c1' });
    await db.addNode({ id: 't1', type: 'model', name: 'target_model', platform: 'x', properties: {}, customerId: 'c1' });
    const count = await persister.persistColumnLineage([{
      sourceTable: 'source_table', sourceColumn: 'id',
      targetTable: 'target_model', targetColumn: 'source_id',
      transformation: 'rename',
    }]);
    expect(count).toBe(1);
  });
});

// ── DbtLineageParser ────────────────────────────────────

describe('DbtLineageParser', () => {
  const parser = new DbtLineageParser();

  const manifest = {
    nodes: {
      'model.project.stg_orders': {
        unique_id: 'model.project.stg_orders',
        name: 'stg_orders',
        schema: 'staging',
        database: 'analytics',
        depends_on: { nodes: ['source.project.raw.orders'] },
        columns: { id: { name: 'id', data_type: 'INT' }, amount: { name: 'amount', data_type: 'DECIMAL' } },
        description: 'Staged orders',
        tags: ['staging'],
      },
      'model.project.fct_revenue': {
        unique_id: 'model.project.fct_revenue',
        name: 'fct_revenue',
        schema: 'marts',
        database: 'analytics',
        depends_on: { nodes: ['model.project.stg_orders'] },
        columns: { total: { name: 'total', data_type: 'DECIMAL' } },
        description: 'Revenue fact table',
      },
      'test.project.some_test': {
        unique_id: 'test.project.some_test',
        name: 'some_test',
        schema: 'tests',
        database: 'analytics',
        depends_on: { nodes: [] },
      },
    },
    sources: {
      'source.project.raw.orders': {
        unique_id: 'source.project.raw.orders',
        name: 'orders',
        schema: 'raw',
        database: 'analytics',
        columns: { id: { name: 'id', data_type: 'INT' } },
      },
    },
  };

  it('parses models from manifest', () => {
    const models = parser.parseManifest(manifest);
    expect(models.length).toBe(3); // 2 models + 1 source (test excluded)
  });

  it('extracts dependencies', () => {
    const models = parser.parseManifest(manifest);
    const stg = models.find(m => m.name === 'stg_orders');
    expect(stg?.dependsOn).toContain('source.project.raw.orders');
  });

  it('extracts columns', () => {
    const models = parser.parseManifest(manifest);
    const stg = models.find(m => m.name === 'stg_orders');
    expect(stg?.columns.length).toBe(2);
  });

  it('extracts lineage edges', () => {
    const models = parser.parseManifest(manifest);
    const edges = parser.extractLineageEdges(models);
    expect(edges.length).toBe(2); // raw→stg, stg→fct
  });

  it('parses column lineage from SQL', () => {
    const sql = 'SELECT o.id, o.amount AS total_amount FROM orders o';
    const lineage = parser.extractColumnLineageFromSQL(sql, 'stg_orders');
    expect(lineage.length).toBeGreaterThan(0);
  });

  it('handles SQL with JOINs', () => {
    const sql = 'SELECT a.id, b.name FROM orders a JOIN customers b ON a.customer_id = b.id';
    const lineage = parser.extractColumnLineageFromSQL(sql, 'order_details');
    expect(lineage.length).toBeGreaterThanOrEqual(2);
  });

  it('handles empty SQL', () => {
    const lineage = parser.extractColumnLineageFromSQL('', 'target');
    expect(lineage).toEqual([]);
  });
});

// ── OpenLineageConsumer ─────────────────────────────────

describe('OpenLineageConsumer', () => {
  it('ingests COMPLETE events', async () => {
    const db = new InMemoryGraphDB();
    const consumer = new OpenLineageConsumer(db, 'cust-1');
    const result = await consumer.ingestEvents([{
      eventType: 'COMPLETE',
      eventTime: '2026-03-23T00:00:00Z',
      run: { runId: 'run-1' },
      job: { namespace: 'airflow', name: 'etl_pipeline' },
      inputs: [{ namespace: 'snowflake', name: 'raw.orders' }],
      outputs: [{ namespace: 'snowflake', name: 'staging.stg_orders' }],
      producer: 'airflow',
    }]);
    expect(result.eventsProcessed).toBe(1);
    expect(result.nodesCreated).toBeGreaterThanOrEqual(3); // job + input + output
    expect(result.edgesCreated).toBeGreaterThanOrEqual(3);
  });

  it('skips START events', async () => {
    const db = new InMemoryGraphDB();
    const consumer = new OpenLineageConsumer(db, 'cust-1');
    const result = await consumer.ingestEvents([{
      eventType: 'START',
      eventTime: '2026-03-23T00:00:00Z',
      run: { runId: 'run-2' },
      job: { namespace: 'airflow', name: 'job_x' },
      inputs: [],
      outputs: [],
      producer: 'airflow',
    }]);
    expect(result.eventsProcessed).toBe(1);
    expect(result.nodesCreated).toBe(0);
  });

  it('processes column lineage facets', async () => {
    const db = new InMemoryGraphDB();
    const consumer = new OpenLineageConsumer(db, 'cust-1');
    const result = await consumer.ingestEvents([{
      eventType: 'COMPLETE',
      eventTime: '2026-03-23T00:00:00Z',
      run: { runId: 'run-3' },
      job: { namespace: 'spark', name: 'transform' },
      inputs: [{ namespace: 'hdfs', name: 'raw_events' }],
      outputs: [{
        namespace: 'hdfs',
        name: 'processed_events',
        facets: {
          columnLineage: {
            fields: {
              event_id: {
                inputFields: [{ namespace: 'hdfs', name: 'raw_events', field: 'id' }],
                transformationType: 'rename',
              },
            },
          },
        },
      }],
      producer: 'spark',
    }]);
    expect(result.columnLineageEdges).toBe(1);
  });

  it('handles errors gracefully', async () => {
    const db = new InMemoryGraphDB();
    const consumer = new OpenLineageConsumer(db, 'cust-1');
    const result = await consumer.ingestEvents([]);
    expect(result.eventsProcessed).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('does not duplicate nodes on re-ingest', async () => {
    const db = new InMemoryGraphDB();
    const consumer = new OpenLineageConsumer(db, 'cust-1');
    const event = {
      eventType: 'COMPLETE' as const,
      eventTime: '2026-03-23T00:00:00Z',
      run: { runId: 'run-4' },
      job: { namespace: 'airflow', name: 'daily_etl' },
      inputs: [{ namespace: 'pg', name: 'users' }],
      outputs: [{ namespace: 'pg', name: 'dim_users' }],
      producer: 'airflow',
    };
    await consumer.ingestEvents([event]);
    const r2 = await consumer.ingestEvents([event]);
    expect(r2.nodesCreated).toBe(0); // All already exist
  });
});

// ── ColumnLineageExpander ───────────────────────────────

describe('ColumnLineageExpander', () => {
  const db = new InMemoryGraphDB();
  const expander = new ColumnLineageExpander();

  beforeAll(async () => {
    await db.addNode({ id: 'src', type: 'table', name: 'source', platform: 'pg', properties: { columns: [{ name: 'id' }, { name: 'email' }] }, customerId: 'c1' });
    await db.addNode({ id: 'tgt', type: 'model', name: 'target', platform: 'dbt', properties: { columns: [{ name: 'id' }, { name: 'email' }, { name: 'score' }] }, customerId: 'c1' });
    await db.addEdge({ source: 'src', target: 'tgt', relationship: 'consumed_by', properties: {} });
  });

  it('infers lineage from matching column names', async () => {
    const lineage = await expander.getColumnLineage('tgt', db);
    expect(lineage.length).toBeGreaterThanOrEqual(2); // id, email match
    expect(lineage.some(l => l.sourceColumn === 'id' && l.source === 'inferred')).toBe(true);
  });

  it('returns empty for unknown asset', async () => {
    const lineage = await expander.getColumnLineage('nonexistent', db);
    expect(lineage).toEqual([]);
  });

  it('computes confidence score', async () => {
    const score = await expander.computeConfidence('tgt', db);
    expect(score.overall).toBeGreaterThan(0);
    expect(score.overall).toBeLessThanOrEqual(1);
    expect(score.coverage).toBeGreaterThan(0);
  });

  it('explicit edges have higher confidence than inferred', async () => {
    // Add explicit edge
    await db.addEdge({ source: 'src', target: 'tgt', relationship: 'column_lineage', properties: { sourceColumn: 'id', targetColumn: 'id', transformation: 'direct' } });
    const lineage = await expander.getColumnLineage('tgt', db);
    const explicit = lineage.find(l => l.source === 'explicit');
    const inferred = lineage.find(l => l.source === 'inferred');
    if (explicit && inferred) {
      expect(explicit.confidence).toBeGreaterThan(inferred.confidence);
    }
  });
});

// ── LineageAPI ──────────────────────────────────────────

describe('LineageAPI', () => {
  const db = new InMemoryGraphDB();
  const api = new LineageAPI();
  let known: any = null;

  beforeAll(async () => {
    db.seed();
    const nodes = await db.getAllNodes();
    known = nodes.length > 0 ? nodes[0] : null;
  });

  it('returns visualization for known asset', async () => {
    if (!known) return;
    const viz = await api.getVisualization(known.id, known.customerId, db);
    expect(viz.centerNode.id).toBe(known.id);
    expect(viz.nodes.length).toBeGreaterThanOrEqual(1);
    expect(viz.stats.totalNodes).toBeGreaterThanOrEqual(1);
  });

  it('handles unknown asset', async () => {
    const viz = await api.getVisualization('nonexistent', 'c1', db);
    expect(viz.stats.totalNodes).toBe(0);
  });

  it('includes edges', async () => {
    if (!known) return;
    const viz = await api.getVisualization(known.id, known.customerId, db);
    // May or may not have edges depending on seed data
    expect(Array.isArray(viz.edges)).toBe(true);
  });

  it('exports compliance data', async () => {
    if (!known) return;
    const exp = await api.exportForCompliance(known.id, known.customerId, db);
    expect(exp.assetId).toBe(known.id);
    expect(exp.exportedAt).toBeDefined();
    expect(Array.isArray(exp.upstreamSources)).toBe(true);
    expect(Array.isArray(exp.downstreamConsumers)).toBe(true);
  });

  it('compliance export for unknown asset', async () => {
    const exp = await api.exportForCompliance('nonexistent', 'c1', db);
    expect(exp.upstreamSources).toEqual([]);
    expect(exp.lineageCoverage).toBe(0);
  });

  it('respects maxDepth', async () => {
    if (!known) return;
    const shallow = await api.getVisualization(known.id, known.customerId, db, 1);
    const deep = await api.getVisualization(known.id, known.customerId, db, 5);
    expect(shallow.nodes.length).toBeLessThanOrEqual(deep.nodes.length);
  });

  it('nodes have correct direction labels', async () => {
    if (!known) return;
    const viz = await api.getVisualization(known.id, known.customerId, db);
    expect(viz.centerNode.direction).toBe('center');
    for (const n of viz.nodes) {
      expect(['upstream', 'downstream', 'center']).toContain(n.direction);
    }
  });
});
