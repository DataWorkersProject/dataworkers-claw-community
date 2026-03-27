/**
 * Stubbed Snowflake client.
 * Uses in-memory stores to simulate Snowflake metadata and usage APIs.
 */

import type {
  ISnowflakeClient,
  SnowflakeDatabase,
  SnowflakeSchema,
  SnowflakeTable,
  SnowflakeColumn,
  SnowflakeTableDDL,
  SnowflakeWarehouseUsage,
  SnowflakeQueryHistoryEntry,
} from './types.js';

export class SnowflakeStubClient implements ISnowflakeClient {
  private databases: Map<string, SnowflakeDatabase> = new Map();
  private schemas: Map<string, SnowflakeSchema[]> = new Map();
  private tables: Map<string, SnowflakeTable[]> = new Map();
  private ddls: Map<string, SnowflakeTableDDL> = new Map();
  private warehouseUsage: SnowflakeWarehouseUsage[] = [];
  private queryHistory: SnowflakeQueryHistoryEntry[] = [];
  private seeded = false;

  /** Pre-load with realistic Snowflake metadata. */
  seed(): void {
    if (this.seeded) return;

    const now = Date.now();
    const DAY = 86_400_000;

    // --- Databases ---
    this.databases.set('ANALYTICS', {
      name: 'ANALYTICS',
      owner: 'SYSADMIN',
      createdAt: now - DAY * 180,
      comment: 'Analytics data warehouse',
    });
    this.databases.set('RAW', {
      name: 'RAW',
      owner: 'SYSADMIN',
      createdAt: now - DAY * 365,
      comment: 'Raw ingested data',
    });

    // --- Schemas ---
    this.schemas.set('ANALYTICS', [
      { name: 'PUBLIC', database: 'ANALYTICS', owner: 'SYSADMIN', createdAt: now - DAY * 180 },
      { name: 'MARTS', database: 'ANALYTICS', owner: 'ANALYTICS_ADMIN', createdAt: now - DAY * 90 },
    ]);
    this.schemas.set('RAW', [
      { name: 'INGESTION', database: 'RAW', owner: 'LOADER_ROLE', createdAt: now - DAY * 365 },
    ]);

    // --- Tables ---
    // Helper to build columns
    const col = (
      name: string,
      type: string,
      nullable = false,
      defaultValue: string | null = null,
      comment = '',
    ): SnowflakeColumn => ({ name, type, nullable, defaultValue, comment });

    // ANALYTICS.PUBLIC tables
    const ordersColumns: SnowflakeColumn[] = [
      col('ORDER_ID', 'NUMBER(38,0)', false, null, 'Primary key'),
      col('CUSTOMER_ID', 'NUMBER(38,0)', false, null, 'FK to customers'),
      col('ORDER_DATE', 'DATE', false, null, 'Date of order'),
      col('TOTAL_AMOUNT', 'NUMBER(12,2)', false, null, 'Order total'),
      col('STATUS', 'VARCHAR(50)', false, "'PENDING'", 'Order status'),
    ];
    const customersColumns: SnowflakeColumn[] = [
      col('CUSTOMER_ID', 'NUMBER(38,0)', false, null, 'Primary key'),
      col('EMAIL', 'VARCHAR(255)', false, null, 'Customer email'),
      col('NAME', 'VARCHAR(200)', false, null, 'Full name'),
      col('CREATED_AT', 'TIMESTAMP_NTZ', false, 'CURRENT_TIMESTAMP()', 'Record creation'),
    ];

    this.tables.set('ANALYTICS.PUBLIC', [
      {
        name: 'ORDERS',
        database: 'ANALYTICS',
        schema: 'PUBLIC',
        kind: 'TABLE',
        rowCount: 12_000_000,
        bytes: 4_800_000_000,
        owner: 'SYSADMIN',
        createdAt: now - DAY * 150,
      },
      {
        name: 'CUSTOMERS',
        database: 'ANALYTICS',
        schema: 'PUBLIC',
        kind: 'TABLE',
        rowCount: 3_000_000,
        bytes: 900_000_000,
        owner: 'SYSADMIN',
        createdAt: now - DAY * 150,
      },
    ]);

    this.ddls.set('ANALYTICS.PUBLIC.ORDERS', {
      database: 'ANALYTICS',
      schema: 'PUBLIC',
      table: 'ORDERS',
      columns: ordersColumns,
      clusteringKeys: ['ORDER_DATE'],
    });
    this.ddls.set('ANALYTICS.PUBLIC.CUSTOMERS', {
      database: 'ANALYTICS',
      schema: 'PUBLIC',
      table: 'CUSTOMERS',
      columns: customersColumns,
      clusteringKeys: [],
    });

    // ANALYTICS.MARTS tables
    const dailyRevenueColumns: SnowflakeColumn[] = [
      col('DATE', 'DATE', false, null, 'Revenue date'),
      col('REVENUE', 'NUMBER(14,2)', false, null, 'Daily revenue total'),
      col('ORDER_COUNT', 'NUMBER(38,0)', false, null, 'Number of orders'),
    ];

    this.tables.set('ANALYTICS.MARTS', [
      {
        name: 'DAILY_REVENUE',
        database: 'ANALYTICS',
        schema: 'MARTS',
        kind: 'TABLE',
        rowCount: 500_000,
        bytes: 50_000_000,
        owner: 'ANALYTICS_ADMIN',
        createdAt: now - DAY * 60,
      },
    ]);

    this.ddls.set('ANALYTICS.MARTS.DAILY_REVENUE', {
      database: 'ANALYTICS',
      schema: 'MARTS',
      table: 'DAILY_REVENUE',
      columns: dailyRevenueColumns,
      clusteringKeys: ['DATE'],
    });

    // RAW.INGESTION tables
    const rawEventsColumns: SnowflakeColumn[] = [
      col('EVENT_ID', 'VARCHAR(36)', false, null, 'UUID'),
      col('EVENT_TYPE', 'VARCHAR(100)', false, null, 'Type of event'),
      col('PAYLOAD', 'VARIANT', true, null, 'Raw JSON payload'),
      col('SOURCE', 'VARCHAR(100)', false, null, 'Event source system'),
      col('INGESTED_AT', 'TIMESTAMP_NTZ', false, 'CURRENT_TIMESTAMP()', 'Ingestion timestamp'),
    ];

    this.tables.set('RAW.INGESTION', [
      {
        name: 'RAW_EVENTS',
        database: 'RAW',
        schema: 'INGESTION',
        kind: 'TABLE',
        rowCount: 50_000_000,
        bytes: 25_000_000_000,
        owner: 'LOADER_ROLE',
        createdAt: now - DAY * 300,
      },
    ]);

    this.ddls.set('RAW.INGESTION.RAW_EVENTS', {
      database: 'RAW',
      schema: 'INGESTION',
      table: 'RAW_EVENTS',
      columns: rawEventsColumns,
      clusteringKeys: ['INGESTED_AT'],
    });

    // --- Warehouse Usage ---
    this.warehouseUsage = [
      {
        warehouseName: 'COMPUTE_WH',
        creditsUsed: 245.8,
        queriesExecuted: 15_420,
        avgExecutionTimeMs: 3200,
        period: { start: now - DAY * 7, end: now },
      },
      {
        warehouseName: 'LOADING_WH',
        creditsUsed: 89.3,
        queriesExecuted: 2_100,
        avgExecutionTimeMs: 12_500,
        period: { start: now - DAY * 7, end: now },
      },
      {
        warehouseName: 'ANALYST_WH',
        creditsUsed: 156.2,
        queriesExecuted: 8_750,
        avgExecutionTimeMs: 5800,
        period: { start: now - DAY * 7, end: now },
      },
    ];

    // --- Query History ---
    this.queryHistory = [
      {
        queryId: 'q-001-abc',
        queryText: 'SELECT * FROM ANALYTICS.PUBLIC.ORDERS LIMIT 100',
        status: 'SUCCESS',
        durationMs: 1240,
        bytesScanned: 48_000_000,
        rowsProduced: 100,
        user: 'ANALYST_USER',
        warehouse: 'ANALYST_WH',
        startTime: now - DAY * 1,
      },
      {
        queryId: 'q-002-def',
        queryText: 'CREATE TABLE ANALYTICS.MARTS.DAILY_REVENUE AS SELECT ...',
        status: 'SUCCESS',
        durationMs: 45_000,
        bytesScanned: 4_800_000_000,
        rowsProduced: 500_000,
        user: 'ETL_USER',
        warehouse: 'COMPUTE_WH',
        startTime: now - DAY * 2,
      },
      {
        queryId: 'q-003-ghi',
        queryText: 'COPY INTO RAW.INGESTION.RAW_EVENTS FROM @ext_stage',
        status: 'SUCCESS',
        durationMs: 120_000,
        bytesScanned: 0,
        rowsProduced: 5_000_000,
        user: 'LOADER_USER',
        warehouse: 'LOADING_WH',
        startTime: now - DAY * 3,
      },
      {
        queryId: 'q-004-jkl',
        queryText: 'SELECT COUNT(*) FROM ANALYTICS.PUBLIC.CUSTOMERS WHERE EMAIL IS NULL',
        status: 'SUCCESS',
        durationMs: 890,
        bytesScanned: 900_000_000,
        rowsProduced: 1,
        user: 'ANALYST_USER',
        warehouse: 'ANALYST_WH',
        startTime: now - DAY * 4,
      },
      {
        queryId: 'q-005-mno',
        queryText: 'ALTER WAREHOUSE COMPUTE_WH SET WAREHOUSE_SIZE = XLARGE',
        status: 'SUCCESS',
        durationMs: 150,
        bytesScanned: 0,
        rowsProduced: 0,
        user: 'ADMIN_USER',
        warehouse: 'COMPUTE_WH',
        startTime: now - DAY * 5,
      },
    ];

    this.seeded = true;
  }

  /** List all databases. */
  listDatabases(): SnowflakeDatabase[] {
    return Array.from(this.databases.values());
  }

  /** List schemas in a database. */
  listSchemas(database: string): SnowflakeSchema[] {
    const schemas = this.schemas.get(database);
    if (!schemas) {
      throw new Error(`Database not found: ${database}`);
    }
    return schemas;
  }

  /** List tables in a database.schema. */
  listTables(database: string, schema: string): SnowflakeTable[] {
    const key = `${database}.${schema}`;
    const tables = this.tables.get(key);
    if (!tables) {
      throw new Error(`Schema not found: ${key}`);
    }
    return tables;
  }

  /** Get table DDL (columns and clustering keys). */
  getTableDDL(database: string, schema: string, table: string): SnowflakeTableDDL {
    const key = `${database}.${schema}.${table}`;
    const ddl = this.ddls.get(key);
    if (!ddl) {
      throw new Error(`Table not found: ${key}`);
    }
    return ddl;
  }

  /** Query warehouse usage metrics. */
  queryWarehouseUsage(): SnowflakeWarehouseUsage[] {
    return this.warehouseUsage;
  }

  /** Get query history entries. */
  getQueryHistory(limit?: number): SnowflakeQueryHistoryEntry[] {
    const entries = this.queryHistory;
    if (limit !== undefined && limit > 0) {
      return entries.slice(0, limit);
    }
    return entries;
  }
}
