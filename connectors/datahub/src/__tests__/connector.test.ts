import { describe, it, expect, beforeEach } from 'vitest';
import { DataHubConnector } from '../index.js';

describe('DataHubConnector', () => {
  let connector: DataHubConnector;

  beforeEach(() => {
    connector = new DataHubConnector();
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
      expect(connector.connectorType).toBe('datahub');
      expect(connector.providerType).toBe('datahub');
    });

    it('should have correct capabilities', () => {
      expect(connector.capabilities).toContain('discovery');
      expect(connector.capabilities).toContain('lineage');
      expect(connector.capabilities).toContain('search');
      expect(connector.capabilities).toContain('governance');
    });
  });

  // --- searchDatasets ---

  describe('searchDatasets', () => {
    it('should search by platform name', () => {
      connector.connect();
      const results = connector.searchDatasets('kafka');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.platform === 'kafka')).toBe(true);
    });

    it('should search by dataset name', () => {
      connector.connect();
      const results = connector.searchDatasets('orders');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name.includes('orders'))).toBe(true);
    });

    it('should search by tag', () => {
      connector.connect();
      const results = connector.searchDatasets('pii');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.tags.includes('pii'))).toBe(true);
    });

    it('should return empty for no matches', () => {
      connector.connect();
      const results = connector.searchDatasets('zzz_nonexistent_zzz');
      expect(results).toHaveLength(0);
    });
  });

  // --- getDataset ---

  describe('getDataset', () => {
    it('should return a dataset by URN', () => {
      connector.connect();
      const dataset = connector.getDataset('urn:li:dataset:(urn:li:dataPlatform:kafka,user_clicks,PROD)');
      expect(dataset.name).toBe('user_clicks');
      expect(dataset.platform).toBe('kafka');
      expect(dataset.schema.length).toBeGreaterThan(0);
      expect(dataset.tags.length).toBeGreaterThan(0);
    });

    it('should throw for unknown URN', () => {
      connector.connect();
      expect(() => connector.getDataset('urn:li:dataset:nonexistent')).toThrow('Dataset not found');
    });
  });

  // --- getDataHubLineage ---

  describe('getDataHubLineage', () => {
    it('should return upstream lineage', () => {
      connector.connect();
      const result = connector.getDataHubLineage(
        'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.marts.daily_revenue,PROD)',
        'upstream',
      );
      expect(result.direction).toBe('upstream');
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.entities[0].urn).toBeDefined();
      expect(result.entities[0].degree).toBe(1);
    });

    it('should return downstream lineage', () => {
      connector.connect();
      const result = connector.getDataHubLineage(
        'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)',
        'downstream',
      );
      expect(result.direction).toBe('downstream');
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('should return empty for no lineage', () => {
      connector.connect();
      const result = connector.getDataHubLineage(
        'urn:li:dataset:(urn:li:dataPlatform:kafka,system_metrics,PROD)',
        'upstream',
      );
      expect(result.entities).toHaveLength(0);
    });
  });

  // --- listDomains ---

  describe('listDomains', () => {
    it('should return all domains', () => {
      connector.connect();
      const domains = connector.listDomains();
      expect(domains).toHaveLength(3);
      const names = domains.map((d) => d.name).sort();
      expect(names).toEqual(['Engineering', 'Finance', 'Marketing']);
      expect(domains[0].urn).toBeDefined();
      expect(domains[0].description).toBeDefined();
    });
  });

  // --- ICatalogProvider methods ---

  describe('listNamespaces', () => {
    it('should return domains as namespaces', () => {
      connector.connect();
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(3);
      expect(namespaces[0].properties).toHaveProperty('urn');
    });
  });

  describe('searchTables', () => {
    it('should search and return TableInfo objects', () => {
      connector.connect();
      const results = connector.searchTables('kafka');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('namespace');
    });
  });

  describe('getLineage', () => {
    it('should return a LineageGraph', () => {
      connector.connect();
      const graph = connector.getLineage(
        'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.marts.daily_revenue,PROD)',
        'upstream',
      );
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.searchDatasets('test')).toThrow('Not connected');
      expect(() => connector.getDataset('urn:test')).toThrow('Not connected');
      expect(() => connector.getDataHubLineage('urn:test', 'upstream')).toThrow('Not connected');
      expect(() => connector.listDomains()).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.listTables('test')).toThrow('Not connected');
      expect(() => connector.searchTables('test')).toThrow('Not connected');
    });
  });
});
