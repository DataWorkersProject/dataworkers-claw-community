/**
 * Real Snowflake client.
 * Uses the snowflake-sdk npm package to connect to a live Snowflake instance.
 * Implements ISnowflakeClient so it can be used interchangeably with the stub.
 */

import type {
  ISnowflakeClient,
  SnowflakeConnectionConfig,
  SnowflakeDatabase,
  SnowflakeSchema,
  SnowflakeTable,
  SnowflakeTableDDL,
  SnowflakeWarehouseUsage,
  SnowflakeQueryHistoryEntry,
} from './types.js';

/** Helper: execute a SQL statement via snowflake-sdk and return rows. */
function executeStatement(
  connection: any,
  sqlText: string,
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete(err: Error | undefined, _stmt: unknown, rows: Record<string, unknown>[]) {
        if (err) {
          reject(err);
        } else {
          resolve(rows ?? []);
        }
      },
    });
  });
}

export class RealSnowflakeClient implements ISnowflakeClient {
  private connection: any;

  private constructor(connection: any) {
    this.connection = connection;
  }

  /**
   * Establish a connection to Snowflake using snowflake-sdk.
   * Uses a dynamic import so the SDK is only loaded when actually needed
   * (allows graceful fallback when the package is not installed).
   */
  static async connect(config: SnowflakeConnectionConfig): Promise<RealSnowflakeClient> {
    const snowflake = await import('snowflake-sdk');
    const connection = snowflake.createConnection({
      account: config.account,
      username: config.username,
      password: config.password,
      warehouse: config.warehouse,
      database: config.database,
      schema: config.schema,
      role: config.role,
    });

    await new Promise<void>((resolve, reject) => {
      connection.connect((err: Error | undefined) => {
        if (err) {
          reject(new Error(`Snowflake connection failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });

    return new RealSnowflakeClient(connection);
  }

  /** No-op — real clients do not need seed data. */
  seed(): void {
    // no-op
  }

  async listDatabases(): Promise<SnowflakeDatabase[]> {
    const rows = await executeStatement(this.connection, 'SHOW DATABASES');
    return rows.map((row) => ({
      name: String(row['name'] ?? ''),
      owner: String(row['owner'] ?? ''),
      createdAt: row['created_on'] ? new Date(String(row['created_on'])).getTime() : Date.now(),
      comment: String(row['comment'] ?? ''),
    }));
  }

  async listSchemas(database: string): Promise<SnowflakeSchema[]> {
    const rows = await executeStatement(
      this.connection,
      `SHOW SCHEMAS IN DATABASE "${database}"`,
    );
    return rows.map((row) => ({
      name: String(row['name'] ?? ''),
      database,
      owner: String(row['owner'] ?? ''),
      createdAt: row['created_on'] ? new Date(String(row['created_on'])).getTime() : Date.now(),
    }));
  }

  async listTables(database: string, schema: string): Promise<SnowflakeTable[]> {
    const rows = await executeStatement(
      this.connection,
      `SHOW TABLES IN "${database}"."${schema}"`,
    );
    return rows.map((row) => ({
      name: String(row['name'] ?? ''),
      database,
      schema,
      kind: (String(row['kind'] ?? 'TABLE') as 'TABLE' | 'VIEW'),
      rowCount: Number(row['rows'] ?? 0),
      bytes: Number(row['bytes'] ?? 0),
      owner: String(row['owner'] ?? ''),
      createdAt: row['created_on'] ? new Date(String(row['created_on'])).getTime() : Date.now(),
    }));
  }

  async getTableDDL(database: string, schema: string, table: string): Promise<SnowflakeTableDDL> {
    const colRows = await executeStatement(
      this.connection,
      `SHOW COLUMNS IN "${database}"."${schema}"."${table}"`,
    );

    const columns = colRows.map((row) => {
      // SHOW COLUMNS returns data_type as a JSON string containing type info
      let type = String(row['data_type'] ?? 'VARCHAR');
      try {
        const parsed = JSON.parse(type);
        type = String(parsed.type ?? type);
      } catch {
        // use raw value
      }
      return {
        name: String(row['column_name'] ?? ''),
        type,
        nullable: String(row['is_nullable'] ?? 'YES') === 'YES',
        defaultValue: row['default'] != null ? String(row['default']) : null,
        comment: String(row['comment'] ?? ''),
      };
    });

    // Try to get clustering keys
    let clusteringKeys: string[] = [];
    try {
      const clusterRows = await executeStatement(
        this.connection,
        `SHOW TABLES LIKE '${table}' IN "${database}"."${schema}"`,
      );
      if (clusterRows.length > 0) {
        const ck = String(clusterRows[0]['cluster_by'] ?? '');
        if (ck) {
          clusteringKeys = ck
            .replace(/^LINEAR\(/, '')
            .replace(/\)$/, '')
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean);
        }
      }
    } catch {
      // clustering keys are optional metadata
    }

    return { database, schema, table, columns, clusteringKeys };
  }

  async queryWarehouseUsage(): Promise<SnowflakeWarehouseUsage[]> {
    const rows = await executeStatement(
      this.connection,
      `SELECT
         WAREHOUSE_NAME,
         SUM(CREDITS_USED) AS CREDITS_USED,
         COUNT(*) AS QUERIES_EXECUTED,
         AVG(EXECUTION_TIME) AS AVG_EXECUTION_TIME_MS,
         MIN(START_TIME) AS PERIOD_START,
         MAX(END_TIME) AS PERIOD_END
       FROM TABLE(INFORMATION_SCHEMA.WAREHOUSE_METERING_HISTORY(
         DATE_RANGE_START => DATEADD('day', -7, CURRENT_TIMESTAMP())
       ))
       GROUP BY WAREHOUSE_NAME`,
    );
    return rows.map((row) => ({
      warehouseName: String(row['WAREHOUSE_NAME'] ?? ''),
      creditsUsed: Number(row['CREDITS_USED'] ?? 0),
      queriesExecuted: Number(row['QUERIES_EXECUTED'] ?? 0),
      avgExecutionTimeMs: Number(row['AVG_EXECUTION_TIME_MS'] ?? 0),
      period: {
        start: row['PERIOD_START'] ? new Date(String(row['PERIOD_START'])).getTime() : Date.now() - 7 * 86_400_000,
        end: row['PERIOD_END'] ? new Date(String(row['PERIOD_END'])).getTime() : Date.now(),
      },
    }));
  }

  async getQueryHistory(limit?: number): Promise<SnowflakeQueryHistoryEntry[]> {
    const effectiveLimit = limit && limit > 0 ? limit : 100;
    const rows = await executeStatement(
      this.connection,
      `SELECT
         QUERY_ID,
         QUERY_TEXT,
         EXECUTION_STATUS,
         TOTAL_ELAPSED_TIME,
         BYTES_SCANNED,
         ROWS_PRODUCED,
         USER_NAME,
         WAREHOUSE_NAME,
         START_TIME
       FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(
         RESULT_LIMIT => ${effectiveLimit}
       ))
       ORDER BY START_TIME DESC`,
    );
    return rows.map((row) => ({
      queryId: String(row['QUERY_ID'] ?? ''),
      queryText: String(row['QUERY_TEXT'] ?? ''),
      status: String(row['EXECUTION_STATUS'] ?? 'UNKNOWN'),
      durationMs: Number(row['TOTAL_ELAPSED_TIME'] ?? 0),
      bytesScanned: Number(row['BYTES_SCANNED'] ?? 0),
      rowsProduced: Number(row['ROWS_PRODUCED'] ?? 0),
      user: String(row['USER_NAME'] ?? ''),
      warehouse: String(row['WAREHOUSE_NAME'] ?? ''),
      startTime: row['START_TIME'] ? new Date(String(row['START_TIME'])).getTime() : Date.now(),
    }));
  }
}
