import { describe, it, expect, beforeEach } from 'vitest';
import { DbtConnector } from '../index.js';
import type { DbtManifest, DbtModel } from '../types.js';

/** Helper: build a minimal manifest for testing. */
function buildTestManifest(): DbtManifest {
  const modelA: DbtModel = {
    uniqueId: 'model.test.model_a',
    name: 'model_a',
    schema: 'public',
    database: 'testdb',
    materialization: 'table',
    description: 'Model A',
    columns: [
      { name: 'id', description: 'PK', type: 'integer', tests: ['unique'] },
    ],
    dependsOn: [],
    tags: ['core'],
  };

  const modelB: DbtModel = {
    uniqueId: 'model.test.model_b',
    name: 'model_b',
    schema: 'public',
    database: 'testdb',
    materialization: 'view',
    description: 'Model B depends on A',
    columns: [
      { name: 'id', description: 'PK', type: 'integer', tests: ['unique'] },
      { name: 'a_id', description: 'FK to A', type: 'integer', tests: ['not_null'] },
    ],
    dependsOn: ['model.test.model_a'],
    tags: ['derived'],
  };

  const sourceX: DbtModel = {
    uniqueId: 'source.test.raw_source',
    name: 'raw_source',
    schema: 'raw',
    database: 'testdb',
    materialization: 'view',
    description: 'Raw source table',
    columns: [
      { name: 'id', description: 'PK', type: 'integer', tests: [] },
    ],
    dependsOn: [],
    tags: ['source'],
  };

  return {
    metadata: {
      dbtVersion: '1.7.0',
      projectName: 'test_project',
      generatedAt: '2026-03-22T10:00:00Z',
    },
    nodes: {
      'model.test.model_a': modelA,
      'model.test.model_b': modelB,
    },
    sources: {
      'source.test.raw_source': sourceX,
    },
  };
}

describe('DbtConnector', () => {
  let connector: DbtConnector;

  beforeEach(() => {
    connector = new DbtConnector();
  });

  // --- connect / disconnect / healthCheck ---

  describe('connect / disconnect / healthCheck', () => {
    it('should connect with a valid API token', () => {
      connector.connect('dbt_cloud_token_123');
      const health = connector.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw when connecting with an empty token', () => {
      expect(() => connector.connect('')).toThrow('A valid API token is required');
    });

    it('should report unhealthy when disconnected', () => {
      connector.connect('dbt_cloud_token_123');
      connector.disconnect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });

  // --- listModels ---

  describe('listModels', () => {
    it('should return all 5 seeded models', async () => {
      connector.connect('dbt_cloud_token_123');
      const models = await connector.listModels();
      expect(models).toHaveLength(5);
      const names = models.map((m) => m.name).sort();
      expect(names).toEqual([
        'dim_customers',
        'fct_orders',
        'int_order_items',
        'stg_customers',
        'stg_orders',
      ]);
    });
  });

  // --- getModelLineage ---

  describe('getModelLineage', () => {
    it('should return lineage edges for a model with dependencies', async () => {
      connector.connect('dbt_cloud_token_123');
      const edges = await connector.getModelLineage('model.project.int_order_items');
      expect(edges.length).toBeGreaterThanOrEqual(1);

      // Should have stg_orders as parent
      const parentEdge = edges.find((e) => e.parent === 'model.project.stg_orders');
      expect(parentEdge).toBeDefined();
      expect(parentEdge!.child).toBe('model.project.int_order_items');
      expect(parentEdge!.relationship).toBe('ref');

      // Should have fct_orders as child
      const childEdge = edges.find((e) => e.child === 'model.project.fct_orders');
      expect(childEdge).toBeDefined();
    });

    it('should return empty lineage for a model with no dependencies', async () => {
      connector.connect('dbt_cloud_token_123');
      const edges = await connector.getModelLineage('model.project.stg_orders');

      // stg_orders has no parents (dependsOn is empty)
      const parentEdges = edges.filter((e) => e.child === 'model.project.stg_orders');
      expect(parentEdges).toHaveLength(0);

      // But it should have children that depend on it
      const childEdges = edges.filter((e) => e.parent === 'model.project.stg_orders');
      expect(childEdges.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- getTestResults ---

  describe('getTestResults', () => {
    it('should return all 8 test results', async () => {
      connector.connect('dbt_cloud_token_123');
      const results = await connector.getTestResults();
      expect(results).toHaveLength(8);
    });

    it('should have correct pass/fail distribution', async () => {
      connector.connect('dbt_cloud_token_123');
      const results = await connector.getTestResults();
      const pass = results.filter((r) => r.status === 'pass').length;
      const fail = results.filter((r) => r.status === 'fail').length;
      const warn = results.filter((r) => r.status === 'warn').length;
      const error = results.filter((r) => r.status === 'error').length;

      expect(pass).toBe(5);
      expect(fail).toBe(1);
      expect(warn).toBe(1);
      expect(error).toBe(1);
    });
  });

  // --- getRunHistory ---

  describe('getRunHistory', () => {
    it('should return all 3 run history entries (newest first)', async () => {
      connector.connect('dbt_cloud_token_123');
      const history = await connector.getRunHistory();
      expect(history).toHaveLength(3);
      expect(history[0].runId).toBe('run_003');
      expect(history[2].runId).toBe('run_001');
    });

    it('should respect custom limit', async () => {
      connector.connect('dbt_cloud_token_123');
      const history = await connector.getRunHistory(2);
      expect(history).toHaveLength(2);
      expect(history[0].runId).toBe('run_003');
      expect(history[1].runId).toBe('run_002');
    });
  });

  // --- loadManifest mode ---

  describe('loadManifest mode', () => {
    it('should parse and load a manifest', () => {
      const manifest = buildTestManifest();
      connector.loadManifest(manifest);
      const health = connector.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should list models from manifest', async () => {
      const manifest = buildTestManifest();
      connector.loadManifest(manifest);
      const models = await connector.listModels();
      expect(models).toHaveLength(2); // only nodes, not sources
      const names = models.map((m) => m.name).sort();
      expect(names).toEqual(['model_a', 'model_b']);
    });

    it('should build lineage from manifest', async () => {
      const manifest = buildTestManifest();
      connector.loadManifest(manifest);
      const edges = await connector.getModelLineage('model.test.model_b');
      expect(edges).toHaveLength(1);
      expect(edges[0].parent).toBe('model.test.model_a');
      expect(edges[0].child).toBe('model.test.model_b');
      expect(edges[0].relationship).toBe('ref');
    });
  });

  // --- listNamespaces ---

  describe('listNamespaces', () => {
    it('should return unique schemas as namespaces', async () => {
      connector.connect('dbt_cloud_token_123');
      const namespaces = await connector.listNamespaces();
      expect(namespaces.length).toBeGreaterThanOrEqual(3);
      const schemaNames = namespaces.map((ns) => ns.name[1]).sort();
      expect(schemaNames).toEqual(expect.arrayContaining(['staging', 'intermediate', 'marts']));
    });
  });

  // --- listTables ---

  describe('listTables', () => {
    it('should return models in a specific schema', async () => {
      connector.connect('dbt_cloud_token_123');
      const tables = await connector.listTables('staging');
      expect(tables).toHaveLength(2);
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['stg_customers', 'stg_orders']);
    });
  });

  // --- getTableMetadata ---

  describe('getTableMetadata', () => {
    it('should return metadata for a specific model', async () => {
      connector.connect('dbt_cloud_token_123');
      const meta = await connector.getTableMetadata('marts', 'fct_orders');
      expect(meta.name).toBe('fct_orders');
      expect(meta.namespace).toEqual(['analytics', 'marts']);
      expect(meta.schema.length).toBeGreaterThanOrEqual(2);
      expect(meta.properties.materialization).toBe('table');
      expect(meta.properties).toHaveProperty('uniqueId', 'model.project.fct_orders');
    });
  });

  // --- error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', async () => {
      await expect(connector.listModels()).rejects.toThrow('Not connected');
    });

    it('should throw for unknown model in getTableMetadata', async () => {
      connector.connect('dbt_cloud_token_123');
      await expect(connector.getTableMetadata('marts', 'nonexistent')).rejects.toThrow('Model not found');
    });
  });
});
