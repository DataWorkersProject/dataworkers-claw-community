import { describe, it, expect, beforeEach } from 'vitest';
import { PurviewConnector } from '../index.js';

describe('PurviewConnector', () => {
  let connector: PurviewConnector;

  beforeEach(() => {
    connector = new PurviewConnector();
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
      expect(connector.connectorType).toBe('purview');
      expect(connector.providerType).toBe('purview');
    });

    it('should have correct capabilities', () => {
      expect(connector.capabilities).toContain('discovery');
      expect(connector.capabilities).toContain('lineage');
      expect(connector.capabilities).toContain('governance');
      expect(connector.capabilities).toContain('search');
    });
  });

  // --- searchEntities ---

  describe('searchEntities', () => {
    it('should search by entity name', () => {
      connector.connect();
      const result = connector.searchEntities('customers');
      expect(result.searchCount).toBeGreaterThan(0);
      expect(result.entities.some((e) => String(e.attributes['name']).includes('customers'))).toBe(true);
    });

    it('should search by classification', () => {
      connector.connect();
      const result = connector.searchEntities('PII');
      expect(result.searchCount).toBeGreaterThan(0);
      expect(result.entities.every((e) => e.classifications.some((c) => c.includes('PII')))).toBe(true);
    });

    it('should return empty for no matches', () => {
      connector.connect();
      const result = connector.searchEntities('zzz_nonexistent_zzz');
      expect(result.searchCount).toBe(0);
      expect(result.entities).toHaveLength(0);
    });
  });

  // --- getEntity ---

  describe('getEntity', () => {
    it('should return an entity by GUID', () => {
      connector.connect();
      const entity = connector.getEntity('pv-001');
      expect(entity.guid).toBe('pv-001');
      expect(entity.typeName).toBe('azure_sql_table');
      expect(entity.attributes['name']).toBe('customers');
      expect(entity.classifications.length).toBeGreaterThan(0);
    });

    it('should throw for unknown GUID', () => {
      connector.connect();
      expect(() => connector.getEntity('nonexistent')).toThrow('Entity not found');
    });
  });

  // --- getPurviewLineage ---

  describe('getPurviewLineage', () => {
    it('should return lineage with relations', () => {
      connector.connect();
      const result = connector.getPurviewLineage('pv-004');
      expect(result.relations.length).toBeGreaterThan(0);
      expect(Object.keys(result.guidEntityMap).length).toBeGreaterThan(0);
      expect(result.relations[0].fromEntityId).toBeDefined();
      expect(result.relations[0].toEntityId).toBeDefined();
    });

    it('should return empty lineage for entity with no relations', () => {
      connector.connect();
      const result = connector.getPurviewLineage('pv-006');
      expect(result.relations).toHaveLength(0);
    });
  });

  // --- listGlossaryTerms ---

  describe('listGlossaryTerms', () => {
    it('should return glossary terms', () => {
      connector.connect();
      const terms = connector.listGlossaryTerms();
      expect(terms.length).toBeGreaterThan(0);
      expect(terms[0].guid).toBeDefined();
      expect(terms[0].qualifiedName).toBeDefined();
      expect(terms[0].shortDescription).toBeDefined();
      expect(terms[0].status).toBeDefined();
    });
  });

  // --- listCollections ---

  describe('listCollections', () => {
    it('should return collections', () => {
      connector.connect();
      const collections = connector.listCollections();
      expect(collections.length).toBeGreaterThan(0);
      expect(collections[0].name).toBeDefined();
      expect(collections[0].friendlyName).toBeDefined();
    });
  });

  // --- ICatalogProvider methods ---

  describe('listNamespaces', () => {
    it('should return collections as namespaces', () => {
      connector.connect();
      const namespaces = connector.listNamespaces();
      expect(namespaces.length).toBeGreaterThan(0);
      expect(namespaces[0].properties).toHaveProperty('friendlyName');
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

  describe('getLineage', () => {
    it('should return a LineageGraph', () => {
      connector.connect();
      const graph = connector.getLineage('pv-004');
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.searchEntities('test')).toThrow('Not connected');
      expect(() => connector.getEntity('pv-001')).toThrow('Not connected');
      expect(() => connector.getPurviewLineage('pv-001')).toThrow('Not connected');
      expect(() => connector.listGlossaryTerms()).toThrow('Not connected');
      expect(() => connector.listCollections()).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.listTables('test')).toThrow('Not connected');
      expect(() => connector.searchTables('test')).toThrow('Not connected');
    });
  });
});
