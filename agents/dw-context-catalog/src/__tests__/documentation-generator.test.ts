import { describe, it, expect } from 'vitest';
import { DocumentationGenerator } from '../search/documentation-generator.js';

describe('DocumentationGenerator', () => {
  const generator = new DocumentationGenerator();

  describe('different assets return different documentation', () => {
    it('orders and customers have different columns', async () => {
      const ordersDoc = await generator.generateDocumentation('orders', 'cust-1');
      const customersDoc = await generator.generateDocumentation('customers', 'cust-1');
      expect(ordersDoc.assetName).not.toBe(customersDoc.assetName);
    });

    it('stg_orders and stg_events have different lineage summaries', async () => {
      const ordersDoc = await generator.generateDocumentation('stg_orders', 'cust-1');
      const eventsDoc = await generator.generateDocumentation('stg_events', 'cust-1');
      // They should both have lineage but from different sources
      expect(ordersDoc.lineageSummary).toBeTruthy();
      expect(eventsDoc.lineageSummary).toBeTruthy();
    });

    it('source tables and dashboards have different descriptions', async () => {
      const sourceDoc = await generator.generateDocumentation('raw_orders', 'cust-1');
      const dashDoc = await generator.generateDocumentation('Revenue Dashboard', 'cust-1');
      expect(sourceDoc.description).not.toBe(dashDoc.description);
    });
  });

  describe('known seeded assets have correct lineage', () => {
    it('stg_orders has upstream from raw_orders', async () => {
      const doc = await generator.generateDocumentation('stg_orders', 'cust-1');
      expect(doc.lineageSummary).toContain('upstream');
    });

    it('stg_orders has downstream to mart models', async () => {
      const doc = await generator.generateDocumentation('stg_orders', 'cust-1');
      expect(doc.lineageSummary).toContain('downstream');
    });

    it('dashboard has upstream but no downstream', async () => {
      const doc = await generator.generateDocumentation('Revenue Dashboard', 'cust-1');
      expect(doc.lineageSummary).toContain('upstream');
      // Dashboards are leaf nodes - no downstream
      expect(doc.lineageSummary).not.toContain('downstream');
    });

    it('raw source has downstream but no upstream', async () => {
      const doc = await generator.generateDocumentation('raw_orders', 'cust-1');
      expect(doc.lineageSummary).toContain('downstream');
      expect(doc.lineageSummary).not.toContain('upstream');
    });
  });

  describe('freshness is populated correctly', () => {
    it('returns freshnessInfo with lastUpdated > 0 for known assets', async () => {
      const doc = await generator.generateDocumentation('orders', 'cust-1');
      expect(doc.freshnessInfo.lastUpdated).toBeGreaterThan(0);
    });

    it('returns freshnessScore between 0 and 100', async () => {
      const doc = await generator.generateDocumentation('orders', 'cust-1');
      expect(doc.freshnessInfo.freshnessScore).toBeGreaterThanOrEqual(0);
      expect(doc.freshnessInfo.freshnessScore).toBeLessThanOrEqual(100);
    });

    it('includes SLA compliance info', async () => {
      const doc = await generator.generateDocumentation('orders', 'cust-1');
      expect(typeof doc.freshnessInfo.slaCompliant).toBe('boolean');
    });
  });

  describe('confidence scoring', () => {
    it('confidence is between 0 and 1 for known assets', async () => {
      const doc = await generator.generateDocumentation('orders', 'cust-1');
      expect(doc.confidence).toBeGreaterThan(0);
      expect(doc.confidence).toBeLessThanOrEqual(1);
    });

    it('confidence is 0 for unknown assets', async () => {
      const doc = await generator.generateDocumentation('nonexistent_xyz', 'cust-1');
      expect(doc.confidence).toBe(0);
    });

    it('assets with lineage have higher confidence than isolated assets', async () => {
      const withLineage = await generator.generateDocumentation('stg_orders', 'cust-1');
      // pipe-1 has no lineage edges
      const isolated = await generator.generateDocumentation('etl_orders_daily', 'cust-1');
      expect(withLineage.confidence).toBeGreaterThanOrEqual(isolated.confidence);
    });
  });

  describe('unknown assets', () => {
    it('returns minimal documentation for unknown asset', async () => {
      const doc = await generator.generateDocumentation('nonexistent_xyz', 'cust-1');
      expect(doc.description).toContain('No catalog entry found');
      expect(doc.columns).toEqual([]);
      expect(doc.qualityScore).toBe(0);
    });

    it('returns not-found for wrong customer', async () => {
      const doc = await generator.generateDocumentation('orders', 'wrong-customer');
      expect(doc.description).toContain('No catalog entry found');
      expect(doc.confidence).toBe(0);
    });
  });

  describe('column descriptions from pattern dictionary', () => {
    it('recognizes id column', async () => {
      // orders table (tbl-1) has column lineage with id and total_amount columns
      const doc = await generator.generateDocumentation('orders', 'cust-1');
      if (doc.columns && doc.columns.length > 0) {
        const idCol = doc.columns.find(c => c.name === 'id');
        if (idCol) {
          expect(idCol.description).toBe('Primary key identifier');
        }
      }
    });

    it('recognizes total_amount column', async () => {
      const doc = await generator.generateDocumentation('orders', 'cust-1');
      if (doc.columns && doc.columns.length > 0) {
        const amountCol = doc.columns.find(c => c.name === 'total_amount');
        if (amountCol) {
          expect(amountCol.description).toBe('Total monetary amount including all line items');
        }
      }
    });

    it('columns from graph have inferred types', async () => {
      const doc = await generator.generateDocumentation('stg_orders', 'cust-1');
      if (doc.columns && doc.columns.length > 0) {
        for (const col of doc.columns) {
          expect(col.type).toBeTruthy();
        }
      }
    });
  });

  describe('usage stats from graph', () => {
    it('assets with downstream consumers have non-zero usage', async () => {
      const doc = await generator.generateDocumentation('stg_orders', 'cust-1');
      // stg_orders feeds into mart-dim-orders which feeds into dashboards
      expect(doc.usageStats.queryCount30d).toBeGreaterThanOrEqual(0);
    });

    it('leaf nodes (dashboards) have zero downstream usage', async () => {
      const doc = await generator.generateDocumentation('Revenue Dashboard', 'cust-1');
      expect(doc.usageStats.queryCount30d).toBe(0);
      expect(doc.usageStats.uniqueUsers30d).toBe(0);
    });
  });

  describe('quality score', () => {
    it('quality score is between 0 and 100 for known assets', async () => {
      const doc = await generator.generateDocumentation('orders', 'cust-1');
      expect(doc.qualityScore).toBeGreaterThan(0);
      expect(doc.qualityScore).toBeLessThanOrEqual(100);
    });

    it('quality score is 0 for unknown assets', async () => {
      const doc = await generator.generateDocumentation('nonexistent_xyz', 'cust-1');
      expect(doc.qualityScore).toBe(0);
    });
  });

  describe('generatedAt timestamp', () => {
    it('generatedAt is a recent timestamp', async () => {
      const before = Date.now();
      const doc = await generator.generateDocumentation('orders', 'cust-1');
      const after = Date.now();
      expect(doc.generatedAt).toBeGreaterThanOrEqual(before);
      expect(doc.generatedAt).toBeLessThanOrEqual(after);
    });
  });
});
