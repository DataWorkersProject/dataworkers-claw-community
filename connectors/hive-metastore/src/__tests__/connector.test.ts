import { describe, it, expect, beforeEach } from 'vitest';
import { HiveMetastoreConnector } from '../index.js';

describe('HiveMetastoreConnector', () => {
  let connector: HiveMetastoreConnector;

  beforeEach(() => {
    connector = new HiveMetastoreConnector();
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
      expect(connector.connectorType).toBe('hive-metastore');
      expect(connector.providerType).toBe('hive-metastore');
    });

    it('should have correct capabilities', () => {
      expect(connector.capabilities).toContain('discovery');
    });
  });

  // --- listDatabases ---

  describe('listDatabases', () => {
    it('should return seeded databases', () => {
      connector.connect();
      const databases = connector.listDatabases();
      expect(databases).toHaveLength(3);
      const names = databases.map((d) => d.name).sort();
      expect(names).toEqual(['analytics', 'default', 'raw_zone']);
      expect(databases[0].ownerName).toBeDefined();
      expect(databases[0].locationUri).toBeDefined();
    });
  });

  // --- listNamespaces ---

  describe('listNamespaces', () => {
    it('should return databases as namespaces', () => {
      connector.connect();
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(3);
      const names = namespaces.map((ns) => ns.name[0]).sort();
      expect(names).toEqual(['analytics', 'default', 'raw_zone']);
      expect(namespaces[0].properties).toHaveProperty('description');
      expect(namespaces[0].properties).toHaveProperty('ownerName');
    });
  });

  // --- listTables ---

  describe('listTables', () => {
    it('should return tables for default database', () => {
      connector.connect();
      const tables = connector.listTables('default');
      expect(tables).toHaveLength(2);
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['customer_dim', 'product_dim']);
    });

    it('should return tables for analytics database', () => {
      connector.connect();
      const tables = connector.listTables('analytics');
      expect(tables).toHaveLength(3);
    });

    it('should return tables for raw_zone database', () => {
      connector.connect();
      const tables = connector.listTables('raw_zone');
      expect(tables).toHaveLength(3);
    });

    it('should throw for unknown database', () => {
      connector.connect();
      expect(() => connector.listTables('nonexistent')).toThrow('Database not found');
    });
  });

  // --- getTableMetadata ---

  describe('getTableMetadata', () => {
    it('should return table metadata with columns', () => {
      connector.connect();
      const meta = connector.getTableMetadata('default', 'customer_dim');
      expect(meta.name).toBe('customer_dim');
      expect(meta.namespace).toEqual(['default']);
      expect(meta.schema.length).toBeGreaterThan(0);
      expect(meta.schema[0].name).toBe('customer_id');
      expect(meta.properties).toHaveProperty('tableType', 'MANAGED_TABLE');
      expect(meta.properties).toHaveProperty('format', 'hive');
    });

    it('should return iceberg format table metadata', () => {
      connector.connect();
      const meta = connector.getTableMetadata('analytics', 'user_activity_iceberg');
      expect(meta.properties.format).toBe('iceberg');
      expect(meta.properties.tableType).toBe('EXTERNAL_TABLE');
    });

    it('should throw for unknown table', () => {
      connector.connect();
      expect(() => connector.getTableMetadata('default', 'nonexistent')).toThrow('Table not found');
    });
  });

  // --- getHiveTable ---

  describe('getHiveTable', () => {
    it('should return raw Hive table object with format info', () => {
      connector.connect();
      const table = connector.getHiveTable('analytics', 'order_facts_delta');
      expect(table.name).toBe('order_facts_delta');
      expect(table.format).toBe('delta');
      expect(table.tableType).toBe('EXTERNAL_TABLE');
      expect(table.partitionKeys.length).toBeGreaterThan(0);
    });
  });

  // --- getPartitions ---

  describe('getPartitions', () => {
    it('should return partitions for a partitioned table', () => {
      connector.connect();
      const partitions = connector.getPartitions('analytics', 'daily_sales');
      expect(partitions.length).toBeGreaterThan(0);
      expect(partitions[0].values).toBeDefined();
      expect(partitions[0].location).toBeDefined();
      expect(partitions[0].createTime).toBeGreaterThan(0);
    });

    it('should return empty array for non-partitioned table', () => {
      connector.connect();
      const partitions = connector.getPartitions('default', 'customer_dim');
      expect(partitions).toHaveLength(0);
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.listDatabases()).toThrow('Not connected');
      expect(() => connector.listTables('default')).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.getTableMetadata('default', 'customer_dim')).toThrow('Not connected');
      expect(() => connector.getHiveTable('default', 'customer_dim')).toThrow('Not connected');
      expect(() => connector.getPartitions('default', 'customer_dim')).toThrow('Not connected');
    });
  });
});
