import { describe, it, expect, beforeEach } from 'vitest';
import { IcebergConnector } from '../index.js';

describe('IcebergConnector', () => {
  let connector: IcebergConnector;

  beforeEach(() => {
    connector = new IcebergConnector();
  });

  // --- connect / disconnect / healthCheck ---

  describe('connect / disconnect / healthCheck', () => {
    it('should connect with a valid endpoint', () => {
      connector.connect('http://localhost:8181');
      const health = connector.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw when connecting with an empty endpoint', () => {
      expect(() => connector.connect('')).toThrow('A valid endpoint URL is required');
    });

    it('should report unhealthy when disconnected', () => {
      connector.connect('http://localhost:8181');
      connector.disconnect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should throw on operations when not connected', () => {
      expect(() => connector.listNamespaces()).toThrow('Not connected');
    });
  });

  // --- listNamespaces ---

  describe('listNamespaces', () => {
    it('should return seeded namespaces', () => {
      connector.connect('http://localhost:8181');
      const namespaces = connector.listNamespaces();
      expect(namespaces).toHaveLength(1);
      expect(namespaces[0].name).toEqual(['analytics']);
      expect(namespaces[0].properties).toHaveProperty('owner');
    });
  });

  // --- listTables ---

  describe('listTables', () => {
    it('should return seeded tables for analytics namespace', () => {
      connector.connect('http://localhost:8181');
      const tables = connector.listTables('analytics');
      expect(tables.length).toBe(4);
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['customers', 'events', 'orders', 'products']);
    });

    it('should throw for unknown namespace', () => {
      connector.connect('http://localhost:8181');
      expect(() => connector.listTables('nonexistent')).toThrow('Namespace not found');
    });
  });

  // --- getTableMetadata ---

  describe('getTableMetadata', () => {
    it('should return full metadata with schema, partitions, and snapshots', () => {
      connector.connect('http://localhost:8181');
      const meta = connector.getTableMetadata('analytics', 'orders');

      expect(meta.tableId).toBe('analytics.orders');
      expect(meta.schema.fields.length).toBeGreaterThanOrEqual(4);
      expect(meta.partitionSpec.fields.length).toBeGreaterThan(0);
      expect(meta.partitionSpec.fields[0].transform).toBe('day');
      expect(meta.sortOrder.fields.length).toBeGreaterThan(0);
      expect(meta.snapshots.length).toBeGreaterThanOrEqual(3);
      expect(meta.currentSnapshotId).toBeDefined();
      expect(meta.properties).toHaveProperty('write.format.default', 'parquet');
    });

    it('should throw for unknown table', () => {
      connector.connect('http://localhost:8181');
      expect(() => connector.getTableMetadata('analytics', 'unknown')).toThrow('Table not found');
    });
  });

  // --- getSnapshots ---

  describe('getSnapshots', () => {
    it('should return snapshot history with timestamps', () => {
      connector.connect('http://localhost:8181');
      const snapshots = connector.getSnapshots('analytics', 'orders');

      expect(snapshots.length).toBe(5);
      for (const snap of snapshots) {
        expect(snap.snapshotId).toBeDefined();
        expect(snap.timestamp).toBeGreaterThan(0);
        expect(snap.summary.operation).toBeDefined();
      }

      // Timestamps should be in ascending order
      for (let i = 1; i < snapshots.length; i++) {
        expect(snapshots[i].timestamp).toBeGreaterThan(snapshots[i - 1].timestamp);
      }
    });
  });

  // --- getSchemaAtSnapshot ---

  describe('getSchemaAtSnapshot', () => {
    it('should return the schema for a specific snapshot', () => {
      connector.connect('http://localhost:8181');
      const snapshots = connector.getSnapshots('analytics', 'orders');
      const firstSnapshotId = snapshots[0].snapshotId;
      const lastSnapshotId = snapshots[snapshots.length - 1].snapshotId;

      const earlySchema = connector.getSchemaAtSnapshot('analytics', 'orders', firstSnapshotId);
      const latestSchema = connector.getSchemaAtSnapshot('analytics', 'orders', lastSnapshotId);

      // Earlier snapshot should have fewer or equal fields (schema evolution)
      expect(earlySchema.fields.length).toBeLessThanOrEqual(latestSchema.fields.length);
      // Latest snapshot should include all fields
      const fullMeta = connector.getTableMetadata('analytics', 'orders');
      expect(latestSchema.fields.length).toBe(fullMeta.schema.fields.length);
    });

    it('should throw for unknown snapshot', () => {
      connector.connect('http://localhost:8181');
      expect(() => connector.getSchemaAtSnapshot('analytics', 'orders', 999999)).toThrow(
        'Snapshot 999999 not found',
      );
    });
  });

  // --- getTableStatistics ---

  describe('getTableStatistics', () => {
    it('should return row counts and file counts for orders', () => {
      connector.connect('http://localhost:8181');
      const stats = connector.getTableStatistics('analytics', 'orders');

      expect(stats.totalRecords).toBe(1_000_000);
      expect(stats.totalDataFiles).toBe(500);
      expect(stats.totalSizeBytes).toBe(2_500_000_000);
    });

    it('should return statistics for customers', () => {
      connector.connect('http://localhost:8181');
      const stats = connector.getTableStatistics('analytics', 'customers');

      expect(stats.totalRecords).toBe(100_000);
      expect(stats.totalDataFiles).toBe(50);
      expect(stats.totalSizeBytes).toBe(250_000_000);
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw for operations on unknown namespace', () => {
      connector.connect('http://localhost:8181');
      expect(() => connector.listTables('missing_ns')).toThrow('Namespace not found');
    });

    it('should throw for getTableMetadata on unknown table', () => {
      connector.connect('http://localhost:8181');
      expect(() => connector.getTableMetadata('analytics', 'nonexistent')).toThrow('Table not found');
    });

    it('should throw for getSnapshots on unknown table', () => {
      connector.connect('http://localhost:8181');
      expect(() => connector.getSnapshots('analytics', 'nonexistent')).toThrow('Table not found');
    });
  });
});
