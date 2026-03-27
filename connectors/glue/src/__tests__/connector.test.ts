import { describe, it, expect, beforeEach } from 'vitest';
import { GlueConnector } from '../index.js';

describe('GlueConnector', () => {
  let connector: GlueConnector;

  beforeEach(() => {
    connector = new GlueConnector();
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
      expect(connector.connectorType).toBe('glue');
      expect(connector.providerType).toBe('glue');
    });

    it('should have correct capabilities', () => {
      expect(connector.capabilities).toContain('discovery');
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
      expect(names).toEqual(['analytics_db', 'raw_data_db']);
      expect(databases[0].description).toBeDefined();
      expect(databases[0].locationUri).toBeDefined();
      expect(databases[0].createTime).toBeGreaterThan(0);
    });
  });

  // --- listNamespaces ---

  describe('listNamespaces', () => {
    it('should return databases as namespaces', () => {
      connector.connect();
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(2);
      const names = namespaces.map((ns) => ns.name[0]).sort();
      expect(names).toEqual(['analytics_db', 'raw_data_db']);
      expect(namespaces[0].properties).toHaveProperty('description');
    });
  });

  // --- listTables ---

  describe('listTables', () => {
    it('should return tables for analytics_db', () => {
      connector.connect();
      const tables = connector.listTables('analytics_db');
      expect(tables).toHaveLength(3);
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['orders_transactions', 'product_catalog', 'user_events']);
    });

    it('should return tables for raw_data_db', () => {
      connector.connect();
      const tables = connector.listTables('raw_data_db');
      expect(tables).toHaveLength(2);
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
      const meta = connector.getTableMetadata('analytics_db', 'user_events');
      expect(meta.name).toBe('user_events');
      expect(meta.namespace).toEqual(['analytics_db']);
      expect(meta.schema.length).toBeGreaterThan(0);
      expect(meta.schema[0].name).toBe('event_id');
      expect(meta.properties).toHaveProperty('tableType');
    });

    it('should throw for unknown table', () => {
      connector.connect();
      expect(() => connector.getTableMetadata('analytics_db', 'nonexistent')).toThrow('Table not found');
    });
  });

  // --- getPartitions ---

  describe('getPartitions', () => {
    it('should return partitions for a partitioned table', () => {
      connector.connect();
      const partitions = connector.getPartitions('analytics_db', 'user_events');
      expect(partitions.length).toBeGreaterThan(0);
      expect(partitions[0].values).toBeDefined();
      expect(partitions[0].storageDescriptor).toBeDefined();
      expect(partitions[0].createTime).toBeGreaterThan(0);
    });

    it('should return empty array for non-partitioned table', () => {
      connector.connect();
      const partitions = connector.getPartitions('analytics_db', 'product_catalog');
      expect(partitions).toHaveLength(0);
    });
  });

  // --- searchTables ---

  describe('searchTables', () => {
    it('should find tables by name', () => {
      connector.connect();
      const results = connector.searchTables('event');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name === 'user_events')).toBe(true);
    });

    it('should find tables by column name', () => {
      connector.connect();
      const results = connector.searchTables('session_id');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', () => {
      connector.connect();
      const results = connector.searchTables('zzz_nonexistent_zzz');
      expect(results).toHaveLength(0);
    });
  });

  // --- Lake Formation: capabilities ---

  describe('Lake Formation capabilities', () => {
    it('should include governance capability', () => {
      expect(connector.capabilities).toContain('governance');
    });
  });

  // --- Lake Formation: getLFPermissions ---

  describe('getLFPermissions', () => {
    it('should return permissions for a database', () => {
      connector.connect();
      const perms = connector.getLFPermissions('analytics_db');
      expect(perms.length).toBeGreaterThan(0);
      expect(perms[0].principal).toBeDefined();
      expect(perms[0].resource).toBe('analytics_db');
      expect(perms[0].permissions.length).toBeGreaterThan(0);
    });

    it('should return permissions for a table', () => {
      connector.connect();
      const perms = connector.getLFPermissions('analytics_db.user_events');
      expect(perms.length).toBeGreaterThan(0);
      expect(perms[0].resource).toBe('analytics_db.user_events');
    });

    it('should return empty for unknown resource', () => {
      connector.connect();
      const perms = connector.getLFPermissions('nonexistent');
      expect(perms).toHaveLength(0);
    });
  });

  // --- Lake Formation: getLFTags ---

  describe('getLFTags', () => {
    it('should return tags for a database', () => {
      connector.connect();
      const tags = connector.getLFTags('analytics_db');
      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0].tagKey).toBeDefined();
      expect(tags[0].tagValues.length).toBeGreaterThan(0);
    });

    it('should return tags for a table', () => {
      connector.connect();
      const tags = connector.getLFTags('analytics_db.user_events');
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.some((t) => t.tagKey === 'pii')).toBe(true);
    });

    it('should return empty for unknown resource', () => {
      connector.connect();
      const tags = connector.getLFTags('nonexistent');
      expect(tags).toHaveLength(0);
    });
  });

  // --- Lake Formation: getLakeFormationSettings ---

  describe('getLakeFormationSettings', () => {
    it('should return data lake settings', () => {
      connector.connect();
      const settings = connector.getLakeFormationSettings();
      expect(settings.admins.length).toBeGreaterThan(0);
      expect(settings.createDatabaseDefaultPermissions).toBeDefined();
      expect(settings.createTableDefaultPermissions).toBeDefined();
    });
  });

  // --- Lake Formation: searchByTags ---

  describe('searchByTags', () => {
    it('should find resources by tag values', () => {
      connector.connect();
      const results = connector.searchByTags(['pii']);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.includes('user_events'))).toBe(true);
    });

    it('should return empty for no matching tags', () => {
      connector.connect();
      const results = connector.searchByTags(['zzz_nonexistent']);
      expect(results).toHaveLength(0);
    });
  });

  // --- Lake Formation: ICatalogProvider getPermissions / getTags ---

  describe('getPermissions (ICatalogProvider)', () => {
    it('should return Permission[] objects', () => {
      connector.connect();
      const perms = connector.getPermissions('analytics_db');
      expect(perms.length).toBeGreaterThan(0);
      expect(perms[0]).toHaveProperty('principal');
      expect(perms[0]).toHaveProperty('privilege');
      expect(perms[0]).toHaveProperty('granted');
    });
  });

  describe('getTags (ICatalogProvider)', () => {
    it('should return Tag[] objects', () => {
      connector.connect();
      const tags = connector.getTags('analytics_db.user_events');
      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0]).toHaveProperty('key');
      expect(tags[0]).toHaveProperty('value');
      expect(tags[0]).toHaveProperty('resource');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.listDatabases()).toThrow('Not connected');
      expect(() => connector.listTables('analytics_db')).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.getTableMetadata('analytics_db', 'user_events')).toThrow('Not connected');
      expect(() => connector.getPartitions('analytics_db', 'user_events')).toThrow('Not connected');
      expect(() => connector.searchTables('test')).toThrow('Not connected');
      expect(() => connector.getLFPermissions('analytics_db')).toThrow('Not connected');
      expect(() => connector.getLFTags('analytics_db')).toThrow('Not connected');
      expect(() => connector.getLakeFormationSettings()).toThrow('Not connected');
      expect(() => connector.searchByTags(['pii'])).toThrow('Not connected');
    });
  });
});
