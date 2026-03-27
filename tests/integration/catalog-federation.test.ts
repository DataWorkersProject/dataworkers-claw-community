/**
 * Cross-connector catalog federation test.
 *
 * Verifies that CatalogRegistry correctly federates search, listing,
 * and table retrieval across multiple ICatalogProvider instances.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogRegistry } from '../../connectors/shared/catalog-registry.js';
import type {
  ICatalogProvider,
  CatalogCapability,
  TableInfo,
  TableMetadata,
  NamespaceInfo,
  ConnectorHealthStatus,
} from '../../connectors/shared/types.js';

// ---------------------------------------------------------------------------
// Helpers — stub providers with customisable seed data
// ---------------------------------------------------------------------------

interface SeedTable {
  name: string;
  namespace: string[];
  tableType?: string;
  columns?: Array<{ name: string; type: string; nullable: boolean }>;
}

function createSeededProvider(
  type: string,
  capabilities: CatalogCapability[],
  tables: SeedTable[],
): ICatalogProvider {
  const provider: ICatalogProvider = {
    connectorType: type,
    providerType: type,
    capabilities,

    connect() {},
    disconnect() {},

    healthCheck(): ConnectorHealthStatus {
      return { healthy: true, latencyMs: 1 };
    },

    listNamespaces(): NamespaceInfo[] {
      const nsSet = new Set<string>();
      for (const t of tables) {
        nsSet.add(t.namespace.join('.'));
      }
      return Array.from(nsSet).map((ns) => ({
        name: ns.split('.'),
        properties: {},
      }));
    },

    listTables(namespace: string): TableMetadata[] {
      return tables
        .filter((t) => t.namespace.join('.') === namespace)
        .map((t) => ({
          name: t.name,
          namespace: t.namespace,
          schema: (t.columns ?? []).map((c) => ({ ...c })),
          properties: { tableType: t.tableType ?? 'TABLE' },
        }));
    },

    getTableMetadata(namespace: string, tableName: string): TableMetadata {
      const found = tables.find(
        (t) => t.namespace.join('.') === namespace && t.name === tableName,
      );
      if (!found) {
        throw new Error(`Table ${namespace}.${tableName} not found in ${type}`);
      }
      return {
        name: found.name,
        namespace: found.namespace,
        schema: (found.columns ?? []).map((c) => ({ ...c })),
        properties: { tableType: found.tableType ?? 'TABLE', provider: type },
      };
    },
  };

  // Attach searchTables only when 'search' capability is declared
  if (capabilities.includes('search')) {
    (provider as ICatalogProvider).searchTables = (query: string): TableInfo[] => {
      const q = query.toLowerCase();
      return tables
        .filter((t) => t.name.toLowerCase().includes(q))
        .map((t) => ({
          name: t.name,
          namespace: t.namespace,
          tableType: t.tableType ?? 'TABLE',
          properties: { provider: type },
        }));
    };
  }

  return provider;
}

// ---------------------------------------------------------------------------
// Seed data — each provider has unique AND overlapping tables
// ---------------------------------------------------------------------------

const snowflakeTables: SeedTable[] = [
  {
    name: 'orders',
    namespace: ['ANALYTICS', 'PUBLIC'],
    columns: [
      { name: 'order_id', type: 'NUMBER', nullable: false },
      { name: 'customer_id', type: 'NUMBER', nullable: false },
      { name: 'amount', type: 'DECIMAL(18,2)', nullable: true },
    ],
  },
  {
    name: 'customers',
    namespace: ['ANALYTICS', 'PUBLIC'],
    columns: [
      { name: 'customer_id', type: 'NUMBER', nullable: false },
      { name: 'name', type: 'VARCHAR', nullable: false },
    ],
  },
  {
    name: 'events',
    namespace: ['RAW', 'INGEST'],
    columns: [
      { name: 'event_id', type: 'VARCHAR', nullable: false },
      { name: 'payload', type: 'VARIANT', nullable: true },
    ],
  },
];

const bigqueryTables: SeedTable[] = [
  {
    name: 'page_views',
    namespace: ['analytics_prod', 'web'],
    columns: [
      { name: 'view_id', type: 'STRING', nullable: false },
      { name: 'url', type: 'STRING', nullable: false },
    ],
  },
  {
    name: 'orders',
    namespace: ['commerce', 'public'],
    tableType: 'TABLE',
    columns: [
      { name: 'order_id', type: 'INT64', nullable: false },
      { name: 'total', type: 'FLOAT64', nullable: true },
    ],
  },
];

const glueTables: SeedTable[] = [
  {
    name: 'raw_clickstream',
    namespace: ['datalake'],
    tableType: 'EXTERNAL_TABLE',
    columns: [
      { name: 'click_id', type: 'string', nullable: false },
      { name: 'timestamp', type: 'bigint', nullable: false },
    ],
  },
  {
    name: 'orders',
    namespace: ['warehouse'],
    tableType: 'TABLE',
    columns: [
      { name: 'order_id', type: 'int', nullable: false },
      { name: 'status', type: 'string', nullable: true },
    ],
  },
];

const databricksTables: SeedTable[] = [
  {
    name: 'ml_features',
    namespace: ['ml_catalog', 'features'],
    columns: [
      { name: 'feature_id', type: 'LONG', nullable: false },
      { name: 'vector', type: 'ARRAY<DOUBLE>', nullable: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cross-connector catalog federation', () => {
  let registry: CatalogRegistry;

  beforeEach(() => {
    registry = new CatalogRegistry();

    // Snowflake and BigQuery support search; Glue supports search; Databricks does not
    registry.registerProvider('snowflake', () =>
      createSeededProvider('snowflake', ['discovery', 'search'], snowflakeTables),
    );
    registry.registerProvider('bigquery', () =>
      createSeededProvider('bigquery', ['discovery', 'search'], bigqueryTables),
    );
    registry.registerProvider('glue', () =>
      createSeededProvider('glue', ['discovery', 'search', 'governance'], glueTables),
    );
    registry.registerProvider('databricks', () =>
      createSeededProvider('databricks', ['discovery'], databricksTables),
    );

    // Eagerly instantiate all providers (mirrors backends.ts pattern)
    registry.create('snowflake');
    registry.create('bigquery');
    registry.create('glue');
    registry.create('databricks');
  });

  // ── list_all_catalogs ─────────────────────────────────────────────

  describe('list_all_catalogs', () => {
    it('should return all registered provider types', () => {
      const types = registry.list();
      expect(types).toHaveLength(4);
      expect(types).toContain('snowflake');
      expect(types).toContain('bigquery');
      expect(types).toContain('glue');
      expect(types).toContain('databricks');
    });

    it('should return all instantiated providers via getAllProviders', () => {
      const providers = registry.getAllProviders();
      expect(providers).toHaveLength(4);

      const providerTypes = providers.map((p) => p.providerType);
      expect(providerTypes).toEqual(
        expect.arrayContaining(['snowflake', 'bigquery', 'glue', 'databricks']),
      );
    });

    it('should expose capabilities for each provider', () => {
      const providers = registry.getAllProviders();
      const snowflake = providers.find((p) => p.providerType === 'snowflake')!;
      const glue = providers.find((p) => p.providerType === 'glue')!;
      const databricks = providers.find((p) => p.providerType === 'databricks')!;

      expect(snowflake.capabilities).toContain('search');
      expect(glue.capabilities).toContain('governance');
      expect(databricks.capabilities).not.toContain('search');
    });
  });

  // ── search_across_catalogs ────────────────────────────────────────

  describe('search_across_catalogs', () => {
    /**
     * Mirrors the logic of searchAcrossCatalogsHandler:
     * gather results from all providers that support 'search' capability.
     */
    function searchAcrossCatalogs(
      reg: CatalogRegistry,
      query: string,
    ): Record<string, TableInfo[]> {
      const providers = reg.getProvidersByCapability('search');
      const results: Record<string, TableInfo[]> = {};

      for (const provider of providers) {
        if (provider.searchTables) {
          results[provider.providerType] = provider.searchTables(query) as TableInfo[];
        }
      }
      return results;
    }

    it('should return results from ALL search-capable providers', () => {
      const results = searchAcrossCatalogs(registry, 'orders');

      // Three providers support search: snowflake, bigquery, glue
      expect(Object.keys(results)).toHaveLength(3);
      expect(results).toHaveProperty('snowflake');
      expect(results).toHaveProperty('bigquery');
      expect(results).toHaveProperty('glue');

      // Each should have exactly one 'orders' match
      expect(results.snowflake).toHaveLength(1);
      expect(results.snowflake[0].name).toBe('orders');

      expect(results.bigquery).toHaveLength(1);
      expect(results.bigquery[0].name).toBe('orders');

      expect(results.glue).toHaveLength(1);
      expect(results.glue[0].name).toBe('orders');
    });

    it('should NOT include results from providers without search capability', () => {
      const results = searchAcrossCatalogs(registry, 'ml_features');

      // Databricks has ml_features but does not have 'search' capability
      expect(results).not.toHaveProperty('databricks');
      // No search-capable provider has ml_features
      const allMatches = Object.values(results).flat();
      expect(allMatches).toHaveLength(0);
    });

    it('should return empty results when no tables match query', () => {
      const results = searchAcrossCatalogs(registry, 'nonexistent_table_xyz');

      expect(Object.keys(results)).toHaveLength(3); // still 3 providers queried
      for (const tables of Object.values(results)) {
        expect(tables).toHaveLength(0);
      }
    });

    it('should handle partial matches across providers', () => {
      // "click" should only match raw_clickstream in glue
      const results = searchAcrossCatalogs(registry, 'click');

      expect(results.snowflake).toHaveLength(0);
      expect(results.bigquery).toHaveLength(0);
      expect(results.glue).toHaveLength(1);
      expect(results.glue[0].name).toBe('raw_clickstream');
    });

    it('should be case-insensitive when searching', () => {
      const results = searchAcrossCatalogs(registry, 'ORDERS');

      const allMatches = Object.values(results).flat();
      expect(allMatches.length).toBeGreaterThanOrEqual(3);
      expect(allMatches.every((m) => m.name === 'orders')).toBe(true);
    });
  });

  // ── get_table_from_any_catalog ────────────────────────────────────

  describe('get_table_from_any_catalog', () => {
    /**
     * Mirrors the logic of getTableFromAnyCatalogHandler:
     * look up a specific provider by type and retrieve table metadata.
     */
    function getTableFromAnyCatalog(
      reg: CatalogRegistry,
      providerType: string,
      namespace: string,
      table: string,
    ): TableMetadata | { error: string } {
      const provider = reg.getProvider(providerType);
      if (!provider) {
        return { error: `Provider not found: ${providerType}. Available: ${reg.list().join(', ')}` };
      }
      return provider.getTableMetadata(namespace, table) as TableMetadata;
    }

    it('should retrieve table metadata from snowflake provider', () => {
      const result = getTableFromAnyCatalog(registry, 'snowflake', 'ANALYTICS.PUBLIC', 'orders');
      expect(result).not.toHaveProperty('error');

      const meta = result as TableMetadata;
      expect(meta.name).toBe('orders');
      expect(meta.namespace).toEqual(['ANALYTICS', 'PUBLIC']);
      expect(meta.schema).toHaveLength(3);
      expect(meta.properties.provider).toBe('snowflake');
    });

    it('should retrieve table metadata from bigquery provider', () => {
      const result = getTableFromAnyCatalog(registry, 'bigquery', 'analytics_prod.web', 'page_views');
      expect(result).not.toHaveProperty('error');

      const meta = result as TableMetadata;
      expect(meta.name).toBe('page_views');
      expect(meta.namespace).toEqual(['analytics_prod', 'web']);
    });

    it('should retrieve table metadata from glue provider', () => {
      const result = getTableFromAnyCatalog(registry, 'glue', 'datalake', 'raw_clickstream');
      expect(result).not.toHaveProperty('error');

      const meta = result as TableMetadata;
      expect(meta.name).toBe('raw_clickstream');
      expect(meta.properties.tableType).toBe('EXTERNAL_TABLE');
    });

    it('should retrieve table metadata from databricks provider', () => {
      const result = getTableFromAnyCatalog(
        registry,
        'databricks',
        'ml_catalog.features',
        'ml_features',
      );
      expect(result).not.toHaveProperty('error');

      const meta = result as TableMetadata;
      expect(meta.name).toBe('ml_features');
    });

    it('should return error for unknown provider type', () => {
      const result = getTableFromAnyCatalog(registry, 'redshift', 'db.schema', 'table');
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Provider not found: redshift');
      expect((result as { error: string }).error).toContain('snowflake');
    });

    it('should throw when requesting nonexistent table from valid provider', () => {
      expect(() =>
        getTableFromAnyCatalog(registry, 'snowflake', 'ANALYTICS.PUBLIC', 'no_such_table'),
      ).toThrow();
    });
  });

  // ── deduplication across catalogs ─────────────────────────────────

  describe('deduplication when same table appears in multiple catalogs', () => {
    function searchAndDeduplicate(
      reg: CatalogRegistry,
      query: string,
    ): { unique: TableInfo[]; duplicates: TableInfo[] } {
      const providers = reg.getProvidersByCapability('search');
      const allResults: (TableInfo & { _provider: string })[] = [];

      for (const provider of providers) {
        if (provider.searchTables) {
          const tables = provider.searchTables(query) as TableInfo[];
          for (const t of tables) {
            allResults.push({ ...t, _provider: provider.providerType });
          }
        }
      }

      // Deduplicate by table name (keep first occurrence, track duplicates)
      const seen = new Map<string, TableInfo & { _provider: string }>();
      const duplicates: TableInfo[] = [];

      for (const entry of allResults) {
        if (seen.has(entry.name)) {
          duplicates.push(entry);
        } else {
          seen.set(entry.name, entry);
        }
      }

      return {
        unique: Array.from(seen.values()),
        duplicates,
      };
    }

    it('should detect "orders" table appearing in 3 catalogs', () => {
      const { unique, duplicates } = searchAndDeduplicate(registry, 'orders');

      // 1 unique "orders" entry + 2 duplicates
      expect(unique).toHaveLength(1);
      expect(unique[0].name).toBe('orders');
      expect(duplicates).toHaveLength(2);
    });

    it('should keep unique tables when there is no overlap', () => {
      const { unique, duplicates } = searchAndDeduplicate(registry, 'page_views');

      expect(unique).toHaveLength(1);
      expect(unique[0].name).toBe('page_views');
      expect(duplicates).toHaveLength(0);
    });

    it('should return empty results for no matches', () => {
      const { unique, duplicates } = searchAndDeduplicate(registry, 'zzz_no_match');

      expect(unique).toHaveLength(0);
      expect(duplicates).toHaveLength(0);
    });

    it('should preserve provenance info on deduplicated results', () => {
      const providers = registry.getProvidersByCapability('search');
      const byProvider: Record<string, TableInfo[]> = {};

      for (const provider of providers) {
        if (provider.searchTables) {
          byProvider[provider.providerType] = provider.searchTables('orders') as TableInfo[];
        }
      }

      // Verify each provider's result carries its own context
      const providerNames = Object.keys(byProvider).filter(
        (k) => byProvider[k].length > 0,
      );
      expect(providerNames).toHaveLength(3);

      // Namespaces differ across providers even for the same table name
      const namespaces = providerNames.map(
        (k) => byProvider[k][0].namespace.join('.'),
      );
      // All three should be different namespaces
      const uniqueNamespaces = new Set(namespaces);
      expect(uniqueNamespaces.size).toBe(3);
    });
  });

  // ── capability-based filtering ────────────────────────────────────

  describe('capability-based provider filtering', () => {
    it('should filter providers by discovery capability (all four)', () => {
      const providers = registry.getProvidersByCapability('discovery');
      expect(providers).toHaveLength(4);
    });

    it('should filter providers by search capability (three)', () => {
      const providers = registry.getProvidersByCapability('search');
      expect(providers).toHaveLength(3);
      const types = providers.map((p) => p.providerType);
      expect(types).not.toContain('databricks');
    });

    it('should filter providers by governance capability (glue only)', () => {
      const providers = registry.getProvidersByCapability('governance');
      expect(providers).toHaveLength(1);
      expect(providers[0].providerType).toBe('glue');
    });

    it('should return empty array for unused capability', () => {
      const providers = registry.getProvidersByCapability('versioning');
      expect(providers).toHaveLength(0);
    });
  });

  // ── health check across all providers ─────────────────────────────

  describe('federated health check', () => {
    it('should report all providers as healthy', () => {
      const providers = registry.getAllProviders();
      for (const provider of providers) {
        const status = provider.healthCheck() as ConnectorHealthStatus;
        expect(status.healthy).toBe(true);
      }
    });
  });
});
