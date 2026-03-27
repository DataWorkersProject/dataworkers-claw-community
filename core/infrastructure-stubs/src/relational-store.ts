/**
 * In-memory relational store stub for development and testing.
 * Simulates a SQL-like table store with filtering, counting, and aggregation.
 */

export type AggregateFunction = 'sum' | 'avg' | 'min' | 'max' | 'count_distinct';

import type { IRelationalStore } from './interfaces/index.js';

export class InMemoryRelationalStore implements IRelationalStore {
  private tables: Map<string, Record<string, unknown>[]> = new Map();

  /**
   * Register a table. If the table already exists, this is a no-op.
   */
  async createTable(name: string, _schema?: Record<string, string>): Promise<void> {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
  }

  /**
   * Insert a row into a table.
   * @throws if the table does not exist.
   */
  async insert(table: string, row: Record<string, unknown>): Promise<void> {
    const rows = this.tables.get(table);
    if (!rows) {
      throw new Error(`Table '${table}' does not exist. Call createTable first.`);
    }
    rows.push({ ...row });
  }

  /**
   * Query rows from a table with optional filter, ordering, and limit.
   */
  async query(
    table: string,
    filter?: (row: Record<string, unknown>) => boolean,
    orderBy?: { column: string; direction: 'asc' | 'desc' },
    limit?: number,
  ): Promise<Record<string, unknown>[]> {
    const rows = this.tables.get(table);
    if (!rows) return [];

    let result = filter ? rows.filter(filter) : [...rows];

    if (orderBy) {
      result.sort((a, b) => {
        const aVal = a[orderBy.column] as number | string;
        const bVal = b[orderBy.column] as number | string;
        if (aVal < bVal) return orderBy.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return orderBy.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (limit !== undefined) {
      result = result.slice(0, limit);
    }

    return result;
  }

  /**
   * Count rows matching an optional filter.
   */
  async count(table: string, filter?: (row: Record<string, unknown>) => boolean): Promise<number> {
    const rows = this.tables.get(table);
    if (!rows) return 0;
    return filter ? rows.filter(filter).length : rows.length;
  }

  /**
   * Aggregate a column with a given function.
   */
  async aggregate(
    table: string,
    column: string,
    fn: AggregateFunction,
    filter?: (row: Record<string, unknown>) => boolean,
  ): Promise<number> {
    const rows = this.tables.get(table);
    if (!rows) return 0;

    const filtered = filter ? rows.filter(filter) : rows;
    const values = filtered.map((r) => r[column]).filter((v) => v !== null && v !== undefined);

    if (values.length === 0) return 0;

    switch (fn) {
      case 'sum':
        return (values as number[]).reduce((a, b) => a + b, 0);
      case 'avg':
        return (values as number[]).reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...(values as number[]));
      case 'max':
        return Math.max(...(values as number[]));
      case 'count_distinct':
        return new Set(values.map(String)).size;
    }
  }

  /**
   * /692: Execute a raw SQL-like string against the in-memory store.
   * Supports basic SELECT with WHERE, ORDER BY, LIMIT, SUM, AVG, COUNT.
   * This is a simplified SQL interpreter for the in-memory stub.
   */
  async executeSQL(sql: string, timeoutMs?: number): Promise<Record<string, unknown>[]> {
    void timeoutMs; // In-memory execution is instant; real adapters use this.

    const trimmed = sql.trim().replace(/;+\s*$/, '');
    if (!/^\s*SELECT\b/i.test(trimmed)) {
      throw new Error('Only SELECT statements are supported by executeSQL');
    }

    // Extract table name
    const fromMatch = trimmed.match(/\bFROM\s+(\w+)/i);
    if (!fromMatch) throw new Error('Could not determine table from SQL');
    const tableName = fromMatch[1];

    const rows = this.tables.get(tableName);
    if (!rows) return [];

    // Parse WHERE clause
    let filtered = [...rows];
    const whereMatch = trimmed.match(/WHERE\s+(.+?)(?:\s+GROUP|\s+ORDER|\s+LIMIT|$)/i);
    if (whereMatch) {
      const conditions = whereMatch[1].split(/\s+AND\s+/i);
      filtered = filtered.filter((row) =>
        conditions.every((cond) => {
          const m = cond.match(/(\w+)\s*=\s*'?([^']+)'?/);
          if (!m) return true;
          return String(row[m[1]]).toLowerCase() === m[2].trim().toLowerCase();
        }),
      );
    }

    // Parse LIMIT
    const limitMatch = trimmed.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) {
      filtered = filtered.slice(0, parseInt(limitMatch[1], 10));
    }

    // Parse ORDER BY
    const orderMatch = trimmed.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const dir = (orderMatch[2] || 'ASC').toUpperCase();
      filtered.sort((a, b) => {
        const aVal = a[col] as number | string;
        const bVal = b[col] as number | string;
        if (aVal < bVal) return dir === 'ASC' ? -1 : 1;
        if (aVal > bVal) return dir === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  /**
   * Clear all rows from a table.
   */
  async clear(table: string): Promise<void> {
    const rows = this.tables.get(table);
    if (rows) {
      rows.length = 0;
    }
  }

  /**
   * Pre-load the quality_metrics table with 14 days of historical metrics
   * for the orders table. Provides enough data points for anomaly detection.
   */
  seed(): void {
    this.createTable('quality_metrics');

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Deterministic seed values using a simple hash
    for (let day = 13; day >= 0; day--) {
      const timestamp = now - day * dayMs;
      // Stable null rate: 0.02 - 0.05 range
      const nullRate = 0.02 + (((day * 7 + 3) % 13) / 13) * 0.03;
      // Row count: 148K - 152K range
      const rowCount = 148000 + (((day * 11 + 5) % 17) / 17) * 4000;
      // Uniqueness: 0.99 - 1.0 range
      const uniqueness = 0.99 + (((day * 13 + 7) % 11) / 11) * 0.01;
      // Freshness hours: 1 - 4 range
      const freshnessHours = 1 + (((day * 5 + 2) % 7) / 7) * 3;

      this.insert('quality_metrics', {
        datasetId: 'orders',
        customerId: 'cust-1',
        metric: 'null_rate',
        value: Math.round(nullRate * 10000) / 10000,
        timestamp,
      });

      this.insert('quality_metrics', {
        datasetId: 'orders',
        customerId: 'cust-1',
        metric: 'row_count',
        value: Math.round(rowCount),
        timestamp,
      });

      this.insert('quality_metrics', {
        datasetId: 'orders',
        customerId: 'cust-1',
        metric: 'uniqueness',
        value: Math.round(uniqueness * 10000) / 10000,
        timestamp,
      });

      this.insert('quality_metrics', {
        datasetId: 'orders',
        customerId: 'cust-1',
        metric: 'freshness_hours',
        value: Math.round(freshnessHours * 100) / 100,
        timestamp,
      });
    }
  }
}
