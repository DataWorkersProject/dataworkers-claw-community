/**
 * Tests for CatalogRegistry and ICatalogProvider interface compliance.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogRegistry } from '../../catalog-registry.js';
import type { ICatalogProvider, CatalogCapability, LineageGraph } from '../../types.js';

// --- Test helpers ---

function createMockProvider(
  type: string,
  capabilities: CatalogCapability[],
  overrides: Partial<ICatalogProvider> = {},
): ICatalogProvider {
  return {
    connectorType: type,
    providerType: type,
    capabilities,
    connect() {},
    disconnect() {},
    healthCheck() {
      return { healthy: true, latencyMs: 0 };
    },
    listNamespaces() {
      return [{ name: ['default'], properties: {} }];
    },
    listTables(_namespace: string) {
      return [{ name: 'test_table', namespace: ['default'], schema: [], properties: {} }];
    },
    getTableMetadata(_namespace: string, _table: string) {
      return { name: 'test_table', namespace: ['default'], schema: [], properties: {} };
    },
    ...overrides,
  };
}

// --- Tests ---

describe('CatalogRegistry', () => {
  let registry: CatalogRegistry;

  beforeEach(() => {
    registry = new CatalogRegistry();
  });

  it('should register and list provider types', () => {
    registry.register('snowflake', () => createMockProvider('snowflake', ['discovery']));
    registry.register('dbt', () => createMockProvider('dbt', ['discovery', 'lineage']));

    const types = registry.list();
    expect(types).toContain('snowflake');
    expect(types).toContain('dbt');
    expect(types).toHaveLength(2);
  });

  it('should register via registerProvider alias', () => {
    registry.registerProvider('bigquery', () => createMockProvider('bigquery', ['discovery']));
    expect(registry.list()).toContain('bigquery');
  });

  it('should create and cache provider instances', () => {
    const factory = () => createMockProvider('snowflake', ['discovery']);
    registry.register('snowflake', factory);

    const provider1 = registry.create('snowflake');
    const provider2 = registry.create('snowflake');

    expect(provider1).toBe(provider2); // same cached instance
    expect(provider1.providerType).toBe('snowflake');
  });

  it('should throw when creating unregistered provider', () => {
    expect(() => registry.create('unknown')).toThrow('No provider registered for type: unknown');
  });

  it('should return undefined for uninstantiated provider via getProvider', () => {
    registry.register('snowflake', () => createMockProvider('snowflake', ['discovery']));
    expect(registry.getProvider('snowflake')).toBeUndefined();
  });

  it('should return provider after create via getProvider', () => {
    registry.register('snowflake', () => createMockProvider('snowflake', ['discovery']));
    const created = registry.create('snowflake');
    expect(registry.getProvider('snowflake')).toBe(created);
  });

  it('should return all instantiated providers via getAllProviders', () => {
    registry.register('snowflake', () => createMockProvider('snowflake', ['discovery']));
    registry.register('dbt', () => createMockProvider('dbt', ['discovery', 'lineage']));

    registry.create('snowflake');
    registry.create('dbt');

    const all = registry.getAllProviders();
    expect(all).toHaveLength(2);
  });

  it('should filter providers by capability', () => {
    registry.register('snowflake', () => createMockProvider('snowflake', ['discovery']));
    registry.register('dbt', () => createMockProvider('dbt', ['discovery', 'lineage']));
    registry.register('polaris', () => createMockProvider('polaris', ['discovery', 'governance']));

    registry.create('snowflake');
    registry.create('dbt');
    registry.create('polaris');

    const discoveryProviders = registry.getProvidersByCapability('discovery');
    expect(discoveryProviders).toHaveLength(3);

    const lineageProviders = registry.getProvidersByCapability('lineage');
    expect(lineageProviders).toHaveLength(1);
    expect(lineageProviders[0].providerType).toBe('dbt');

    const governanceProviders = registry.getProvidersByCapability('governance');
    expect(governanceProviders).toHaveLength(1);
    expect(governanceProviders[0].providerType).toBe('polaris');
  });

  it('should return empty array when no providers match capability', () => {
    registry.register('snowflake', () => createMockProvider('snowflake', ['discovery']));
    registry.create('snowflake');

    expect(registry.getProvidersByCapability('lineage')).toHaveLength(0);
  });
});

describe('ICatalogProvider interface compliance', () => {
  it('should allow providers to implement optional getLineage', () => {
    const lineageGraph: LineageGraph = {
      nodes: [
        { entityId: 'model.a', entityType: 'model', name: 'a' },
        { entityId: 'model.b', entityType: 'model', name: 'b' },
      ],
      edges: [
        { source: 'model.a', target: 'model.b', transformationType: 'ref' },
      ],
    };

    const provider = createMockProvider('dbt', ['discovery', 'lineage'], {
      getLineage(_entityId: string, _direction: 'upstream' | 'downstream', _depth?: number) {
        return lineageGraph;
      },
    });

    expect(provider.getLineage).toBeDefined();
    const result = provider.getLineage!('model.a', 'downstream');
    expect(result).toEqual(lineageGraph);
  });

  it('should only call getLineage on providers that support lineage capability', () => {
    const registry = new CatalogRegistry();

    const snowflake = createMockProvider('snowflake', ['discovery']);
    const dbt = createMockProvider('dbt', ['discovery', 'lineage'], {
      getLineage(_entityId: string, _direction: 'upstream' | 'downstream') {
        return { nodes: [], edges: [] };
      },
    });

    registry.register('snowflake', () => snowflake);
    registry.register('dbt', () => dbt);
    registry.create('snowflake');
    registry.create('dbt');

    const lineageProviders = registry.getProvidersByCapability('lineage');
    expect(lineageProviders).toHaveLength(1);

    // Only call getLineage on providers that declare the capability
    for (const provider of lineageProviders) {
      if (provider.getLineage) {
        const graph = provider.getLineage('model.a', 'downstream');
        expect(graph).toBeDefined();
        expect(graph).toHaveProperty('nodes');
        expect(graph).toHaveProperty('edges');
      }
    }

    // Snowflake should NOT have getLineage
    expect(snowflake.getLineage).toBeUndefined();
  });

  it('should preserve IDataPlatformConnector backward compatibility', () => {
    const provider = createMockProvider('test', ['discovery']);

    // All IDataPlatformConnector methods should exist
    expect(provider.connectorType).toBe('test');
    expect(typeof provider.connect).toBe('function');
    expect(typeof provider.disconnect).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
    expect(typeof provider.listNamespaces).toBe('function');
    expect(typeof provider.listTables).toBe('function');
    expect(typeof provider.getTableMetadata).toBe('function');

    // ICatalogProvider extensions should also exist
    expect(provider.providerType).toBe('test');
    expect(provider.capabilities).toEqual(['discovery']);
  });
});

describe('Real connector ICatalogProvider compliance', () => {
  it('IcebergConnector should implement ICatalogProvider', async () => {
    const { IcebergConnector } = await import('../../../iceberg/src/index.js');
    const connector = new IcebergConnector();

    expect(connector.connectorType).toBe('iceberg');
    expect(connector.providerType).toBe('iceberg');
    expect(connector.capabilities).toEqual(['discovery']);
  });

  it('SnowflakeConnector should implement ICatalogProvider', async () => {
    const { SnowflakeConnector } = await import('../../../snowflake/src/index.js');
    const connector = new SnowflakeConnector();

    expect(connector.connectorType).toBe('snowflake');
    expect(connector.providerType).toBe('snowflake');
    expect(connector.capabilities).toEqual(['discovery']);
  });

  it('BigQueryConnector should implement ICatalogProvider', async () => {
    const { BigQueryConnector } = await import('../../../bigquery/src/index.js');
    const connector = new BigQueryConnector();

    expect(connector.connectorType).toBe('bigquery');
    expect(connector.providerType).toBe('bigquery');
    expect(connector.capabilities).toEqual(['discovery']);
  });

  it('DatabricksConnector should implement ICatalogProvider', async () => {
    const { DatabricksConnector } = await import('../../../databricks/src/index.js');
    const connector = new DatabricksConnector();

    expect(connector.connectorType).toBe('databricks');
    expect(connector.providerType).toBe('databricks');
    expect(connector.capabilities).toEqual(['discovery']);
  });

  it('DbtConnector should implement ICatalogProvider with lineage', async () => {
    const { DbtConnector } = await import('../../../dbt/src/index.js');
    const connector = new DbtConnector();

    expect(connector.connectorType).toBe('dbt');
    expect(connector.providerType).toBe('dbt');
    expect(connector.capabilities).toEqual(['discovery', 'lineage']);
    expect(typeof connector.getLineage).toBe('function');
  });

  it('PolarisConnector should implement ICatalogProvider with governance', async () => {
    const { PolarisConnector } = await import('../../../polaris/src/index.js');
    const connector = new PolarisConnector();

    expect(connector.connectorType).toBe('polaris');
    expect(connector.providerType).toBe('polaris');
    expect(connector.capabilities).toEqual(['discovery', 'governance']);
  });
});
