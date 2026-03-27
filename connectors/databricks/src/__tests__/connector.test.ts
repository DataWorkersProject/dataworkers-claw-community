import { describe, it, expect, beforeEach } from 'vitest';
import { DatabricksConnector } from '../index.js';

describe('DatabricksConnector', () => {
  let connector: DatabricksConnector;

  beforeEach(() => {
    connector = new DatabricksConnector();
  });

  // --- connect / disconnect / healthCheck ---

  describe('connect / disconnect / healthCheck', () => {
    it('should connect with valid host and token', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const health = connector.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw when connecting with an empty host', () => {
      expect(() => connector.connect('', 'dapi1234567890')).toThrow('A valid Databricks host URL is required');
    });

    it('should throw when connecting with an empty token', () => {
      expect(() => connector.connect('https://my-workspace.cloud.databricks.com', '')).toThrow(
        'A valid Databricks access token is required',
      );
    });

    it('should report unhealthy when disconnected', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      connector.disconnect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });

  // --- listCatalogs ---

  describe('listCatalogs', () => {
    it('should return seeded catalogs', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const catalogs = connector.listCatalogs();
      expect(catalogs).toHaveLength(2);
      const names = catalogs.map((c) => c.name).sort();
      expect(names).toEqual(['hive_metastore', 'main']);
      expect(catalogs.find((c) => c.name === 'main')!.owner).toBe('data-engineering');
    });
  });

  // --- listSchemas ---

  describe('listSchemas', () => {
    it('should return schemas for main catalog', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const schemas = connector.listSchemas('main');
      expect(schemas).toHaveLength(2);
      const names = schemas.map((s) => s.name).sort();
      expect(names).toEqual(['analytics', 'default']);
    });

    it('should throw for unknown catalog', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      expect(() => connector.listSchemas('nonexistent')).toThrow('Catalog not found');
    });
  });

  // --- listTables (Databricks-specific via getTable's underlying listTables) ---

  describe('listTables', () => {
    it('should return tables for main catalog across all schemas', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const tables = connector.listTables('main');
      expect(tables.length).toBe(4);
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['customers', 'daily_metrics', 'orders', 'revenue_view']);
    });

    it('should throw for unknown catalog', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      expect(() => connector.listTables('nonexistent')).toThrow('Catalog not found');
    });
  });

  // --- getTable ---

  describe('getTable', () => {
    it('should return table with columns and DELTA format', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const table = connector.getTable('main', 'default', 'orders');
      expect(table.name).toBe('orders');
      expect(table.catalogName).toBe('main');
      expect(table.schemaName).toBe('default');
      expect(table.tableType).toBe('MANAGED');
      expect(table.dataSourceFormat).toBe('DELTA');
      expect(table.columns).toHaveLength(5);
      expect(table.columns[0].name).toBe('order_id');
      expect(table.owner).toBe('data-engineering');
    });

    it('should throw for unknown table', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      expect(() => connector.getTable('main', 'default', 'nonexistent')).toThrow('Table not found');
    });
  });

  // --- getQueryHistory ---

  describe('getQueryHistory', () => {
    it('should return all query history entries by default', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const history = connector.getQueryHistory();
      expect(history).toHaveLength(5);
      // Should be sorted by startTime descending
      for (let i = 1; i < history.length; i++) {
        expect(history[i - 1].startTime).toBeGreaterThanOrEqual(history[i].startTime);
      }
    });

    it('should respect custom limit', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const history = connector.getQueryHistory(2);
      expect(history).toHaveLength(2);
    });
  });

  // --- listNamespaces (IDataPlatformConnector) ---

  describe('listNamespaces', () => {
    it('should return catalogs as namespaces', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(2);
      const names = namespaces.map((ns) => ns.name[0]).sort();
      expect(names).toEqual(['hive_metastore', 'main']);
      expect(namespaces.find((ns) => ns.name[0] === 'main')!.properties).toHaveProperty('owner');
    });
  });

  // --- getTableMetadata (IDataPlatformConnector) ---

  describe('getTableMetadata', () => {
    it('should find table across schemas in a catalog', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      const meta = connector.getTableMetadata('main', 'orders');
      expect(meta.name).toBe('orders');
      expect(meta.namespace).toEqual(['main', 'default']);
      expect(meta.schema.length).toBe(5);
      expect(meta.properties.tableType).toBe('MANAGED');
      expect(meta.properties.dataSourceFormat).toBe('DELTA');
    });
  });

  // --- error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.listCatalogs()).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.listTables('main')).toThrow('Not connected');
    });

    it('should throw for unknown catalog in listSchemas', () => {
      connector.connect('https://my-workspace.cloud.databricks.com', 'dapi1234567890');
      expect(() => connector.listSchemas('unknown_catalog')).toThrow('Catalog not found');
    });
  });
});
