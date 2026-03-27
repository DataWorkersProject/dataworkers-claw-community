import { describe, it, expect, beforeEach } from 'vitest';
import { BigQueryConnector } from '../index.js';

describe('BigQueryConnector', () => {
  let connector: BigQueryConnector;

  beforeEach(() => {
    connector = new BigQueryConnector();
  });

  // --- connect / disconnect / healthCheck ---

  describe('connect / disconnect / healthCheck', () => {
    it('should connect with a valid project ID', () => {
      connector.connect('my-project');
      const health = connector.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw when connecting with an empty project ID', () => {
      expect(() => connector.connect('')).toThrow('A valid project ID is required');
    });

    it('should report unhealthy when disconnected', () => {
      connector.connect('my-project');
      connector.disconnect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should throw on operations when not connected', () => {
      expect(() => connector.listNamespaces()).toThrow('Not connected');
    });
  });

  // --- listDatasets ---

  describe('listDatasets', () => {
    it('should return seeded datasets', () => {
      connector.connect('my-project');
      const datasets = connector.listDatasets();
      expect(datasets).toHaveLength(2);
      const ids = datasets.map((d) => d.datasetId).sort();
      expect(ids).toEqual(['analytics', 'raw_events']);
      expect(datasets[0].location).toBe('US');
    });
  });

  // --- listTables ---

  describe('listTables', () => {
    it('should return tables for analytics dataset', () => {
      connector.connect('my-project');
      const tables = connector.listTables('analytics');
      expect(tables).toHaveLength(3);
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['customers', 'orders', 'revenue_daily']);
    });

    it('should throw for unknown dataset', () => {
      connector.connect('my-project');
      expect(() => connector.listTables('nonexistent')).toThrow('Dataset not found');
    });
  });

  // --- getTableSchema ---

  describe('getTableSchema', () => {
    it('should return schema with columns for orders', () => {
      connector.connect('my-project');
      const schema = connector.getTableSchema('analytics', 'orders');
      expect(schema.datasetId).toBe('analytics');
      expect(schema.tableId).toBe('orders');
      expect(schema.columns).toHaveLength(5);
      expect(schema.columns[0].name).toBe('order_id');
      expect(schema.columns[0].mode).toBe('REQUIRED');
    });

    it('should throw for unknown table', () => {
      connector.connect('my-project');
      expect(() => connector.getTableSchema('analytics', 'unknown')).toThrow('Table not found');
    });
  });

  // --- getJobHistory ---

  describe('getJobHistory', () => {
    it('should return all jobs by default', () => {
      connector.connect('my-project');
      const jobs = connector.getJobHistory();
      expect(jobs).toHaveLength(5);
      // Should be sorted by createdAt descending
      for (let i = 1; i < jobs.length; i++) {
        expect(jobs[i - 1].createdAt).toBeGreaterThan(jobs[i].createdAt);
      }
    });

    it('should respect custom limit', () => {
      connector.connect('my-project');
      const jobs = connector.getJobHistory(2);
      expect(jobs).toHaveLength(2);
    });
  });

  // --- estimateQueryCost ---

  describe('estimateQueryCost', () => {
    it('should estimate higher cost for full table scan', () => {
      connector.connect('my-project');
      const estimate = connector.estimateQueryCost('SELECT * FROM analytics.orders');
      expect(estimate.estimatedBytesProcessed).toBe(10_000_000_000);
      expect(estimate.estimatedCostUSD).toBeGreaterThan(0);
      expect(estimate.tier).toBe('on-demand');
    });

    it('should estimate lower cost for aggregation query', () => {
      connector.connect('my-project');
      const fullScan = connector.estimateQueryCost('SELECT * FROM analytics.orders');
      const aggregation = connector.estimateQueryCost('SELECT customer_id, COUNT(*) FROM analytics.orders GROUP BY 1');
      expect(aggregation.estimatedBytesProcessed).toBeLessThan(fullScan.estimatedBytesProcessed);
      expect(aggregation.estimatedCostUSD).toBeLessThan(fullScan.estimatedCostUSD);
    });
  });

  // --- listNamespaces ---

  describe('listNamespaces', () => {
    it('should return datasets as namespaces', () => {
      connector.connect('my-project');
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(2);
      const names = namespaces.map((ns) => ns.name[0]).sort();
      expect(names).toEqual(['analytics', 'raw_events']);
      expect(namespaces[0].properties).toHaveProperty('location');
    });
  });

  // --- getTableMetadata ---

  describe('getTableMetadata', () => {
    it('should return table metadata with schema columns', () => {
      connector.connect('my-project');
      const meta = connector.getTableMetadata('analytics', 'orders');
      expect(meta.name).toBe('orders');
      expect(meta.namespace).toEqual(['analytics']);
      expect(meta.schema).toHaveLength(5);
      expect(meta.schema[0].name).toBe('order_id');
      expect(meta.schema[0].type).toBe('INT64');
      expect(meta.schema[0].nullable).toBe(false);
      expect(meta.properties).toHaveProperty('type', 'TABLE');
      expect(meta.properties).toHaveProperty('numRows', '10000000');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw for operations when not connected', () => {
      expect(() => connector.listDatasets()).toThrow('Not connected');
      expect(() => connector.getJobHistory()).toThrow('Not connected');
      expect(() => connector.estimateQueryCost('SELECT 1')).toThrow('Not connected');
    });

    it('should throw for unknown dataset in listTables', () => {
      connector.connect('my-project');
      expect(() => connector.listTables('missing_dataset')).toThrow('Dataset not found');
    });
  });
});
