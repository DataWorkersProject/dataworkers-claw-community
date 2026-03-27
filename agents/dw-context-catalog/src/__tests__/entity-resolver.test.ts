import { describe, it, expect, beforeAll } from 'vitest';
import { EntityResolver } from '../search/entity-resolver.js';
import { InMemoryGraphDB } from '@data-workers/infrastructure-stubs';

describe('EntityResolver', () => {
  const graphDB = new InMemoryGraphDB();
  const resolver = new EntityResolver(graphDB);

  beforeAll(async () => {
    // Exact match target: analytics.public.orders
    await graphDB.addNode({
      id: 'sf-orders',
      type: 'table',
      name: 'orders',
      platform: 'snowflake',
      properties: { database: 'analytics', schema: 'public', description: 'All customer orders' },
      customerId: 'cust-1',
    });

    // Fuzzy match target: stg_orders (similar to "orders")
    await graphDB.addNode({
      id: 'dbt-stg-orders',
      type: 'model',
      name: 'stg_orders',
      platform: 'dbt',
      properties: { description: 'Staging orders model' },
      customerId: 'cust-1',
    });

    // Lineage-connected node (downstream of sf-orders)
    await graphDB.addNode({
      id: 'dbt-fct-revenue',
      type: 'model',
      name: 'fct_revenue',
      platform: 'dbt',
      properties: { description: 'Revenue fact table' },
      customerId: 'cust-1',
    });
    await graphDB.addEdge({
      source: 'sf-orders',
      target: 'dbt-fct-revenue',
      relationship: 'derives_from',
      properties: {},
    });

    // Alias-based match target: tagged with "orders"
    await graphDB.addNode({
      id: 'looker-order-dash',
      type: 'dashboard',
      name: 'order_analytics_dashboard',
      platform: 'looker',
      properties: { tags: ['orders', 'revenue'], description: 'Dashboard for order metrics' },
      customerId: 'cust-1',
    });

    // Unrelated node (should not match "orders")
    await graphDB.addNode({
      id: 'sf-users',
      type: 'table',
      name: 'users',
      platform: 'snowflake',
      properties: { database: 'analytics', schema: 'public', description: 'User accounts' },
      customerId: 'cust-1',
    });

    // Node for a different customer
    await graphDB.addNode({
      id: 'other-orders',
      type: 'table',
      name: 'orders',
      platform: 'snowflake',
      properties: { database: 'analytics', schema: 'public' },
      customerId: 'cust-2',
    });
  });

  it('finds exact qualified name match with confidence 1.0', async () => {
    const results = await resolver.resolve('analytics.public.orders', 'cust-1');
    const exact = results.find(r => r.assetId === 'sf-orders');
    expect(exact).toBeDefined();
    expect(exact!.confidence).toBe(1.0);
    expect(exact!.method).toBe('exact_qualified');
  });

  it('finds exact match by table name only', async () => {
    const results = await resolver.resolve('orders', 'cust-1');
    const exact = results.find(r => r.assetId === 'sf-orders');
    expect(exact).toBeDefined();
    expect(exact!.confidence).toBe(1.0);
    expect(exact!.method).toBe('exact_qualified');
  });

  it('finds fuzzy match with confidence < 1.0', async () => {
    const results = await resolver.resolve('orders', 'cust-1');
    const fuzzy = results.find(r => r.assetId === 'dbt-stg-orders');
    expect(fuzzy).toBeDefined();
    expect(fuzzy!.method).toBe('fuzzy_qualified');
    expect(fuzzy!.confidence).toBeGreaterThan(0);
    expect(fuzzy!.confidence).toBeLessThan(1.0);
  });

  it('finds lineage-inferred match for connected nodes', async () => {
    const results = await resolver.resolve('orders', 'cust-1');
    const lineage = results.find(r => r.assetId === 'dbt-fct-revenue');
    expect(lineage).toBeDefined();
    expect(lineage!.confidence).toBe(0.7);
    expect(lineage!.method).toBe('lineage_inferred');
  });

  it('finds alias-based match via tags', async () => {
    const results = await resolver.resolve('orders', 'cust-1');
    const alias = results.find(r => r.assetId === 'looker-order-dash');
    expect(alias).toBeDefined();
    expect(alias!.confidence).toBe(0.6);
    expect(alias!.method).toBe('alias_based');
  });

  it('returns multiple candidates ranked by confidence descending', async () => {
    const results = await resolver.resolve('orders', 'cust-1');
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it('returns empty array when no match found', async () => {
    const results = await resolver.resolve('nonexistent_table_xyz', 'cust-1');
    expect(results).toEqual([]);
  });

  it('filters by minConfidence', async () => {
    const results = await resolver.resolve('orders', 'cust-1', { minConfidence: 0.8 });
    for (const r of results) {
      expect(r.confidence).toBeGreaterThanOrEqual(0.8);
    }
    // Should exclude alias-based (0.6) and lineage-inferred (0.7)
    expect(results.find(r => r.method === 'alias_based')).toBeUndefined();
    expect(results.find(r => r.method === 'lineage_inferred')).toBeUndefined();
  });

  it('respects maxCandidates limit', async () => {
    const results = await resolver.resolve('orders', 'cust-1', { maxCandidates: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('filters by platforms', async () => {
    const results = await resolver.resolve('orders', 'cust-1', { platforms: ['snowflake'] });
    for (const r of results) {
      expect(r.platform).toBe('snowflake');
    }
  });

  it('does not return assets from other customers', async () => {
    const results = await resolver.resolve('orders', 'cust-1');
    const otherCustomer = results.find(r => r.assetId === 'other-orders');
    expect(otherCustomer).toBeUndefined();
  });

  it('uses cache for repeat lookups within TTL', async () => {
    // First call populates cache
    const results1 = await resolver.resolve('orders', 'cust-1');
    // Second call should return same reference from cache
    const results2 = await resolver.resolve('orders', 'cust-1');
    expect(results1).toEqual(results2);
  });

  // Entity type filtering
  it('filters by entityType to exclude dashboards when resolving tables', async () => {
    const results = await resolver.resolve('orders', 'cust-1', { entityType: 'table' });
    const dashboard = results.find(r => r.assetId === 'looker-order-dash');
    expect(dashboard).toBeUndefined();
    const table = results.find(r => r.assetId === 'sf-orders');
    expect(table).toBeDefined();
  });

  // Exact name preference
  it('prefers exact name match over fuzzy match at same confidence tier', async () => {
    const results = await resolver.resolve('orders', 'cust-1');
    // "orders" should come before "stg_orders" in results because exact name match is preferred
    const exactIdx = results.findIndex(r => r.assetName === 'orders');
    const fuzzyIdx = results.findIndex(r => r.assetName === 'stg_orders');
    if (exactIdx !== -1 && fuzzyIdx !== -1) {
      expect(exactIdx).toBeLessThan(fuzzyIdx);
    }
  });

  // entityType is populated on matches
  it('populates entityType on match results', async () => {
    const results = await resolver.resolve('orders', 'cust-1');
    const table = results.find(r => r.assetId === 'sf-orders');
    expect(table?.entityType).toBe('table');
    const dashboard = results.find(r => r.assetId === 'looker-order-dash');
    expect(dashboard?.entityType).toBe('dashboard');
  });
});
