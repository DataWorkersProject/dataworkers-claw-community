import { describe, it, expect } from 'vitest';
import { InMemoryRelationalStore } from '../relational-store.js';

describe('InMemoryRelationalStore', () => {
  it('createTable and insert', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('users');
    await store.insert('users', { id: 1, name: 'Alice' });
    const rows = await store.query('users');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alice');
  });

  it('insert to nonexistent table throws', async () => {
    const store = new InMemoryRelationalStore();
    await expect(store.insert('missing', { id: 1 })).rejects.toThrow("Table 'missing' does not exist");
  });

  it('createTable is idempotent', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('users');
    await store.insert('users', { id: 1 });
    await store.createTable('users'); // no-op
    expect(await store.query('users')).toHaveLength(1);
  });

  it('query with filter', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('users');
    await store.insert('users', { id: 1, role: 'admin' });
    await store.insert('users', { id: 2, role: 'user' });
    await store.insert('users', { id: 3, role: 'admin' });
    const admins = await store.query('users', (r) => r.role === 'admin');
    expect(admins).toHaveLength(2);
  });

  it('query with orderBy ascending', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('items');
    await store.insert('items', { name: 'c', price: 30 });
    await store.insert('items', { name: 'a', price: 10 });
    await store.insert('items', { name: 'b', price: 20 });
    const sorted = await store.query('items', undefined, { column: 'price', direction: 'asc' });
    expect(sorted[0].price).toBe(10);
    expect(sorted[2].price).toBe(30);
  });

  it('query with orderBy descending', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('items');
    await store.insert('items', { price: 10 });
    await store.insert('items', { price: 30 });
    await store.insert('items', { price: 20 });
    const sorted = await store.query('items', undefined, { column: 'price', direction: 'desc' });
    expect(sorted[0].price).toBe(30);
  });

  it('query with limit', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('items');
    for (let i = 0; i < 10; i++) await store.insert('items', { id: i });
    expect(await store.query('items', undefined, undefined, 3)).toHaveLength(3);
  });

  it('query nonexistent table returns empty', async () => {
    const store = new InMemoryRelationalStore();
    expect(await store.query('missing')).toEqual([]);
  });

  it('count rows', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('users');
    await store.insert('users', { id: 1 });
    await store.insert('users', { id: 2 });
    expect(await store.count('users')).toBe(2);
  });

  it('count with filter', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('users');
    await store.insert('users', { active: true });
    await store.insert('users', { active: false });
    await store.insert('users', { active: true });
    expect(await store.count('users', (r) => r.active === true)).toBe(2);
  });

  it('aggregate sum', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('orders');
    await store.insert('orders', { amount: 10 });
    await store.insert('orders', { amount: 20 });
    await store.insert('orders', { amount: 30 });
    expect(await store.aggregate('orders', 'amount', 'sum')).toBe(60);
  });

  it('aggregate avg', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('orders');
    await store.insert('orders', { amount: 10 });
    await store.insert('orders', { amount: 20 });
    await store.insert('orders', { amount: 30 });
    expect(await store.aggregate('orders', 'amount', 'avg')).toBe(20);
  });

  it('aggregate min and max', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('orders');
    await store.insert('orders', { amount: 10 });
    await store.insert('orders', { amount: 50 });
    await store.insert('orders', { amount: 30 });
    expect(await store.aggregate('orders', 'amount', 'min')).toBe(10);
    expect(await store.aggregate('orders', 'amount', 'max')).toBe(50);
  });

  it('aggregate count_distinct', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('orders');
    await store.insert('orders', { status: 'active' });
    await store.insert('orders', { status: 'active' });
    await store.insert('orders', { status: 'closed' });
    expect(await store.aggregate('orders', 'status', 'count_distinct')).toBe(2);
  });

  it('clear removes all rows but keeps table', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('users');
    await store.insert('users', { id: 1 });
    await store.clear('users');
    expect(await store.count('users')).toBe(0);
    // Table still exists — can insert again
    await store.insert('users', { id: 2 });
    expect(await store.count('users')).toBe(1);
  });

  it('seed populates quality_metrics with 14 days of data', async () => {
    const store = new InMemoryRelationalStore();
    store.seed();
    // 14 days × 4 metrics = 56 rows
    expect(await store.count('quality_metrics')).toBe(56);
  });

  it('inserted rows are copies (not references)', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('users');
    const row = { id: 1, name: 'Alice' };
    await store.insert('users', row);
    row.name = 'Bob'; // mutate original
    expect((await store.query('users'))[0].name).toBe('Alice'); // should be unchanged
  });
});
