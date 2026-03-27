/**
 * Stubbed AWS Glue client.
 * Uses in-memory stores to simulate AWS Glue Data Catalog APIs.
 */

import type {
  IGlueClient,
  GlueDatabase,
  GlueTable,
  GlueColumn,
  GluePartition,
} from './types.js';

export class GlueStubClient implements IGlueClient {
  private databases: Map<string, GlueDatabase> = new Map();
  private tables: Map<string, GlueTable[]> = new Map();
  private partitions: Map<string, GluePartition[]> = new Map();
  private seeded = false;

  /** Pre-load with realistic Glue catalog metadata. */
  seed(): void {
    if (this.seeded) return;

    const now = Date.now();
    const DAY = 86_400_000;

    // --- Databases ---
    this.databases.set('analytics_db', {
      name: 'analytics_db',
      description: 'Analytics data lake database',
      locationUri: 's3://analytics-data-lake/databases/analytics_db/',
      createTime: now - DAY * 200,
    });
    this.databases.set('raw_data_db', {
      name: 'raw_data_db',
      description: 'Raw ingestion data',
      locationUri: 's3://raw-data-lake/databases/raw_data_db/',
      createTime: now - DAY * 365,
    });

    // --- Helper ---
    const col = (name: string, type: string, comment = ''): GlueColumn => ({ name, type, comment });

    // --- Tables: analytics_db ---
    const userEventsColumns: GlueColumn[] = [
      col('event_id', 'string', 'Unique event identifier'),
      col('user_id', 'bigint', 'User identifier'),
      col('event_type', 'string', 'Type of event'),
      col('event_timestamp', 'timestamp', 'When event occurred'),
      col('properties', 'map<string,string>', 'Event properties'),
    ];

    const ordersTransactionsColumns: GlueColumn[] = [
      col('order_id', 'bigint', 'Order identifier'),
      col('customer_id', 'bigint', 'Customer identifier'),
      col('order_date', 'date', 'Date of order'),
      col('total_amount', 'decimal(12,2)', 'Total order amount'),
      col('status', 'string', 'Order status'),
      col('payment_method', 'string', 'Payment method used'),
    ];

    const productCatalogColumns: GlueColumn[] = [
      col('product_id', 'bigint', 'Product identifier'),
      col('name', 'string', 'Product name'),
      col('category', 'string', 'Product category'),
      col('price', 'decimal(10,2)', 'Product price'),
      col('sku', 'string', 'Stock keeping unit'),
    ];

    this.tables.set('analytics_db', [
      {
        name: 'user_events',
        databaseName: 'analytics_db',
        columns: userEventsColumns,
        storageDescriptor: 's3://analytics-data-lake/user_events/',
        partitionKeys: [col('dt', 'string', 'Date partition')],
        tableType: 'EXTERNAL_TABLE',
        createTime: now - DAY * 150,
      },
      {
        name: 'orders_transactions',
        databaseName: 'analytics_db',
        columns: ordersTransactionsColumns,
        storageDescriptor: 's3://analytics-data-lake/orders_transactions/',
        partitionKeys: [col('year', 'string', 'Year partition'), col('month', 'string', 'Month partition')],
        tableType: 'EXTERNAL_TABLE',
        createTime: now - DAY * 120,
      },
      {
        name: 'product_catalog',
        databaseName: 'analytics_db',
        columns: productCatalogColumns,
        storageDescriptor: 's3://analytics-data-lake/product_catalog/',
        partitionKeys: [],
        tableType: 'EXTERNAL_TABLE',
        createTime: now - DAY * 100,
      },
    ]);

    // --- Tables: raw_data_db ---
    const clickstreamColumns: GlueColumn[] = [
      col('click_id', 'string', 'Click identifier'),
      col('session_id', 'string', 'Session identifier'),
      col('url', 'string', 'Clicked URL'),
      col('referrer', 'string', 'Referrer URL'),
      col('user_agent', 'string', 'Browser user agent'),
      col('timestamp', 'timestamp', 'Click timestamp'),
    ];

    const sessionLogsColumns: GlueColumn[] = [
      col('session_id', 'string', 'Session identifier'),
      col('user_id', 'bigint', 'User identifier'),
      col('start_time', 'timestamp', 'Session start'),
      col('end_time', 'timestamp', 'Session end'),
      col('page_views', 'int', 'Number of page views'),
      col('device_type', 'string', 'Device type'),
    ];

    this.tables.set('raw_data_db', [
      {
        name: 'clickstream_raw',
        databaseName: 'raw_data_db',
        columns: clickstreamColumns,
        storageDescriptor: 's3://raw-data-lake/clickstream/',
        partitionKeys: [col('dt', 'string', 'Date partition')],
        tableType: 'EXTERNAL_TABLE',
        createTime: now - DAY * 300,
      },
      {
        name: 'session_logs',
        databaseName: 'raw_data_db',
        columns: sessionLogsColumns,
        storageDescriptor: 's3://raw-data-lake/session_logs/',
        partitionKeys: [col('dt', 'string', 'Date partition')],
        tableType: 'EXTERNAL_TABLE',
        createTime: now - DAY * 280,
      },
    ]);

    // --- Partitions ---
    this.partitions.set('analytics_db.user_events', [
      { values: ['2024-01-15'], storageDescriptor: 's3://analytics-data-lake/user_events/dt=2024-01-15/', createTime: now - DAY * 60 },
      { values: ['2024-01-16'], storageDescriptor: 's3://analytics-data-lake/user_events/dt=2024-01-16/', createTime: now - DAY * 59 },
      { values: ['2024-01-17'], storageDescriptor: 's3://analytics-data-lake/user_events/dt=2024-01-17/', createTime: now - DAY * 58 },
    ]);
    this.partitions.set('raw_data_db.clickstream_raw', [
      { values: ['2024-01-15'], storageDescriptor: 's3://raw-data-lake/clickstream/dt=2024-01-15/', createTime: now - DAY * 60 },
      { values: ['2024-01-16'], storageDescriptor: 's3://raw-data-lake/clickstream/dt=2024-01-16/', createTime: now - DAY * 59 },
    ]);

    this.seeded = true;
  }

  /** List all databases. */
  listDatabases(): GlueDatabase[] {
    return Array.from(this.databases.values());
  }

  /** List tables in a database. */
  listTables(database: string): GlueTable[] {
    const tables = this.tables.get(database);
    if (!tables) {
      throw new Error(`Database not found: ${database}`);
    }
    return tables;
  }

  /** Get a specific table. */
  getTable(database: string, table: string): GlueTable {
    const tables = this.tables.get(database);
    if (!tables) {
      throw new Error(`Database not found: ${database}`);
    }
    const found = tables.find((t) => t.name === table);
    if (!found) {
      throw new Error(`Table not found: ${database}.${table}`);
    }
    return found;
  }

  /** Search tables by name or column name. */
  searchTables(query: string): GlueTable[] {
    const results: GlueTable[] = [];
    const q = query.toLowerCase();
    for (const tables of this.tables.values()) {
      for (const table of tables) {
        if (
          table.name.toLowerCase().includes(q) ||
          table.columns.some((c) => c.name.toLowerCase().includes(q))
        ) {
          results.push(table);
        }
      }
    }
    return results;
  }

  /** Get partitions for a table. */
  getPartitions(database: string, table: string): GluePartition[] {
    const key = `${database}.${table}`;
    return this.partitions.get(key) ?? [];
  }
}
