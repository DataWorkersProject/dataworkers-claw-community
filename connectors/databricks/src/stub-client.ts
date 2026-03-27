/**
 * Stubbed Databricks Unity Catalog client.
 * Uses an in-memory store to simulate the Databricks Unity Catalog API.
 */

import type {
  DatabricksCatalog,
  DatabricksSchema,
  DatabricksTable,
  DatabricksColumn,
  DatabricksQueryHistoryEntry,
} from './types.js';

export class DatabricksStubClient {
  private catalogs: Map<string, DatabricksCatalog> = new Map();
  private schemas: Map<string, DatabricksSchema[]> = new Map();
  private tables: Map<string, DatabricksTable[]> = new Map();
  private queryHistory: DatabricksQueryHistoryEntry[] = [];
  private seeded = false;

  /** Pre-load with realistic data simulating a Databricks Unity Catalog. */
  seed(): void {
    if (this.seeded) return;

    const now = Date.now();
    const DAY = 86_400_000;

    // --- Catalogs ---
    this.catalogs.set('main', {
      name: 'main',
      owner: 'data-engineering',
      comment: 'Primary catalog for production data',
      createdAt: now - DAY * 90,
    });
    this.catalogs.set('hive_metastore', {
      name: 'hive_metastore',
      owner: 'admin',
      comment: 'Legacy Hive metastore catalog',
      createdAt: now - DAY * 365,
    });

    // --- Schemas ---
    this.schemas.set('main', [
      {
        name: 'default',
        catalogName: 'main',
        owner: 'data-engineering',
        comment: 'Default schema',
        createdAt: now - DAY * 90,
      },
      {
        name: 'analytics',
        catalogName: 'main',
        owner: 'analytics-team',
        comment: 'Analytics and reporting tables',
        createdAt: now - DAY * 60,
      },
    ]);
    this.schemas.set('hive_metastore', [
      {
        name: 'legacy',
        catalogName: 'hive_metastore',
        owner: 'admin',
        comment: 'Legacy data from Hive',
        createdAt: now - DAY * 365,
      },
    ]);

    // --- Tables ---

    // main.default tables
    const ordersColumns: DatabricksColumn[] = [
      { name: 'order_id', type: 'BIGINT', nullable: false, comment: 'Primary key' },
      { name: 'customer_id', type: 'BIGINT', nullable: false, comment: 'FK to customers' },
      { name: 'order_date', type: 'DATE', nullable: false },
      { name: 'total_amount', type: 'DECIMAL(12,2)', nullable: false },
      { name: 'status', type: 'STRING', nullable: false, comment: 'Order status' },
    ];
    const customersColumns: DatabricksColumn[] = [
      { name: 'customer_id', type: 'BIGINT', nullable: false, comment: 'Primary key' },
      { name: 'email', type: 'STRING', nullable: false },
      { name: 'name', type: 'STRING', nullable: false },
      { name: 'signup_date', type: 'DATE', nullable: false },
    ];
    this.tables.set('main.default', [
      {
        name: 'orders',
        catalogName: 'main',
        schemaName: 'default',
        tableType: 'MANAGED',
        dataSourceFormat: 'DELTA',
        columns: ordersColumns,
        storageLocation: 'dbfs:/user/hive/warehouse/orders',
        owner: 'data-engineering',
      },
      {
        name: 'customers',
        catalogName: 'main',
        schemaName: 'default',
        tableType: 'MANAGED',
        dataSourceFormat: 'DELTA',
        columns: customersColumns,
        storageLocation: 'dbfs:/user/hive/warehouse/customers',
        owner: 'data-engineering',
      },
    ]);

    // main.analytics tables
    const dailyMetricsColumns: DatabricksColumn[] = [
      { name: 'date', type: 'DATE', nullable: false },
      { name: 'metric_name', type: 'STRING', nullable: false },
      { name: 'metric_value', type: 'DOUBLE', nullable: false },
    ];
    this.tables.set('main.analytics', [
      {
        name: 'daily_metrics',
        catalogName: 'main',
        schemaName: 'analytics',
        tableType: 'MANAGED',
        dataSourceFormat: 'DELTA',
        columns: dailyMetricsColumns,
        storageLocation: 'dbfs:/user/hive/warehouse/analytics/daily_metrics',
        owner: 'analytics-team',
      },
      {
        name: 'revenue_view',
        catalogName: 'main',
        schemaName: 'analytics',
        tableType: 'VIEW',
        dataSourceFormat: 'DELTA',
        columns: [
          { name: 'date', type: 'DATE', nullable: false },
          { name: 'total_revenue', type: 'DECIMAL(12,2)', nullable: false },
        ],
        owner: 'analytics-team',
      },
    ]);

    // hive_metastore.legacy tables
    const oldEventsColumns: DatabricksColumn[] = [
      { name: 'event_id', type: 'STRING', nullable: false, comment: 'UUID' },
      { name: 'event_type', type: 'STRING', nullable: false },
      { name: 'event_ts', type: 'TIMESTAMP', nullable: false },
      { name: 'payload', type: 'STRING', nullable: true, comment: 'JSON payload' },
    ];
    this.tables.set('hive_metastore.legacy', [
      {
        name: 'old_events',
        catalogName: 'hive_metastore',
        schemaName: 'legacy',
        tableType: 'EXTERNAL',
        dataSourceFormat: 'PARQUET',
        columns: oldEventsColumns,
        storageLocation: 's3://legacy-bucket/events/',
        owner: 'admin',
      },
    ]);

    // --- Query History ---
    this.queryHistory = [
      {
        queryId: 'q-001',
        queryText: 'SELECT * FROM main.default.orders WHERE order_date > current_date() - 7',
        status: 'FINISHED',
        durationMs: 2340,
        rowsProduced: 15432,
        bytesRead: 52_428_800,
        user: 'analyst@company.com',
        warehouse: 'analytics-wh',
        startTime: now - DAY * 1,
      },
      {
        queryId: 'q-002',
        queryText: 'SELECT count(*) FROM main.default.customers',
        status: 'FINISHED',
        durationMs: 890,
        rowsProduced: 1,
        bytesRead: 10_485_760,
        user: 'analyst@company.com',
        warehouse: 'analytics-wh',
        startTime: now - DAY * 1 + 3600_000,
      },
      {
        queryId: 'q-003',
        queryText: 'INSERT INTO main.analytics.daily_metrics SELECT ...',
        status: 'FINISHED',
        durationMs: 12500,
        rowsProduced: 0,
        bytesRead: 104_857_600,
        user: 'pipeline@company.com',
        warehouse: 'etl-wh',
        startTime: now - DAY * 2,
      },
      {
        queryId: 'q-004',
        queryText: 'SELECT * FROM main.default.nonexistent_table',
        status: 'FAILED',
        durationMs: 150,
        rowsProduced: 0,
        bytesRead: 0,
        user: 'analyst@company.com',
        warehouse: 'analytics-wh',
        startTime: now - DAY * 3,
      },
      {
        queryId: 'q-005',
        queryText: 'SELECT event_type, count(*) FROM hive_metastore.legacy.old_events GROUP BY 1',
        status: 'CANCELED',
        durationMs: 45000,
        rowsProduced: 0,
        bytesRead: 209_715_200,
        user: 'admin@company.com',
        warehouse: 'analytics-wh',
        startTime: now - DAY * 4,
      },
    ];

    this.seeded = true;
  }

  /** List all catalogs. */
  listCatalogs(): DatabricksCatalog[] {
    return Array.from(this.catalogs.values());
  }

  /** List schemas in a catalog. */
  listSchemas(catalog: string): DatabricksSchema[] {
    const schemas = this.schemas.get(catalog);
    if (!schemas) {
      throw new Error(`Catalog not found: ${catalog}`);
    }
    return schemas;
  }

  /** List tables in a catalog.schema. */
  listTables(catalog: string, schema: string): DatabricksTable[] {
    const key = `${catalog}.${schema}`;
    const tables = this.tables.get(key);
    if (!tables) {
      throw new Error(`Schema not found: ${key}`);
    }
    return tables;
  }

  /** Get a specific table by catalog.schema.table. */
  getTable(catalog: string, schema: string, table: string): DatabricksTable {
    const key = `${catalog}.${schema}`;
    const tables = this.tables.get(key);
    if (!tables) {
      throw new Error(`Schema not found: ${key}`);
    }
    const found = tables.find((t) => t.name === table);
    if (!found) {
      throw new Error(`Table not found: ${catalog}.${schema}.${table}`);
    }
    return found;
  }

  /** Get query history entries. */
  getQueryHistory(limit?: number): DatabricksQueryHistoryEntry[] {
    const entries = [...this.queryHistory].sort((a, b) => b.startTime - a.startTime);
    if (limit !== undefined && limit > 0) {
      return entries.slice(0, limit);
    }
    return entries;
  }
}
