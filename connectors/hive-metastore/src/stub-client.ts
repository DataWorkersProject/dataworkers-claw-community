/**
 * Stubbed Hive Metastore client.
 * Uses in-memory stores to simulate Hive Metastore Thrift API.
 */

import type {
  IHiveClient,
  HiveDatabase,
  HiveTable,
  HiveColumn,
  HivePartition,
} from './types.js';

export class HiveStubClient implements IHiveClient {
  private databases: Map<string, HiveDatabase> = new Map();
  private tables: Map<string, HiveTable[]> = new Map();
  private partitions: Map<string, HivePartition[]> = new Map();
  private seeded = false;

  /** Pre-load with realistic Hive Metastore metadata. */
  seed(): void {
    if (this.seeded) return;

    const now = Date.now();
    const DAY = 86_400_000;

    // --- Databases ---
    this.databases.set('default', {
      name: 'default',
      description: 'Default Hive database',
      locationUri: 'hdfs:///user/hive/warehouse',
      ownerName: 'hive',
      ownerType: 'USER',
    });
    this.databases.set('analytics', {
      name: 'analytics',
      description: 'Analytics tables and views',
      locationUri: 'hdfs:///user/hive/warehouse/analytics.db',
      ownerName: 'analytics_team',
      ownerType: 'GROUP',
    });
    this.databases.set('raw_zone', {
      name: 'raw_zone',
      description: 'Raw ingestion zone',
      locationUri: 's3://data-lake/raw_zone/',
      ownerName: 'data_eng',
      ownerType: 'GROUP',
    });

    // --- Helper ---
    const col = (name: string, type: string, comment = ''): HiveColumn => ({ name, type, comment });

    // --- Tables: default ---
    this.tables.set('default', [
      {
        name: 'customer_dim',
        databaseName: 'default',
        owner: 'hive',
        tableType: 'MANAGED_TABLE',
        columns: [
          col('customer_id', 'bigint', 'Customer identifier'),
          col('name', 'string', 'Customer name'),
          col('email', 'string', 'Email address'),
          col('segment', 'string', 'Customer segment'),
          col('created_at', 'timestamp', 'Record creation time'),
        ],
        partitionKeys: [],
        storageDescriptor: 'hdfs:///user/hive/warehouse/customer_dim',
        createTime: now - DAY * 300,
        format: 'hive',
      },
      {
        name: 'product_dim',
        databaseName: 'default',
        owner: 'hive',
        tableType: 'MANAGED_TABLE',
        columns: [
          col('product_id', 'bigint', 'Product identifier'),
          col('name', 'string', 'Product name'),
          col('category', 'string', 'Product category'),
          col('price', 'decimal(10,2)', 'Unit price'),
        ],
        partitionKeys: [],
        storageDescriptor: 'hdfs:///user/hive/warehouse/product_dim',
        createTime: now - DAY * 280,
        format: 'hive',
      },
    ]);

    // --- Tables: analytics ---
    this.tables.set('analytics', [
      {
        name: 'daily_sales',
        databaseName: 'analytics',
        owner: 'analytics_team',
        tableType: 'MANAGED_TABLE',
        columns: [
          col('sale_date', 'date', 'Date of sale'),
          col('product_id', 'bigint', 'Product identifier'),
          col('quantity', 'int', 'Units sold'),
          col('revenue', 'decimal(12,2)', 'Revenue amount'),
          col('region', 'string', 'Sales region'),
        ],
        partitionKeys: [col('dt', 'string', 'Date partition')],
        storageDescriptor: 'hdfs:///user/hive/warehouse/analytics.db/daily_sales',
        createTime: now - DAY * 200,
        format: 'hive',
      },
      {
        name: 'user_activity_iceberg',
        databaseName: 'analytics',
        owner: 'analytics_team',
        tableType: 'EXTERNAL_TABLE',
        columns: [
          col('user_id', 'bigint', 'User identifier'),
          col('activity_type', 'string', 'Type of activity'),
          col('timestamp', 'timestamp', 'Activity timestamp'),
          col('metadata', 'map<string,string>', 'Activity metadata'),
        ],
        partitionKeys: [col('dt', 'string', 'Date partition')],
        storageDescriptor: 's3://data-lake/analytics/user_activity_iceberg/',
        createTime: now - DAY * 90,
        format: 'iceberg',
      },
      {
        name: 'order_facts_delta',
        databaseName: 'analytics',
        owner: 'data_eng',
        tableType: 'EXTERNAL_TABLE',
        columns: [
          col('order_id', 'bigint', 'Order identifier'),
          col('customer_id', 'bigint', 'Customer identifier'),
          col('order_date', 'date', 'Date of order'),
          col('total', 'decimal(12,2)', 'Order total'),
          col('status', 'string', 'Order status'),
        ],
        partitionKeys: [col('year', 'string', 'Year partition'), col('month', 'string', 'Month partition')],
        storageDescriptor: 's3://data-lake/analytics/order_facts_delta/',
        createTime: now - DAY * 60,
        format: 'delta',
      },
    ]);

    // --- Tables: raw_zone ---
    this.tables.set('raw_zone', [
      {
        name: 'clickstream',
        databaseName: 'raw_zone',
        owner: 'data_eng',
        tableType: 'EXTERNAL_TABLE',
        columns: [
          col('click_id', 'string', 'Click identifier'),
          col('session_id', 'string', 'Session identifier'),
          col('url', 'string', 'Page URL'),
          col('user_agent', 'string', 'Browser user agent'),
          col('ts', 'timestamp', 'Click timestamp'),
        ],
        partitionKeys: [col('dt', 'string', 'Date partition')],
        storageDescriptor: 's3://data-lake/raw_zone/clickstream/',
        createTime: now - DAY * 250,
        format: 'hive',
      },
      {
        name: 'server_logs',
        databaseName: 'raw_zone',
        owner: 'data_eng',
        tableType: 'EXTERNAL_TABLE',
        columns: [
          col('log_id', 'string', 'Log identifier'),
          col('level', 'string', 'Log level'),
          col('message', 'string', 'Log message'),
          col('service', 'string', 'Source service'),
          col('timestamp', 'timestamp', 'Log timestamp'),
        ],
        partitionKeys: [col('dt', 'string', 'Date partition'), col('service', 'string', 'Service partition')],
        storageDescriptor: 's3://data-lake/raw_zone/server_logs/',
        createTime: now - DAY * 240,
        format: 'hive',
      },
      {
        name: 'events_hudi',
        databaseName: 'raw_zone',
        owner: 'data_eng',
        tableType: 'EXTERNAL_TABLE',
        columns: [
          col('event_id', 'string', 'Event identifier'),
          col('event_type', 'string', 'Event type'),
          col('payload', 'string', 'JSON payload'),
          col('created_at', 'timestamp', 'Event creation time'),
        ],
        partitionKeys: [col('dt', 'string', 'Date partition')],
        storageDescriptor: 's3://data-lake/raw_zone/events_hudi/',
        createTime: now - DAY * 45,
        format: 'hudi',
      },
    ]);

    // --- Partitions ---
    this.partitions.set('analytics.daily_sales', [
      { values: ['2024-01-15'], location: 'hdfs:///user/hive/warehouse/analytics.db/daily_sales/dt=2024-01-15', createTime: now - DAY * 60 },
      { values: ['2024-01-16'], location: 'hdfs:///user/hive/warehouse/analytics.db/daily_sales/dt=2024-01-16', createTime: now - DAY * 59 },
      { values: ['2024-01-17'], location: 'hdfs:///user/hive/warehouse/analytics.db/daily_sales/dt=2024-01-17', createTime: now - DAY * 58 },
    ]);
    this.partitions.set('raw_zone.clickstream', [
      { values: ['2024-01-15'], location: 's3://data-lake/raw_zone/clickstream/dt=2024-01-15/', createTime: now - DAY * 60 },
      { values: ['2024-01-16'], location: 's3://data-lake/raw_zone/clickstream/dt=2024-01-16/', createTime: now - DAY * 59 },
    ]);

    this.seeded = true;
  }

  /** List all databases. */
  listDatabases(): HiveDatabase[] {
    return Array.from(this.databases.values());
  }

  /** List tables in a database. */
  listTables(database: string): HiveTable[] {
    const tables = this.tables.get(database);
    if (!tables) {
      throw new Error(`Database not found: ${database}`);
    }
    return tables;
  }

  /** Get a specific table. */
  getTable(database: string, table: string): HiveTable {
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

  /** Get partitions for a table. */
  getPartitions(database: string, table: string): HivePartition[] {
    const key = `${database}.${table}`;
    return this.partitions.get(key) ?? [];
  }
}
