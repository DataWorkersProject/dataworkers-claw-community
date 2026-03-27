/**
 * Connector Integration Test Harness — Stub/Real Dual-Mode
 *
 * Runs the same test suite against all 15 catalog connectors using
 * either InMemory stubs (default, CI-safe) or real services (manual/staging).
 *
 * Usage:
 *   # Stub mode (default) — CI
 *   npx vitest run tests/integration/connector-harness.test.ts
 *
 *   # Real mode — requires env vars for each connector
 *   DW_TEST_MODE=real npx vitest run tests/integration/connector-harness.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// --- Catalog Connector Imports (all 15) ---
import { SnowflakeConnector } from '../../connectors/snowflake/src/index.js';
import { BigQueryConnector } from '../../connectors/bigquery/src/index.js';
import { DbtConnector } from '../../connectors/dbt/src/index.js';
import { DatabricksConnector } from '../../connectors/databricks/src/index.js';
import { GlueConnector } from '../../connectors/glue/src/index.js';
import { HiveMetastoreConnector } from '../../connectors/hive-metastore/src/index.js';
import { OpenMetadataConnector } from '../../connectors/openmetadata/src/index.js';
import { OpenLineageConnector } from '../../connectors/openlineage/src/index.js';
import { DataHubConnector } from '../../connectors/datahub/src/index.js';
import { PurviewConnector } from '../../connectors/purview/src/index.js';
import { DataplexConnector } from '../../connectors/dataplex/src/index.js';
import { NessieConnector } from '../../connectors/nessie/src/index.js';
import { IcebergConnector } from '../../connectors/iceberg/src/index.js';
import { PolarisConnector } from '../../connectors/polaris/src/index.js';
import { CatalogRegistry } from '../../connectors/shared/catalog-registry.js';
import type { ICatalogProvider } from '../../connectors/shared/types.js';

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

const TEST_MODE: 'stub' | 'real' =
  (process.env.DW_TEST_MODE as 'stub' | 'real') || 'stub';

// ---------------------------------------------------------------------------
// Connector descriptor — encapsulates per-connector init & test expectations
// ---------------------------------------------------------------------------

interface ConnectorSpec {
  /** Display name for test output */
  name: string;
  /** Factory that creates and connects the connector */
  create: () => ICatalogProvider | Promise<ICatalogProvider>;
  /** Namespace to pass to listTables / getTableMetadata */
  namespace: string;
  /** Known table name within the namespace (seeded in stub mode) */
  tableName: string;
  /** Whether the connector supports searchTables() */
  hasSearch: boolean;
  /** Query string for searchTables() */
  searchQuery: string;
  /** Cleanup callback */
  destroy?: (c: ICatalogProvider) => void;
  /** Whether this connector is async-only (Polaris) */
  asyncOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Build the 15 connector specs
// ---------------------------------------------------------------------------

function buildSpecs(): ConnectorSpec[] {
  const specs: ConnectorSpec[] = [];

  // 1. Snowflake
  // Seeded data: ANALYTICS.PUBLIC has ORDERS, CUSTOMERS tables
  specs.push({
    name: 'Snowflake',
    create: () => {
      const c = TEST_MODE === 'real'
        ? SnowflakeConnector.fromEnv()
        : new SnowflakeConnector();
      c.connect();
      return c;
    },
    namespace: 'ANALYTICS.PUBLIC',
    tableName: 'ORDERS',
    hasSearch: false,
    searchQuery: '',
    destroy: (c) => (c as SnowflakeConnector).disconnect(),
  });

  // 2. BigQuery
  // Seeded data: analytics dataset with orders, sessions tables
  specs.push({
    name: 'BigQuery',
    create: () => {
      const c = TEST_MODE === 'real'
        ? BigQueryConnector.fromEnv()
        : new BigQueryConnector();
      c.connect(TEST_MODE === 'real' ? undefined : 'stub-project');
      return c;
    },
    namespace: 'analytics',
    tableName: 'orders',
    hasSearch: false,
    searchQuery: '',
    destroy: (c) => (c as BigQueryConnector).disconnect(),
  });

  // 3. dbt
  // Seeded data: schema=staging has stg_orders, stg_customers
  specs.push({
    name: 'dbt',
    create: () => {
      const c = TEST_MODE === 'real'
        ? DbtConnector.fromEnv()
        : new DbtConnector();
      if (TEST_MODE !== 'real') {
        c.connect('stub-token');
      }
      return c;
    },
    namespace: 'staging',
    tableName: 'stg_orders',
    hasSearch: false,
    searchQuery: '',
    destroy: (c) => (c as DbtConnector).disconnect(),
  });

  // 4. Databricks
  // Seeded data: catalog=main, schemas=default,analytics with tables
  specs.push({
    name: 'Databricks',
    create: () => {
      const c = TEST_MODE === 'real'
        ? DatabricksConnector.fromEnv()
        : new DatabricksConnector();
      if (TEST_MODE !== 'real') {
        c.connect('https://stub.cloud.databricks.com', 'stub-token');
      } else {
        c.connect();
      }
      return c;
    },
    namespace: 'main',
    tableName: 'customers',
    hasSearch: false,
    searchQuery: '',
    destroy: (c) => (c as DatabricksConnector).disconnect(),
  });

  // 5. Glue
  // Seeded data: analytics_db has user_events, user_sessions, products
  specs.push({
    name: 'AWS Glue',
    create: () => {
      const c = TEST_MODE === 'real'
        ? GlueConnector.fromEnv()
        : new GlueConnector();
      c.connect();
      return c;
    },
    namespace: 'analytics_db',
    tableName: 'user_events',
    hasSearch: true,
    searchQuery: 'events',
    destroy: (c) => (c as GlueConnector).disconnect(),
  });

  // 6. Hive Metastore
  // Seeded data: default has customer_dim, product_dim
  specs.push({
    name: 'Hive Metastore',
    create: () => {
      const c = TEST_MODE === 'real'
        ? HiveMetastoreConnector.fromEnv()
        : new HiveMetastoreConnector();
      c.connect();
      return c;
    },
    namespace: 'default',
    tableName: 'customer_dim',
    hasSearch: false,
    searchQuery: '',
    destroy: (c) => (c as HiveMetastoreConnector).disconnect(),
  });

  // 7. OpenMetadata
  // Seeded data: warehouse_db has customers, orders tables
  specs.push({
    name: 'OpenMetadata',
    create: () => {
      const c = TEST_MODE === 'real'
        ? OpenMetadataConnector.fromEnv()
        : new OpenMetadataConnector();
      c.connect();
      return c;
    },
    namespace: 'warehouse_db',
    tableName: 'customers',
    hasSearch: true,
    searchQuery: 'customers',
    destroy: (c) => (c as OpenMetadataConnector).disconnect(),
  });

  // 8. OpenLineage
  // Seeded data: default namespace has raw_orders, raw_customers, raw_products
  specs.push({
    name: 'OpenLineage',
    create: () => {
      const c = TEST_MODE === 'real'
        ? OpenLineageConnector.fromEnv()
        : new OpenLineageConnector();
      c.connect();
      return c;
    },
    namespace: 'default',
    tableName: 'raw_orders',
    hasSearch: false,
    searchQuery: '',
    destroy: (c) => (c as OpenLineageConnector).disconnect(),
  });

  // 9. DataHub
  // Seeded data: datasets indexed by URN, searchable by name
  // listTables uses searchDatasets(namespace), so use "kafka" to find kafka datasets
  specs.push({
    name: 'DataHub',
    create: () => {
      const c = TEST_MODE === 'real'
        ? DataHubConnector.fromEnv()
        : new DataHubConnector();
      c.connect();
      return c;
    },
    namespace: 'kafka',
    tableName: 'urn:li:dataset:(urn:li:dataPlatform:kafka,user_clicks,PROD)',
    hasSearch: true,
    searchQuery: 'clicks',
    destroy: (c) => (c as DataHubConnector).disconnect(),
  });

  // 10. Purview
  // Seeded data: entities searchable by name/desc, use "customers" to find results
  specs.push({
    name: 'Azure Purview',
    create: () => {
      const c = TEST_MODE === 'real'
        ? PurviewConnector.fromEnv()
        : new PurviewConnector();
      c.connect();
      return c;
    },
    namespace: 'customers',
    tableName: 'pv-001',
    hasSearch: true,
    searchQuery: 'customers',
    destroy: (c) => (c as PurviewConnector).disconnect(),
  });

  // 11. Dataplex
  // Seeded data: zone key = full resource name, entities under curated-zone
  specs.push({
    name: 'Google Dataplex',
    create: () => {
      const c = TEST_MODE === 'real'
        ? DataplexConnector.fromEnv()
        : new DataplexConnector();
      c.connect();
      return c;
    },
    namespace: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone',
    tableName: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone/entities/customers',
    hasSearch: true,
    searchQuery: 'customers',
    destroy: (c) => (c as DataplexConnector).disconnect(),
  });

  // 12. Nessie
  // Seeded data: main branch has warehouse.analytics.customers, .orders, etc.
  specs.push({
    name: 'Apache Nessie',
    create: () => {
      const c = TEST_MODE === 'real'
        ? NessieConnector.fromEnv()
        : new NessieConnector();
      c.connect();
      return c;
    },
    namespace: 'main',
    tableName: 'customers',
    hasSearch: true,
    searchQuery: 'orders',
    destroy: (c) => (c as NessieConnector).disconnect(),
  });

  // 13. Iceberg
  // Seeded data: analytics namespace with orders, customers, events, products
  specs.push({
    name: 'Apache Iceberg',
    create: () => {
      const c = new IcebergConnector();
      c.connect('http://localhost:8181');
      return c;
    },
    namespace: 'analytics',
    tableName: 'orders',
    hasSearch: false,
    searchQuery: '',
    destroy: (c) => (c as IcebergConnector).disconnect(),
  });

  // 14. Polaris
  // Seeded data: production catalog, analytics/raw namespaces, page_views/user_sessions/events/clicks tables
  // Polaris requires async connect with OAuth2 credentials
  specs.push({
    name: 'Polaris',
    create: async () => {
      const c = new PolarisConnector();
      await c.connect('http://localhost:8181', 'stub-client-id', 'stub-client-secret');
      return c;
    },
    namespace: 'production',
    tableName: 'page_views',
    hasSearch: false,
    searchQuery: '',
    asyncOnly: true,
    destroy: (c) => (c as PolarisConnector).disconnect(),
  });

  // 15. CatalogRegistry (unified cross-catalog)
  specs.push({
    name: 'CatalogRegistry (unified)',
    create: () => {
      const registry = new CatalogRegistry();
      const sf = new SnowflakeConnector();
      sf.connect();
      const bq = new BigQueryConnector();
      bq.connect('stub-project');
      registry.register('snowflake', () => sf);
      registry.register('bigquery', () => bq);
      registry.create('snowflake');
      registry.create('bigquery');
      return registry.getProvider('snowflake')!;
    },
    namespace: 'ANALYTICS.PUBLIC',
    tableName: 'ORDERS',
    hasSearch: false,
    searchQuery: '',
  });

  return specs;
}

// ---------------------------------------------------------------------------
// Standard test suite executed per connector
// ---------------------------------------------------------------------------

describe(`Connector Integration Harness [mode=${TEST_MODE}]`, () => {
  const specs = buildSpecs();

  for (const spec of specs) {
    describe(spec.name, () => {
      let connector: ICatalogProvider;

      beforeAll(async () => {
        const result = spec.create();
        connector = result instanceof Promise ? await result : result;
      });

      afterAll(() => {
        if (spec.destroy && connector) {
          spec.destroy(connector);
        }
      });

      // ----- Health -----
      it('healthCheck() reports healthy after connect', async () => {
        const health = await Promise.resolve(connector.healthCheck());
        expect(health.healthy).toBe(true);
        expect(typeof health.latencyMs).toBe('number');
      });

      // ----- listNamespaces -----
      // Polaris doesn't implement IDataPlatformConnector.listNamespaces directly
      if (!spec.asyncOnly) {
        it('listNamespaces() returns an array', async () => {
          const namespaces = await Promise.resolve(connector.listNamespaces());
          expect(Array.isArray(namespaces)).toBe(true);
          expect(namespaces.length).toBeGreaterThan(0);
          for (const n of namespaces) {
            expect(Array.isArray(n.name)).toBe(true);
            expect(typeof n.properties).toBe('object');
          }
        });
      }

      // ----- listTables -----
      // Polaris has a different listTables signature (browseCatalog), skip for it
      if (!spec.asyncOnly) {
        it('listTables() returns an array of table metadata', async () => {
          const tables = await Promise.resolve(connector.listTables(spec.namespace));
          expect(Array.isArray(tables)).toBe(true);
          expect(tables.length).toBeGreaterThan(0);
          for (const t of tables) {
            expect(typeof t.name).toBe('string');
            expect(Array.isArray(t.namespace)).toBe(true);
          }
        });
      }

      // ----- getTableMetadata -----
      if (!spec.asyncOnly) {
        it('getTableMetadata() returns data for a known table', async () => {
          const meta = await Promise.resolve(
            connector.getTableMetadata(spec.namespace, spec.tableName),
          );
          // Iceberg returns IcebergTableMetadata with tableId instead of name
          if (connector.connectorType === 'iceberg') {
            const icebergMeta = meta as any;
            expect(typeof icebergMeta.tableId).toBe('string');
            expect(icebergMeta.schema).toBeDefined();
          } else {
            expect(typeof meta.name).toBe('string');
            expect(Array.isArray(meta.namespace)).toBe(true);
            expect(typeof meta.properties).toBe('object');
          }
        });
      }

      // ----- Polaris-specific tests -----
      if (spec.asyncOnly && spec.name === 'Polaris') {
        it('listCatalogs() returns catalogs', async () => {
          const polaris = connector as unknown as PolarisConnector;
          const catalogs = await polaris.listCatalogs();
          expect(Array.isArray(catalogs)).toBe(true);
          expect(catalogs.length).toBeGreaterThan(0);
          expect(catalogs[0].name).toBeDefined();
        });

        it('browseCatalog() returns namespaces and tables', async () => {
          const polaris = connector as unknown as PolarisConnector;
          const result = await polaris.browseCatalog('production');
          expect(Array.isArray(result.namespaces)).toBe(true);
          expect(result.namespaces.length).toBeGreaterThan(0);
          expect(Array.isArray(result.tables)).toBe(true);
          expect(result.tables.length).toBeGreaterThan(0);
        });

        it('getTableMetadata() loads table from catalog', async () => {
          const polaris = connector as unknown as PolarisConnector;
          const meta = await polaris.getTableMetadata('production', ['analytics'], 'page_views');
          expect(meta).toBeDefined();
          expect(meta.tableId).toBeDefined();
        });
      }

      // ----- searchTables (when supported) -----
      if (spec.hasSearch) {
        it('searchTables() returns results for a query', async () => {
          const searchable = connector as ICatalogProvider & { searchTables(q: string): any };
          if (typeof searchable.searchTables !== 'function') {
            return;
          }
          const results = await Promise.resolve(searchable.searchTables(spec.searchQuery));
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBeGreaterThan(0);
          for (const item of results) {
            expect(typeof item.name).toBe('string');
            expect(Array.isArray(item.namespace)).toBe(true);
          }
        });
      }

      // ----- Connector type & capabilities -----
      it('has connectorType, providerType, and capabilities', () => {
        expect(typeof connector.connectorType).toBe('string');
        expect(connector.connectorType.length).toBeGreaterThan(0);
        expect(typeof connector.providerType).toBe('string');
        expect(Array.isArray(connector.capabilities)).toBe(true);
        expect(connector.capabilities.length).toBeGreaterThan(0);
      });
    });
  }

  // -----------------------------------------------------------------------
  // CatalogRegistry-specific cross-catalog tests
  // -----------------------------------------------------------------------
  describe('CatalogRegistry cross-catalog operations', () => {
    let registry: CatalogRegistry;

    beforeAll(() => {
      registry = new CatalogRegistry();
      const sf = new SnowflakeConnector();
      sf.connect();
      const bq = new BigQueryConnector();
      bq.connect('stub-project');
      const glue = new GlueConnector();
      glue.connect();

      registry.register('snowflake', () => sf);
      registry.register('bigquery', () => bq);
      registry.register('glue', () => glue);
      registry.create('snowflake');
      registry.create('bigquery');
      registry.create('glue');
    });

    it('list() returns all registered provider names', () => {
      const names = registry.list();
      expect(names).toContain('snowflake');
      expect(names).toContain('bigquery');
      expect(names).toContain('glue');
    });

    it('getAllProviders() returns instantiated providers', () => {
      const providers = registry.getAllProviders();
      expect(providers.length).toBe(3);
      const types = providers.map((p) => p.providerType);
      expect(types).toContain('snowflake');
      expect(types).toContain('bigquery');
      expect(types).toContain('glue');
    });

    it('getProvidersByCapability("discovery") includes all providers', () => {
      const discoveryProviders = registry.getProvidersByCapability('discovery');
      expect(discoveryProviders.length).toBe(3);
    });

    it('getProvidersByCapability("search") returns only search-capable providers', () => {
      const searchProviders = registry.getProvidersByCapability('search');
      const types = searchProviders.map((p) => p.providerType);
      expect(types).toContain('glue');
      expect(types).not.toContain('snowflake');
    });

    it('getProvider() returns a specific cached provider', () => {
      const sf = registry.getProvider('snowflake');
      expect(sf).toBeDefined();
      expect(sf!.providerType).toBe('snowflake');
    });

    it('cross-catalog: same listNamespaces() contract across providers', () => {
      const providers = registry.getAllProviders();
      for (const p of providers) {
        const ns = p.listNamespaces();
        const resolved = Array.isArray(ns) ? ns : [];
        expect(resolved.length).toBeGreaterThan(0);
        for (const n of resolved) {
          expect(Array.isArray(n.name)).toBe(true);
          expect(typeof n.properties).toBe('object');
        }
      }
    });
  });
});
