import { describe, it, expect } from 'vitest';
import { InMemoryWarehouseConnector } from '../warehouse-connector.js';

describe('InMemoryWarehouseConnector', () => {
  it('getTableSchema returns undefined for nonexistent table', async () => {
    const wh = new InMemoryWarehouseConnector();
    expect(await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'missing')).toBeUndefined();
  });

  it('seed populates tables, getTableSchema works after seed', async () => {
    const wh = new InMemoryWarehouseConnector();
    wh.seed();
    const schema = await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders');
    expect(schema).toBeDefined();
    expect(schema!.columns.length).toBeGreaterThan(0);
    expect(schema!.columns.find(c => c.name === 'id')).toBeDefined();
  });

  it('listTables returns seeded tables', async () => {
    const wh = new InMemoryWarehouseConnector();
    wh.seed();
    const tables = await wh.listTables('cust-1', 'snowflake');
    expect(tables.length).toBeGreaterThanOrEqual(4);
  });

  it('listTables filters by database and schema', async () => {
    const wh = new InMemoryWarehouseConnector();
    wh.seed();
    const tables = await wh.listTables('cust-1', 'snowflake', 'analytics', 'public');
    expect(tables.length).toBeGreaterThanOrEqual(1);
    for (const t of tables) {
      expect(t.startsWith('analytics.public.')).toBe(true);
    }
  });

  it('alterTable add_column adds a column', async () => {
    const wh = new InMemoryWarehouseConnector();
    wh.seed();
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'add_column',
      column: { name: 'discount', type: 'DECIMAL(5,2)', nullable: true },
    });
    const schema = (await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders'))!;
    expect(schema.columns.find(c => c.name === 'discount')).toBeDefined();
  });

  it('alterTable remove_column removes a column', async () => {
    const wh = new InMemoryWarehouseConnector();
    wh.seed();
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'remove_column',
      columnName: 'status',
    });
    const schema = (await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders'))!;
    expect(schema.columns.find(c => c.name === 'status')).toBeUndefined();
  });

  it('alterTable rename_column renames a column', async () => {
    const wh = new InMemoryWarehouseConnector();
    wh.seed();
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'rename_column',
      oldName: 'status',
      newName: 'order_status',
    });
    const schema = (await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders'))!;
    expect(schema.columns.find(c => c.name === 'order_status')).toBeDefined();
    expect(schema.columns.find(c => c.name === 'status')).toBeUndefined();
  });

  it('alterTable change_type changes column type', async () => {
    const wh = new InMemoryWarehouseConnector();
    wh.seed();
    await wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'orders', {
      action: 'change_type',
      columnName: 'total_amount',
      newType: 'DECIMAL(15,4)',
    });
    const schema = (await wh.getTableSchema('cust-1', 'snowflake', 'analytics', 'public', 'orders'))!;
    const col = schema.columns.find(c => c.name === 'total_amount');
    expect(col!.type).toBe('DECIMAL(15,4)');
  });

  it('listTables isolates by customerId', async () => {
    const wh = new InMemoryWarehouseConnector();
    wh.seed();
    const tables = await wh.listTables('cust-2', 'snowflake');
    expect(tables).toHaveLength(0);
  });

  it('alterTable throws for nonexistent table', async () => {
    const wh = new InMemoryWarehouseConnector();
    await expect(
      wh.alterTable('cust-1', 'snowflake', 'analytics', 'public', 'nonexistent', {
        action: 'add_column',
        column: { name: 'col', type: 'TEXT', nullable: true },
      })
    ).rejects.toThrow('Table not found');
  });
});
