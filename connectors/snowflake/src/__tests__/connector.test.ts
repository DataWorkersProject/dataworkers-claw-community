import { describe, it, expect, beforeEach } from 'vitest';
import { SnowflakeConnector } from '../index.js';

describe('SnowflakeConnector', () => {
  let connector: SnowflakeConnector;

  beforeEach(() => {
    connector = new SnowflakeConnector();
  });

  // --- connect / disconnect / healthCheck ---

  describe('connect / disconnect / healthCheck', () => {
    it('should connect with a valid account identifier', () => {
      connector.connect('my-org.us-east-1');
      const health = connector.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw when connecting with an empty account', () => {
      expect(() => connector.connect('')).toThrow('A valid Snowflake account identifier is required');
    });

    it('should report unhealthy when disconnected', () => {
      connector.connect('my-org.us-east-1');
      connector.disconnect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should report unhealthy before connecting', () => {
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });

  // --- listDatabases ---

  describe('listDatabases', () => {
    it('should return seeded databases', () => {
      connector.connect('my-org.us-east-1');
      const databases = connector.listDatabases();
      expect(databases).toHaveLength(2);
      const names = databases.map((d) => d.name).sort();
      expect(names).toEqual(['ANALYTICS', 'RAW']);
      expect(databases[0].owner).toBeDefined();
      expect(databases[0].createdAt).toBeGreaterThan(0);
      expect(databases[0].comment).toBeDefined();
    });
  });

  // --- listSchemas ---

  describe('listSchemas', () => {
    it('should return schemas for a valid database', () => {
      connector.connect('my-org.us-east-1');
      const schemas = connector.listSchemas('ANALYTICS');
      expect(schemas).toHaveLength(2);
      const names = schemas.map((s) => s.name).sort();
      expect(names).toEqual(['MARTS', 'PUBLIC']);
      expect(schemas[0].database).toBe('ANALYTICS');
    });

    it('should throw for unknown database', () => {
      connector.connect('my-org.us-east-1');
      expect(() => connector.listSchemas('NONEXISTENT')).toThrow('Database not found');
    });
  });

  // --- listTables (Snowflake-specific via IDataPlatformConnector) ---

  describe('listTables', () => {
    it('should return tables for a valid database.schema namespace', () => {
      connector.connect('my-org.us-east-1');
      const tables = connector.listTables('ANALYTICS.PUBLIC');
      expect(tables).toHaveLength(2);
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['CUSTOMERS', 'ORDERS']);
    });

    it('should throw for unknown schema', () => {
      connector.connect('my-org.us-east-1');
      expect(() => connector.listTables('ANALYTICS.NONEXISTENT')).toThrow('Schema not found');
    });
  });

  // --- getTableDDL ---

  describe('getTableDDL', () => {
    it('should return DDL with columns and clustering keys', () => {
      connector.connect('my-org.us-east-1');
      const ddl = connector.getTableDDL('ANALYTICS', 'PUBLIC', 'ORDERS');
      expect(ddl.database).toBe('ANALYTICS');
      expect(ddl.schema).toBe('PUBLIC');
      expect(ddl.table).toBe('ORDERS');
      expect(ddl.columns).toHaveLength(5);
      expect(ddl.columns[0].name).toBe('ORDER_ID');
      expect(ddl.clusteringKeys).toContain('ORDER_DATE');
    });

    it('should throw for unknown table', () => {
      connector.connect('my-org.us-east-1');
      expect(() => connector.getTableDDL('ANALYTICS', 'PUBLIC', 'NONEXISTENT')).toThrow(
        'Table not found',
      );
    });
  });

  // --- queryWarehouseUsage ---

  describe('queryWarehouseUsage', () => {
    it('should return warehouse usage records', () => {
      connector.connect('my-org.us-east-1');
      const usage = connector.queryWarehouseUsage();
      expect(usage).toHaveLength(3);
      const names = usage.map((u) => u.warehouseName).sort();
      expect(names).toEqual(['ANALYST_WH', 'COMPUTE_WH', 'LOADING_WH']);
      for (const record of usage) {
        expect(record.creditsUsed).toBeGreaterThan(0);
        expect(record.queriesExecuted).toBeGreaterThan(0);
        expect(record.avgExecutionTimeMs).toBeGreaterThan(0);
        expect(record.period.start).toBeLessThan(record.period.end);
      }
    });
  });

  // --- getQueryHistory ---

  describe('getQueryHistory', () => {
    it('should return all query history entries by default', () => {
      connector.connect('my-org.us-east-1');
      const history = connector.getQueryHistory();
      expect(history).toHaveLength(5);
      for (const entry of history) {
        expect(entry.queryId).toBeDefined();
        expect(entry.queryText).toBeDefined();
        expect(entry.status).toBe('SUCCESS');
        expect(entry.durationMs).toBeGreaterThan(0);
        expect(entry.user).toBeDefined();
        expect(entry.warehouse).toBeDefined();
        expect(entry.startTime).toBeGreaterThan(0);
      }
    });

    it('should respect custom limit', () => {
      connector.connect('my-org.us-east-1');
      const history = connector.getQueryHistory(2);
      expect(history).toHaveLength(2);
    });
  });

  // --- listNamespaces (IDataPlatformConnector) ---

  describe('listNamespaces', () => {
    it('should return databases as namespaces', () => {
      connector.connect('my-org.us-east-1');
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(2);
      const names = namespaces.map((ns) => ns.name[0]).sort();
      expect(names).toEqual(['ANALYTICS', 'RAW']);
      expect(namespaces[0].properties).toHaveProperty('owner');
    });
  });

  // --- getTableMetadata (IDataPlatformConnector) ---

  describe('getTableMetadata', () => {
    it('should return table metadata with column schema', () => {
      connector.connect('my-org.us-east-1');
      const meta = connector.getTableMetadata('ANALYTICS.PUBLIC', 'ORDERS');
      expect(meta.name).toBe('ORDERS');
      expect(meta.namespace).toEqual(['ANALYTICS', 'PUBLIC']);
      expect(meta.schema).toHaveLength(5);
      expect(meta.schema[0].name).toBe('ORDER_ID');
      expect(meta.schema[0].type).toBe('NUMBER(38,0)');
      expect(meta.properties).toHaveProperty('clusteringKeys');
      expect(meta.properties).toHaveProperty('rowCount', '12000000');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.listDatabases()).toThrow('Not connected');
      expect(() => connector.listSchemas('ANALYTICS')).toThrow('Not connected');
      expect(() => connector.listTables('ANALYTICS.PUBLIC')).toThrow('Not connected');
      expect(() => connector.getTableDDL('ANALYTICS', 'PUBLIC', 'ORDERS')).toThrow('Not connected');
      expect(() => connector.queryWarehouseUsage()).toThrow('Not connected');
      expect(() => connector.getQueryHistory()).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.getTableMetadata('ANALYTICS.PUBLIC', 'ORDERS')).toThrow('Not connected');
    });
  });
});
