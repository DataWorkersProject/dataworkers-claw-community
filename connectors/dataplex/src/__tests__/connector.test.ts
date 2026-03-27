import { describe, it, expect, beforeEach } from 'vitest';
import { DataplexConnector } from '../index.js';

describe('DataplexConnector', () => {
  let connector: DataplexConnector;

  beforeEach(() => {
    connector = new DataplexConnector();
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
      expect(connector.connectorType).toBe('dataplex');
      expect(connector.providerType).toBe('dataplex');
    });

    it('should have correct capabilities', () => {
      expect(connector.capabilities).toContain('discovery');
      expect(connector.capabilities).toContain('search');
    });
  });

  // --- listLakes ---

  describe('listLakes', () => {
    it('should return seeded lakes', () => {
      connector.connect();
      const lakes = connector.listLakes();
      expect(lakes).toHaveLength(2);
      expect(lakes[0].displayName).toBeDefined();
      expect(lakes[0].state).toBe('ACTIVE');
      expect(lakes[0].name).toContain('lakes/');
    });
  });

  // --- listZones ---

  describe('listZones', () => {
    it('should return zones for a lake', () => {
      connector.connect();
      const zones = connector.listZones('projects/my-project/locations/us-central1/lakes/analytics-lake');
      expect(zones).toHaveLength(2);
      expect(zones[0].displayName).toBeDefined();
      expect(['RAW', 'CURATED']).toContain(zones[0].type);
    });

    it('should throw for unknown lake', () => {
      connector.connect();
      expect(() => connector.listZones('nonexistent')).toThrow('Lake not found');
    });
  });

  // --- listEntities ---

  describe('listEntities', () => {
    it('should return entities in a zone', () => {
      connector.connect();
      const entities = connector.listEntities('projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone');
      expect(entities).toHaveLength(3);
      expect(entities[0].displayName).toBeDefined();
      expect(entities[0].schema.fields.length).toBeGreaterThan(0);
    });

    it('should throw for unknown zone', () => {
      connector.connect();
      expect(() => connector.listEntities('nonexistent')).toThrow('Zone not found');
    });
  });

  // --- getEntity ---

  describe('getEntity', () => {
    it('should return entity by name', () => {
      connector.connect();
      const entity = connector.getEntity('projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone/entities/customers');
      expect(entity.displayName).toBe('customers');
      expect(entity.type).toBe('TABLE');
      expect(entity.schema.fields.length).toBeGreaterThan(0);
      expect(entity.dataPath).toBeDefined();
    });

    it('should throw for unknown entity', () => {
      connector.connect();
      expect(() => connector.getEntity('nonexistent')).toThrow('Entity not found');
    });
  });

  // --- searchEntries ---

  describe('searchEntries', () => {
    it('should find entries by name', () => {
      connector.connect();
      const results = connector.searchEntries('customers');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].fullyQualifiedName).toBeDefined();
    });

    it('should find entries by system', () => {
      connector.connect();
      const results = connector.searchEntries('BigQuery');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', () => {
      connector.connect();
      const results = connector.searchEntries('zzz_nonexistent_zzz');
      expect(results).toHaveLength(0);
    });
  });

  // --- ICatalogProvider methods ---

  describe('listNamespaces', () => {
    it('should return lakes as namespaces', () => {
      connector.connect();
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(2);
      expect(namespaces[0].properties).toHaveProperty('state');
    });
  });

  describe('searchTables', () => {
    it('should search and return TableInfo objects', () => {
      connector.connect();
      const results = connector.searchTables('orders');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('namespace');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.listLakes()).toThrow('Not connected');
      expect(() => connector.listZones('test')).toThrow('Not connected');
      expect(() => connector.listEntities('test')).toThrow('Not connected');
      expect(() => connector.getEntity('test')).toThrow('Not connected');
      expect(() => connector.searchEntries('test')).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.listTables('test')).toThrow('Not connected');
      expect(() => connector.searchTables('test')).toThrow('Not connected');
    });
  });
});
