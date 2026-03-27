/**
 * Data Profiler — computes quality metrics from warehouse table schemas.
 *
 * Uses InMemoryWarehouseConnector to inspect column definitions and
 * derives deterministic-but-realistic profiling metrics based on
 * column types and nullability. This simulates what a real SQL PROFILE
 * query would return.
 */

import type { IWarehouseConnector } from '@data-workers/infrastructure-stubs';

/** Profile result for a single column. */
export interface ColumnProfile {
  name: string;
  type: string;
  nullable: boolean;
  totalRows: number;
  nullCount: number;
  nullRate: number;
  distinctCount: number;
  distinctRatio: number;
}

/** Profile result for an entire table. */
export interface ProfileResult {
  totalRows: number;
  columns: ColumnProfile[];
  freshnessHours: number;
  profiledAt: number;
}

/**
 * Deterministic hash for generating synthetic-but-stable profile values.
 * Uses a simple string hash so the same column always returns the same metrics.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export class DataProfiler {
  private warehouse: IWarehouseConnector;

  constructor(warehouse: IWarehouseConnector) {
    this.warehouse = warehouse;
  }

  /**
   * Profile a table by inspecting its schema and generating deterministic metrics.
   * Returns null if the table does not exist.
   */
  async profileTable(
    customerId: string,
    source: string,
    database: string,
    schema: string,
    table: string,
  ): Promise<ProfileResult | null> {
    const tableSchema = await this.warehouse.getTableSchema(customerId, source, database, schema, table);
    if (!tableSchema) {
      return null;
    }

    // Deterministic row count based on table name
    const tableHash = simpleHash(`${database}.${schema}.${table}`);
    const totalRows = 100000 + (tableHash % 100000);

    const columns: ColumnProfile[] = tableSchema.columns.map((col) => {
      const colHash = simpleHash(`${table}.${col.name}`);

      // Nullable columns get synthetic null counts; non-nullable get 0
      let nullCount = 0;
      if (col.nullable) {
        // Nullable columns: 1-15% null rate based on column hash
        const nullRate = 0.01 + (colHash % 15) / 100;
        nullCount = Math.round(totalRows * nullRate);
      }

      const nullRate = nullCount / totalRows;

      // Distinct count: PKs (id columns) are fully unique, others vary
      const isIdColumn = col.name.toLowerCase() === 'id' ||
        col.name.toLowerCase().endsWith('_id') ||
        col.name.toLowerCase() === 'event_id';
      let distinctCount: number;
      if (isIdColumn) {
        distinctCount = totalRows - nullCount;
      } else if (col.type.startsWith('VARCHAR')) {
        distinctCount = Math.round((totalRows - nullCount) * (0.3 + (colHash % 50) / 100));
      } else if (col.type === 'TIMESTAMP') {
        distinctCount = Math.round((totalRows - nullCount) * (0.8 + (colHash % 20) / 100));
      } else {
        distinctCount = Math.round((totalRows - nullCount) * (0.5 + (colHash % 40) / 100));
      }

      const distinctRatio = totalRows > 0 ? distinctCount / totalRows : 0;

      return {
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        totalRows,
        nullCount,
        nullRate: Math.round(nullRate * 10000) / 10000,
        distinctCount,
        distinctRatio: Math.round(distinctRatio * 10000) / 10000,
      };
    });

    // Freshness: derive from schema updatedAt
    const freshnessHours = (Date.now() - tableSchema.updatedAt) / (1000 * 60 * 60);

    return {
      totalRows,
      columns,
      freshnessHours: Math.round(freshnessHours * 100) / 100,
      profiledAt: Date.now(),
    };
  }
}
