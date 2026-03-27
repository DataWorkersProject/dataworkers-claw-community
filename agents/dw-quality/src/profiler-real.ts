/**
 * Real Warehouse Profiler — executes SQL against a live warehouse
 * via IWarehouseConnector.executeQuery to compute actual profiling metrics.
 *
 * Falls back to the schema-based DataProfiler when executeQuery is unavailable
 * or the warehouse is an InMemory stub.
 */

import type { IWarehouseConnector } from '@data-workers/infrastructure-stubs';
import { DataProfiler } from './profiler.js';
import type { ProfileResult, ColumnProfile } from './profiler.js';

export class RealWarehouseProfiler {
  private warehouse: IWarehouseConnector;
  private fallback: DataProfiler;

  constructor(warehouse: IWarehouseConnector) {
    this.warehouse = warehouse;
    this.fallback = new DataProfiler(warehouse);
  }

  /**
   * Profile a table using real SQL queries when possible.
   * Falls back to the deterministic schema-based profiler for InMemory stubs.
   */
  async profileTable(
    customerId: string,
    source: string,
    database: string,
    schema: string,
    table: string,
  ): Promise<ProfileResult | null> {
    // Check table exists
    const tableSchema = await this.warehouse.getTableSchema(customerId, source, database, schema, table);
    if (!tableSchema) return null;

    try {
      // Attempt real profiling via SQL
      const fqn = `${database}.${schema}.${table}`;
      const countResult = await this.warehouse.executeQuery(`SELECT COUNT(*) AS cnt FROM ${fqn}`);
      if (!countResult || countResult.length === 0) {
        return this.fallback.profileTable(customerId, source, database, schema, table);
      }

      const totalRows = Number(countResult[0].cnt ?? countResult[0].CNT ?? 0);

      const columns: ColumnProfile[] = [];
      for (const col of tableSchema.columns) {
        const nullResult = await this.warehouse.executeQuery(
          `SELECT COUNT(*) AS null_count FROM ${fqn} WHERE ${col.name} IS NULL`,
        );
        const nullCount = Number(nullResult[0]?.null_count ?? nullResult[0]?.NULL_COUNT ?? 0);

        const distinctResult = await this.warehouse.executeQuery(
          `SELECT COUNT(DISTINCT ${col.name}) AS distinct_count FROM ${fqn}`,
        );
        const distinctCount = Number(distinctResult[0]?.distinct_count ?? distinctResult[0]?.DISTINCT_COUNT ?? 0);

        columns.push({
          name: col.name,
          type: col.type,
          nullable: col.nullable,
          totalRows,
          nullCount,
          nullRate: totalRows > 0 ? Math.round((nullCount / totalRows) * 10000) / 10000 : 0,
          distinctCount,
          distinctRatio: totalRows > 0 ? Math.round((distinctCount / totalRows) * 10000) / 10000 : 0,
        });
      }

      const freshnessHours = (Date.now() - tableSchema.updatedAt) / (1000 * 60 * 60);

      return {
        totalRows,
        columns,
        freshnessHours: Math.round(freshnessHours * 100) / 100,
        profiledAt: Date.now(),
      };
    } catch {
      // SQL execution not supported or failed — fall back to schema-based profiling
      return this.fallback.profileTable(customerId, source, database, schema, table);
    }
  }
}
