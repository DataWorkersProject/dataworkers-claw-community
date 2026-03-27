import { describe, it, expect, beforeEach } from 'vitest';
import { OpenMetadataConnector } from '../index.js';

describe('OpenMetadataConnector', () => {
  let connector: OpenMetadataConnector;

  beforeEach(() => {
    connector = new OpenMetadataConnector();
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
      expect(connector.connectorType).toBe('openmetadata');
      expect(connector.providerType).toBe('openmetadata');
    });

    it('should have correct capabilities', () => {
      expect(connector.capabilities).toContain('discovery');
      expect(connector.capabilities).toContain('lineage');
      expect(connector.capabilities).toContain('governance');
      expect(connector.capabilities).toContain('quality');
      expect(connector.capabilities).toContain('search');
    });
  });

  // --- listDatabases ---

  describe('listDatabases', () => {
    it('should return seeded databases', () => {
      connector.connect();
      const databases = connector.listDatabases();
      expect(databases).toHaveLength(2);
      const names = databases.map((d) => d.name).sort();
      expect(names).toEqual(['analytics_db', 'warehouse_db']);
      expect(databases[0].id).toBeDefined();
      expect(databases[0].fullyQualifiedName).toBeDefined();
      expect(databases[0].service).toBeDefined();
    });
  });

  // --- listNamespaces ---

  describe('listNamespaces', () => {
    it('should return databases as namespaces', () => {
      connector.connect();
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(2);
      const names = namespaces.map((ns) => ns.name[0]).sort();
      expect(names).toEqual(['analytics_db', 'warehouse_db']);
      expect(namespaces[0].properties).toHaveProperty('service');
    });
  });

  // --- listTables ---

  describe('listTables', () => {
    it('should return tables for warehouse_db', () => {
      connector.connect();
      const tables = connector.listTables('warehouse_db');
      expect(tables).toHaveLength(3);
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['customers', 'orders', 'products']);
    });

    it('should return tables for analytics_db', () => {
      connector.connect();
      const tables = connector.listTables('analytics_db');
      expect(tables).toHaveLength(3);
    });

    it('should throw for unknown database', () => {
      connector.connect();
      expect(() => connector.listTables('nonexistent')).toThrow('Database not found');
    });
  });

  // --- getTableMetadata ---

  describe('getTableMetadata', () => {
    it('should return table metadata with columns and tags', () => {
      connector.connect();
      const meta = connector.getTableMetadata('warehouse_db', 'customers');
      expect(meta.name).toBe('customers');
      expect(meta.namespace).toEqual(['warehouse_db']);
      expect(meta.schema.length).toBeGreaterThan(0);
      expect(meta.schema[0].name).toBe('customer_id');
      expect(meta.properties).toHaveProperty('tags');
      expect(meta.properties.tags).toContain('Tier.Tier1');
    });

    it('should throw for unknown table', () => {
      connector.connect();
      expect(() => connector.getTableMetadata('warehouse_db', 'nonexistent')).toThrow('Table not found');
    });
  });

  // --- searchTables ---

  describe('searchTables', () => {
    it('should find tables by name', () => {
      connector.connect();
      const results = connector.searchTables('customer');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name === 'customers')).toBe(true);
    });

    it('should find tables by column name', () => {
      connector.connect();
      const results = connector.searchTables('revenue');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', () => {
      connector.connect();
      const results = connector.searchTables('zzz_nonexistent_zzz');
      expect(results).toHaveLength(0);
    });
  });

  // --- getLineage ---

  describe('getLineage', () => {
    it('should return lineage graph with upstream edges', () => {
      connector.connect();
      const graph = connector.getLineage('tbl-004', 'upstream');
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should return lineage graph with downstream edges', () => {
      connector.connect();
      const graph = connector.getLineage('tbl-004', 'downstream');
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should return empty graph for table without lineage', () => {
      connector.connect();
      const graph = connector.getLineage('tbl-999', 'upstream');
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });
  });

  // --- getQualityTests ---

  describe('getQualityTests', () => {
    it('should return quality test results', () => {
      connector.connect();
      const tests = connector.getQualityTests('tbl-001');
      expect(tests).toHaveLength(3);
      expect(tests[0].name).toBeDefined();
      expect(tests[0].testDefinition).toBeDefined();
      expect(tests[0].testCaseStatus).toBeDefined();
      expect(tests.some((t) => t.testCaseStatus === 'Failed')).toBe(true);
    });

    it('should return empty for table without tests', () => {
      connector.connect();
      const tests = connector.getQualityTests('tbl-999');
      expect(tests).toHaveLength(0);
    });
  });

  // --- getTags ---

  describe('getTags', () => {
    it('should return tags for a table', () => {
      connector.connect();
      const tags = connector.getTags('tbl-001');
      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0].key).toBeDefined();
      expect(tags[0].resource).toBeDefined();
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.listDatabases()).toThrow('Not connected');
      expect(() => connector.listTables('warehouse_db')).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.getTableMetadata('warehouse_db', 'customers')).toThrow('Not connected');
      expect(() => connector.searchTables('test')).toThrow('Not connected');
      expect(() => connector.getLineage('tbl-001', 'upstream')).toThrow('Not connected');
      expect(() => connector.getQualityTests('tbl-001')).toThrow('Not connected');
    });
  });
});
