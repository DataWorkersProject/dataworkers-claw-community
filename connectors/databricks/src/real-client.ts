/**
 * Real Databricks client.
 * Uses the @databricks/sql npm package for SQL queries and the REST API
 * for Unity Catalog metadata. Implements IDatabricksClient so it can be
 * used interchangeably with the stub.
 */

import type {
  IDatabricksClient,
  DatabricksConnectionConfig,
  DatabricksCatalog,
  DatabricksSchema,
  DatabricksTable,
  DatabricksColumn,
  DatabricksQueryHistoryEntry,
} from './types.js';

/** Execute a SQL statement via the Databricks SQL connector and return rows. */
async function executeSQL(
  session: any,
  sql: string,
): Promise<Record<string, unknown>[]> {
  const operation = await session.executeStatement(sql);
  const result = await operation.fetchAll();
  await operation.close();
  return result as Record<string, unknown>[];
}

export class RealDatabricksClient implements IDatabricksClient {
  private session: any;
  private client: any;
  private config: DatabricksConnectionConfig;

  private constructor(
    client: any,
    session: any,
    config: DatabricksConnectionConfig,
  ) {
    this.client = client;
    this.session = session;
    this.config = config;
  }

  /**
   * Establish a connection to Databricks using @databricks/sql.
   * Uses a dynamic import so the SDK is only loaded when needed.
   */
  static async connect(config: DatabricksConnectionConfig): Promise<RealDatabricksClient> {
    const { DBSQLClient } = await import('@databricks/sql');
    const client = new DBSQLClient();

    await client.connect({
      host: config.host.replace(/^https?:\/\//, ''),
      path: config.httpPath ?? '/sql/1.0/warehouses/default',
      token: config.token,
    });

    const session = await client.openSession({
      initialCatalog: config.catalogName,
    });

    return new RealDatabricksClient(client, session, config);
  }

  async listCatalogs(): Promise<DatabricksCatalog[]> {
    const rows = await executeSQL(this.session, 'SHOW CATALOGS');
    return rows.map((row) => ({
      name: String(row['catalog'] ?? row['catalog_name'] ?? ''),
      owner: String(row['owner'] ?? ''),
      comment: String(row['comment'] ?? ''),
      createdAt: row['created_at']
        ? new Date(String(row['created_at'])).getTime()
        : Date.now(),
    }));
  }

  async listSchemas(catalog: string): Promise<DatabricksSchema[]> {
    const rows = await executeSQL(
      this.session,
      `SHOW SCHEMAS IN \`${catalog}\``,
    );
    return rows.map((row) => ({
      name: String(row['databaseName'] ?? row['namespace'] ?? row['schema_name'] ?? ''),
      catalogName: catalog,
      owner: String(row['owner'] ?? ''),
      comment: String(row['comment'] ?? ''),
      createdAt: row['created_at']
        ? new Date(String(row['created_at'])).getTime()
        : Date.now(),
    }));
  }

  async listTables(catalog: string, schema: string): Promise<DatabricksTable[]> {
    const rows = await executeSQL(
      this.session,
      `SHOW TABLES IN \`${catalog}\`.\`${schema}\``,
    );

    const tables: DatabricksTable[] = [];
    for (const row of rows) {
      const tableName = String(row['tableName'] ?? row['table_name'] ?? '');
      if (!tableName) continue;

      // Fetch columns for each table
      let columns: DatabricksColumn[] = [];
      try {
        const colRows = await executeSQL(
          this.session,
          `DESCRIBE TABLE \`${catalog}\`.\`${schema}\`.\`${tableName}\``,
        );
        columns = colRows
          .filter((r) => {
            const colName = String(r['col_name'] ?? '');
            // Filter out partition/metadata separator rows
            return colName && !colName.startsWith('#');
          })
          .map((r) => ({
            name: String(r['col_name'] ?? ''),
            type: String(r['data_type'] ?? 'STRING'),
            nullable: true, // DESCRIBE doesn't reliably report nullability
            comment: String(r['comment'] ?? '') || undefined,
          }));
      } catch {
        // If DESCRIBE fails, return table with empty columns
      }

      tables.push({
        name: tableName,
        catalogName: catalog,
        schemaName: schema,
        tableType: mapTableType(String(row['tableType'] ?? row['type'] ?? 'MANAGED')),
        dataSourceFormat: 'DELTA' as const,
        columns,
        owner: String(row['owner'] ?? ''),
      });
    }

    return tables;
  }

  async getTable(catalog: string, schema: string, table: string): Promise<DatabricksTable> {
    // Get table details via DESCRIBE EXTENDED
    const rows = await executeSQL(
      this.session,
      `DESCRIBE TABLE EXTENDED \`${catalog}\`.\`${schema}\`.\`${table}\``,
    );

    // Parse columns (rows before the metadata separator)
    const columns: DatabricksColumn[] = [];
    const metadata: Record<string, string> = {};
    let inMetadata = false;

    for (const row of rows) {
      const colName = String(row['col_name'] ?? '');
      if (!colName || colName.startsWith('#')) {
        inMetadata = true;
        continue;
      }
      if (inMetadata) {
        metadata[colName.trim()] = String(row['data_type'] ?? '').trim();
      } else {
        columns.push({
          name: colName,
          type: String(row['data_type'] ?? 'STRING'),
          nullable: true,
          comment: String(row['comment'] ?? '') || undefined,
        });
      }
    }

    return {
      name: table,
      catalogName: catalog,
      schemaName: schema,
      tableType: mapTableType(metadata['Type'] ?? 'MANAGED'),
      dataSourceFormat: mapDataSourceFormat(metadata['Provider'] ?? 'delta'),
      columns,
      storageLocation: metadata['Location'] || undefined,
      owner: metadata['Owner'] ?? '',
    };
  }

  async getQueryHistory(limit?: number): Promise<DatabricksQueryHistoryEntry[]> {
    const effectiveLimit = limit && limit > 0 ? limit : 50;
    // Use INFORMATION_SCHEMA if available (Unity Catalog)
    try {
      const rows = await executeSQL(
        this.session,
        `SELECT
           query_id,
           query_text,
           status,
           execution_duration_ms,
           rows_produced,
           read_bytes,
           user_name,
           warehouse_id,
           query_start_time_ms
         FROM system.query.history
         ORDER BY query_start_time_ms DESC
         LIMIT ${effectiveLimit}`,
      );
      return rows.map((row) => ({
        queryId: String(row['query_id'] ?? ''),
        queryText: String(row['query_text'] ?? ''),
        status: mapQueryStatus(String(row['status'] ?? '')),
        durationMs: Number(row['execution_duration_ms'] ?? 0),
        rowsProduced: Number(row['rows_produced'] ?? 0),
        bytesRead: Number(row['read_bytes'] ?? 0),
        user: String(row['user_name'] ?? ''),
        warehouse: String(row['warehouse_id'] ?? ''),
        startTime: Number(row['query_start_time_ms'] ?? Date.now()),
      }));
    } catch {
      // system.query.history may not be available — return empty
      return [];
    }
  }
}

function mapTableType(raw: string): 'MANAGED' | 'EXTERNAL' | 'VIEW' {
  const upper = raw.toUpperCase();
  if (upper.includes('VIEW')) return 'VIEW';
  if (upper.includes('EXTERNAL')) return 'EXTERNAL';
  return 'MANAGED';
}

function mapDataSourceFormat(raw: string): 'DELTA' | 'PARQUET' | 'CSV' | 'JSON' {
  const lower = raw.toLowerCase();
  if (lower.includes('parquet')) return 'PARQUET';
  if (lower.includes('csv')) return 'CSV';
  if (lower.includes('json')) return 'JSON';
  return 'DELTA';
}

function mapQueryStatus(raw: string): 'FINISHED' | 'FAILED' | 'CANCELED' {
  const upper = raw.toUpperCase();
  if (upper.includes('FAIL')) return 'FAILED';
  if (upper.includes('CANCEL')) return 'CANCELED';
  return 'FINISHED';
}
