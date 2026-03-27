import { describe, it, expect, beforeEach } from 'vitest';
import { OpenLineageConnector } from '../index.js';

describe('OpenLineageConnector', () => {
  let connector: OpenLineageConnector;

  beforeEach(() => {
    connector = new OpenLineageConnector();
  });

  // --- connect / disconnect / healthCheck ---

  describe('connect / disconnect / healthCheck', () => {
    it('should connect successfully', () => {
      connector.connect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should report unhealthy when disconnected', () => {
      connector.connect();
      connector.disconnect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should report unhealthy before connecting', () => {
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should have correct connector type', () => {
      expect(connector.connectorType).toBe('openlineage');
      expect(connector.providerType).toBe('openlineage');
    });

    it('should have correct capabilities', () => {
      expect(connector.capabilities).toContain('discovery');
      expect(connector.capabilities).toContain('lineage');
    });
  });

  // --- listMarquezNamespaces ---

  describe('listMarquezNamespaces', () => {
    it('should return seeded namespaces', () => {
      connector.connect();
      const namespaces = connector.listMarquezNamespaces();
      expect(namespaces).toHaveLength(3);
      const names = namespaces.map((ns) => ns.name).sort();
      expect(names).toEqual(['analytics', 'default', 'etl_pipeline']);
      expect(namespaces[0].ownerName).toBeDefined();
      expect(namespaces[0].createdAt).toBeGreaterThan(0);
    });
  });

  // --- listNamespaces ---

  describe('listNamespaces', () => {
    it('should return namespaces in ICatalogProvider format', () => {
      connector.connect();
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(3);
      const names = namespaces.map((ns) => ns.name[0]).sort();
      expect(names).toEqual(['analytics', 'default', 'etl_pipeline']);
      expect(namespaces[0].properties).toHaveProperty('ownerName');
    });
  });

  // --- listDatasets ---

  describe('listDatasets', () => {
    it('should return datasets for default namespace', () => {
      connector.connect();
      const datasets = connector.listDatasets('default');
      expect(datasets).toHaveLength(3);
      const names = datasets.map((d) => d.name).sort();
      expect(names).toEqual(['raw_customers', 'raw_orders', 'raw_products']);
    });

    it('should return datasets for etl_pipeline namespace', () => {
      connector.connect();
      const datasets = connector.listDatasets('etl_pipeline');
      expect(datasets).toHaveLength(2);
    });

    it('should throw for unknown namespace', () => {
      connector.connect();
      expect(() => connector.listDatasets('nonexistent')).toThrow('Namespace not found');
    });
  });

  // --- listTables ---

  describe('listTables', () => {
    it('should return datasets as table metadata', () => {
      connector.connect();
      const tables = connector.listTables('default');
      expect(tables).toHaveLength(3);
      expect(tables[0].schema.length).toBeGreaterThan(0);
      expect(tables[0].properties).toHaveProperty('sourceName');
    });
  });

  // --- getTableMetadata ---

  describe('getTableMetadata', () => {
    it('should return dataset metadata with fields', () => {
      connector.connect();
      const meta = connector.getTableMetadata('default', 'raw_orders');
      expect(meta.name).toBe('raw_orders');
      expect(meta.namespace).toEqual(['default']);
      expect(meta.schema.length).toBeGreaterThan(0);
      expect(meta.schema[0].name).toBe('order_id');
    });

    it('should throw for unknown dataset', () => {
      connector.connect();
      expect(() => connector.getTableMetadata('default', 'nonexistent')).toThrow('Dataset not found');
    });
  });

  // --- listJobs ---

  describe('listJobs', () => {
    it('should return jobs for etl_pipeline namespace', () => {
      connector.connect();
      const jobs = connector.listJobs('etl_pipeline');
      expect(jobs).toHaveLength(3);
      const names = jobs.map((j) => j.name).sort();
      expect(names).toContain('clean_orders_job');
      expect(jobs[0].inputs.length).toBeGreaterThan(0);
      expect(jobs[0].outputs.length).toBeGreaterThan(0);
    });

    it('should return empty for namespace without jobs', () => {
      connector.connect();
      const jobs = connector.listJobs('default');
      expect(jobs).toHaveLength(0);
    });
  });

  // --- getLineage ---

  describe('getLineage', () => {
    it('should return lineage graph with nodes and edges', () => {
      connector.connect();
      const graph = connector.getLineage('dataset:analytics.daily_revenue', 'upstream');
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should return empty graph for unknown node', () => {
      connector.connect();
      const graph = connector.getLineage('dataset:nonexistent', 'upstream');
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });
  });

  // --- emitRunEvent ---

  describe('emitRunEvent', () => {
    it('should accept and store run events', () => {
      connector.connect();
      const event = {
        eventType: 'COMPLETE' as const,
        eventTime: new Date().toISOString(),
        run: { runId: 'run-001' },
        job: { namespace: 'etl_pipeline', name: 'test_job' },
        inputs: [{ namespace: 'default', name: 'raw_orders' }],
        outputs: [{ namespace: 'etl_pipeline', name: 'cleaned_orders' }],
        producer: 'data-workers',
      };
      expect(() => connector.emitRunEvent(event)).not.toThrow();
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.listMarquezNamespaces()).toThrow('Not connected');
      expect(() => connector.listDatasets('default')).toThrow('Not connected');
      expect(() => connector.listTables('default')).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.getTableMetadata('default', 'raw_orders')).toThrow('Not connected');
      expect(() => connector.listJobs('etl_pipeline')).toThrow('Not connected');
      expect(() => connector.getLineage('dataset:test', 'upstream')).toThrow('Not connected');
    });
  });
});
