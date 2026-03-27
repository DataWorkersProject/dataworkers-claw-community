/**
 * In-memory warehouse connector stub for development and testing.
 * Simulates INFORMATION_SCHEMA queries against an in-memory table catalog.
 */

export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
}

export interface TableSchema {
  columns: ColumnDef[];
  updatedAt: number;
}

export type AlterationType =
  | { action: 'add_column'; column: ColumnDef }
  | { action: 'remove_column'; columnName: string }
  | { action: 'rename_column'; oldName: string; newName: string }
  | { action: 'change_type'; columnName: string; newType: string };

import type { IWarehouseConnector } from './interfaces/index.js';

export class InMemoryWarehouseConnector implements IWarehouseConnector {
  private tables: Map<string, TableSchema> = new Map();

  /**
   * Build a fully-qualified table key.
   */
  private buildKey(customerId: string, source: string, database: string, schema: string, table: string): string {
    return `${customerId}:${source}:${database}.${schema}.${table}`;
  }

  /**
   * Retrieve the current schema for a table. Returns undefined if the table does not exist.
   */
  async getTableSchema(customerId: string, source: string, database: string, schema: string, table: string): Promise<TableSchema | undefined> {
    const key = this.buildKey(customerId, source, database, schema, table);
    return this.tables.get(key);
  }

  /**
   * List available tables, optionally filtered by database and/or schema.
   */
  async listTables(customerId: string, source: string, database?: string, schema?: string): Promise<string[]> {
    const prefix = `${customerId}:${source}:`;
    const results: string[] = [];
    for (const key of this.tables.keys()) {
      if (!key.startsWith(prefix)) continue;
      const fqn = key.slice(prefix.length); // database.schema.table
      if (database) {
        if (!fqn.startsWith(`${database}.`)) continue;
        if (schema && !fqn.startsWith(`${database}.${schema}.`)) continue;
      }
      results.push(fqn);
    }
    return results;
  }

  /**
   * Simulate an ALTER TABLE operation.
   */
  async alterTable(customerId: string, source: string, database: string, schema: string, table: string, alteration: AlterationType): Promise<void> {
    const key = this.buildKey(customerId, source, database, schema, table);
    const existing = this.tables.get(key);
    if (!existing) {
      throw new Error(`Table not found: ${database}.${schema}.${table}`);
    }

    const columns = [...existing.columns];

    switch (alteration.action) {
      case 'add_column':
        columns.push(alteration.column);
        break;
      case 'remove_column': {
        const idx = columns.findIndex(c => c.name.toLowerCase() === alteration.columnName.toLowerCase());
        if (idx === -1) throw new Error(`Column not found: ${alteration.columnName}`);
        columns.splice(idx, 1);
        break;
      }
      case 'rename_column': {
        const col = columns.find(c => c.name.toLowerCase() === alteration.oldName.toLowerCase());
        if (!col) throw new Error(`Column not found: ${alteration.oldName}`);
        col.name = alteration.newName;
        break;
      }
      case 'change_type': {
        const col = columns.find(c => c.name.toLowerCase() === alteration.columnName.toLowerCase());
        if (!col) throw new Error(`Column not found: ${alteration.columnName}`);
        col.type = alteration.newType;
        break;
      }
    }

    this.tables.set(key, { columns, updatedAt: Date.now() });
  }

  /**
   * Execute a raw SQL query against the in-memory warehouse.
   * Returns synthetic rows based on the referenced table's schema.
   * In a real adapter this would proxy to the warehouse's SQL engine.
   */
  async executeQuery(sql: string, _params?: unknown[]): Promise<Record<string, unknown>[]> {
    // Parse a simple SELECT ... FROM database.schema.table pattern
    const fromMatch = sql.match(/FROM\s+(?:(\w+)\.(\w+)\.)?(\w+)/i);
    if (!fromMatch) {
      return [];
    }
    // Try to find the table in the in-memory store
    const tableName = fromMatch[3];
    for (const [key, schema] of this.tables.entries()) {
      if (key.endsWith(`.${tableName}`)) {
        // Return a single synthetic row with column names
        const row: Record<string, unknown> = {};
        for (const col of schema.columns) {
          row[col.name] = col.type.startsWith('VARCHAR') ? `sample_${col.name}` :
            col.type === 'INTEGER' ? 1 :
            col.type === 'TIMESTAMP' ? new Date().toISOString() :
            col.type.startsWith('DECIMAL') ? 0.0 : null;
        }
        return [row];
      }
    }
    return [];
  }

  /**
   * Pre-load the connector with seed table schemas.
   * Tables are seeded for customerId 'cust-1', source 'snowflake', database 'analytics', schema 'public'.
   */
  seed(): void {
    const customerId = 'cust-1';
    const source = 'snowflake';
    const database = 'analytics';
    const schema = 'public';
    const now = Date.now();

    const seedTables: Array<{ name: string; columns: ColumnDef[] }> = [
      {
        name: 'orders',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false },
          { name: 'customer_id', type: 'INTEGER', nullable: false },
          { name: 'total_amount', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
          { name: 'status', type: 'VARCHAR(50)', nullable: false },
        ],
      },
      {
        name: 'customers',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false },
          { name: 'name', type: 'VARCHAR(255)', nullable: false },
          { name: 'email', type: 'VARCHAR(255)', nullable: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
        ],
      },
      {
        name: 'products',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false },
          { name: 'name', type: 'VARCHAR(255)', nullable: false },
          { name: 'price', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'category', type: 'VARCHAR(100)', nullable: false },
        ],
      },
      {
        name: 'user_events',
        columns: [
          { name: 'event_id', type: 'VARCHAR(36)', nullable: false },
          { name: 'user_id', type: 'INTEGER', nullable: false },
          { name: 'event_type', type: 'VARCHAR(100)', nullable: false },
          { name: 'timestamp', type: 'TIMESTAMP', nullable: false },
          { name: 'properties', type: 'JSONB', nullable: true },
        ],
      },
    ];

    for (const t of seedTables) {
      const key = this.buildKey(customerId, source, database, schema, t.name);
      this.tables.set(key, { columns: t.columns, updatedAt: now });
    }

    // Seed same tables for test-customer-1 (used by eval tests)
    const testCustomerId = 'test-customer-1';
    for (const t of seedTables) {
      const key = this.buildKey(testCustomerId, source, database, schema, t.name);
      this.tables.set(key, { columns: t.columns, updatedAt: now });
    }
  }
}
