import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryWarehouseConnector } from '@data-workers/infrastructure-stubs';
import { DataProfiler } from '../profiler.js';

describe('DataProfiler', () => {
  let warehouse: InMemoryWarehouseConnector;
  let profiler: DataProfiler;

  beforeEach(() => {
    warehouse = new InMemoryWarehouseConnector();
    warehouse.seed();
    profiler = new DataProfiler(warehouse);
  });

  it('profiles a seeded table and returns column profiles', async () => {
    const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(result).not.toBeNull();
    expect(result!.totalRows).toBeGreaterThan(0);
    expect(result!.columns).toHaveLength(5); // orders has 5 columns
    expect(result!.profiledAt).toBeGreaterThan(0);
  });

  it('returns null for unknown table', async () => {
    const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'nonexistent');
    expect(result).toBeNull();
  });

  it('computes null rate = 0 for non-nullable columns', async () => {
    const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(result).not.toBeNull();

    // All orders columns are non-nullable
    for (const col of result!.columns) {
      expect(col.nullRate).toBe(0);
      expect(col.nullCount).toBe(0);
    }
  });

  it('computes non-zero null rate for nullable columns', async () => {
    const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'user_events');
    expect(result).not.toBeNull();

    // user_events.properties is nullable
    const propertiesCol = result!.columns.find((c) => c.name === 'properties');
    expect(propertiesCol).toBeDefined();
    expect(propertiesCol!.nullable).toBe(true);
    expect(propertiesCol!.nullRate).toBeGreaterThan(0);
    expect(propertiesCol!.nullCount).toBeGreaterThan(0);
  });

  it('computes high uniqueness for ID columns', async () => {
    const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(result).not.toBeNull();

    const idCol = result!.columns.find((c) => c.name === 'id');
    expect(idCol).toBeDefined();
    expect(idCol!.distinctRatio).toBeGreaterThanOrEqual(0.99);

    const customerIdCol = result!.columns.find((c) => c.name === 'customer_id');
    expect(customerIdCol).toBeDefined();
    expect(customerIdCol!.distinctRatio).toBeGreaterThanOrEqual(0.99);
  });

  it('computes freshness based on schema updatedAt', async () => {
    const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(result).not.toBeNull();
    // Freshness should be very small since seed was just called
    expect(result!.freshnessHours).toBeGreaterThanOrEqual(0);
    expect(result!.freshnessHours).toBeLessThan(1); // Should be near 0 since just seeded
  });

  it('returns deterministic results for the same table', async () => {
    const result1 = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    const result2 = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1!.totalRows).toBe(result2!.totalRows);
    expect(result1!.columns.length).toBe(result2!.columns.length);
    for (let i = 0; i < result1!.columns.length; i++) {
      expect(result1!.columns[i].nullRate).toBe(result2!.columns[i].nullRate);
      expect(result1!.columns[i].distinctRatio).toBe(result2!.columns[i].distinctRatio);
    }
  });

  it('returns different profiles for different tables', async () => {
    const orders = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    const customers = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'customers');
    expect(orders).not.toBeNull();
    expect(customers).not.toBeNull();
    // Different tables have different row counts and column counts
    expect(orders!.columns.length).not.toBe(customers!.columns.length);
  });

  it('profiles all seeded tables without error', async () => {
    const tables = ['orders', 'customers', 'products', 'user_events'];
    for (const table of tables) {
      const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', table);
      expect(result).not.toBeNull();
      expect(result!.totalRows).toBeGreaterThan(0);
      expect(result!.profiledAt).toBeGreaterThan(0);
    }
  });

  it('returns correct column count for each table', async () => {
    const expectedCounts: Record<string, number> = {
      orders: 5,
      customers: 4,
      products: 4,
      user_events: 5,
    };

    for (const [table, expectedCount] of Object.entries(expectedCounts)) {
      const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', table);
      expect(result).not.toBeNull();
      expect(result!.columns).toHaveLength(expectedCount);
    }
  });

  it('handles table with all non-nullable columns', async () => {
    const result = await profiler.profileTable('cust-1', 'snowflake', 'analytics', 'public', 'products');
    expect(result).not.toBeNull();
    // products has 4 columns, all non-nullable
    expect(result!.columns).toHaveLength(4);
    for (const col of result!.columns) {
      expect(col.nullable).toBe(false);
      expect(col.nullRate).toBe(0);
      expect(col.nullCount).toBe(0);
    }
  });
});
