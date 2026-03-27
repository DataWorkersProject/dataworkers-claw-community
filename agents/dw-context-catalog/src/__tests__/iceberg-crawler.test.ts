import { describe, it, expect, beforeEach } from 'vitest';
import { IcebergCrawler } from '../crawlers/iceberg-crawler.js';
import { IcebergConnector } from '@data-workers/iceberg-connector';

describe('IcebergCrawler', () => {
  let connector: IcebergConnector;
  let crawler: IcebergCrawler;

  beforeEach(() => {
    connector = new IcebergConnector();
    crawler = new IcebergCrawler(
      {
        platform: 'iceberg',
        connectionId: 'iceberg-test',
        customerId: 'cust-1',
        endpoint: 'http://localhost:8181',
      },
      connector,
    );
  });

  describe('crawl()', () => {
    it('discovers all tables from the REST catalog', async () => {
      const result = await crawler.crawl();

      expect(result.assetsDiscovered).toBe(4); // orders, customers, events, products
      expect(result.assetsNew).toBe(4);
      expect(result.errors).toHaveLength(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('discovers tables across all namespaces', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      // All tables should come from the analytics namespace
      const ids = assets.map((a) => a.id);
      expect(ids).toContain('iceberg:analytics.orders');
      expect(ids).toContain('iceberg:analytics.customers');
      expect(ids).toContain('iceberg:analytics.events');
      expect(ids).toContain('iceberg:analytics.products');
    });
  });

  describe('metadata extraction', () => {
    it('extracts schema columns from table metadata', async () => {
      // Connect so extractAssets works
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      const orders = assets.find((a) => a.id === 'iceberg:analytics.orders')!;
      expect(orders).toBeDefined();
      expect(orders.columns).toBeDefined();
      expect(orders.columns!.length).toBe(6);

      const colNames = orders.columns!.map((c) => c.name);
      expect(colNames).toContain('order_id');
      expect(colNames).toContain('customer_id');
      expect(colNames).toContain('order_date');
      expect(colNames).toContain('total_amount');
      expect(colNames).toContain('status');
      expect(colNames).toContain('created_at');
    });

    it('extracts partition spec in metadata', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      const orders = assets.find((a) => a.id === 'iceberg:analytics.orders')!;
      const partitionSpec = orders.metadata.partitionSpec as any;
      expect(partitionSpec).toBeDefined();
      expect(partitionSpec.fields).toHaveLength(1);
      expect(partitionSpec.fields[0].transform).toBe('day');
    });

    it('extracts sort order in metadata', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      const orders = assets.find((a) => a.id === 'iceberg:analytics.orders')!;
      const sortOrder = orders.metadata.sortOrder as any;
      expect(sortOrder).toBeDefined();
      expect(sortOrder.fields).toHaveLength(1);
      expect(sortOrder.fields[0].direction).toBe('desc');
    });

    it('extracts snapshot count and total size', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      const orders = assets.find((a) => a.id === 'iceberg:analytics.orders')!;
      expect(orders.metadata.snapshotCount).toBe(5);
      expect(orders.metadata.totalSize).toBeGreaterThan(0);
      expect(orders.metadata.currentSnapshotId).toBeDefined();
    });
  });

  describe('freshness tracking', () => {
    it('computes freshness from latest snapshot timestamp', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      // All seeded tables have recent snapshots (within 30 days)
      for (const asset of assets) {
        expect(asset.freshnessScore).toBeGreaterThan(0);
        expect(asset.lastUpdated).toBeGreaterThan(0);
      }
    });

    it('sets lastUpdated from the current snapshot timestamp', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      const orders = assets.find((a) => a.id === 'iceberg:analytics.orders')!;
      // lastUpdated should be a recent timestamp (within 30 days of now)
      const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
      expect(orders.lastUpdated).toBeGreaterThan(thirtyDaysAgo);
    });
  });

  describe('classification', () => {
    it('classifies assets with domain tags', async () => {
      const result = await crawler.crawl();
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      // orders should get 'finance' tag
      const orders = assets.find((a) => a.name === 'orders')!;
      const orderTags = crawler.classifyAsset(orders);
      expect(orderTags).toContain('finance');
      expect(orderTags).toContain('analytics');
    });

    it('classifies customer tables with sensitivity tags', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      const customers = assets.find((a) => a.name === 'customers')!;
      const tags = crawler.classifyAsset(customers);
      expect(tags).toContain('customer');
      // customers table has email and name columns -> PII
      expect(tags).toContain('pii');
      expect(tags).toContain('sensitive');
    });

    it('classifies events table with product tag', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      const events = assets.find((a) => a.name === 'events')!;
      const tags = crawler.classifyAsset(events);
      expect(tags).toContain('analytics');
    });
  });

  describe('asset format', () => {
    it('produces assets with correct id format', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      for (const asset of assets) {
        expect(asset.id).toMatch(/^iceberg:/);
        expect(asset.platform).toBe('iceberg');
        expect(asset.type).toBe('table');
      }
    });

    it('sets customerId from config', async () => {
      connector.connect('http://localhost:8181');
      const assets = await crawler.extractAssets();

      for (const asset of assets) {
        expect(asset.customerId).toBe('cust-1');
      }
    });
  });
});
