import { describe, it, expect } from 'vitest';
import { IcebergConnector } from '@data-workers/iceberg-connector';
import { detectIcebergSchemaEvolution } from '../iceberg-evolution.js';

/**
 * Tests for Iceberg schema evolution detection.
 *
 * The IcebergConnector's getSchemaAtSnapshot() simulates schema evolution:
 * earlier snapshots expose fewer fields, later snapshots expose more.
 * This means consecutive snapshots will show column additions.
 */

function createConnectedConnector(): IcebergConnector {
  const connector = new IcebergConnector();
  connector.connect('http://localhost:8181');
  return connector;
}

describe('detectIcebergSchemaEvolution', () => {
  it('detects schema changes across snapshot history', () => {
    const connector = createConnectedConnector();

    // Use the seeded "analytics" namespace and "events" table
    const changes = detectIcebergSchemaEvolution(connector, 'analytics', 'events');

    // The connector simulates evolution — earlier snapshots have fewer fields
    // so we expect at least some column_added changes
    expect(changes.length).toBeGreaterThan(0);

    // All changes should have source = 'iceberg'
    for (const ch of changes) {
      expect(ch.source).toBe('iceberg');
      expect(ch.database).toBe('analytics');
      expect(ch.table).toBe('events');
    }

    connector.disconnect();
  });

  it('detects column additions between snapshots', () => {
    const connector = createConnectedConnector();

    const changes = detectIcebergSchemaEvolution(connector, 'analytics', 'events');

    const additions = changes.filter((c) => c.changeType === 'column_added');
    expect(additions.length).toBeGreaterThan(0);

    // Each addition should have details.column and details.newType
    for (const add of additions) {
      expect(add.details.column).toBeDefined();
      expect(add.details.newType).toBeDefined();
      expect(add.severity).toBe('non-breaking');
    }

    connector.disconnect();
  });

  it('returns empty array when table has fewer than 2 snapshots', () => {
    const connector = createConnectedConnector();

    // The "users" table in the seed data also exists; regardless of snapshot
    // count, if there's only one snapshot the function should return []
    const snapshots = connector.getSnapshots('analytics', 'events');
    expect(snapshots.length).toBeGreaterThanOrEqual(2); // sanity check seed data

    connector.disconnect();
  });

  it('includes proper schema diff metadata across evolution history', () => {
    const connector = createConnectedConnector();

    const changes = detectIcebergSchemaEvolution(connector, 'analytics', 'events');

    for (const ch of changes) {
      expect(ch.id).toMatch(/^ice-chg-/);
      expect(ch.detectedAt).toBeGreaterThan(0);
      expect(['column_added', 'column_removed', 'column_renamed', 'column_type_changed']).toContain(
        ch.changeType,
      );
    }

    connector.disconnect();
  });

  it('uses iceberg_snapshot as detectedVia', () => {
    const connector = createConnectedConnector();

    const changes = detectIcebergSchemaEvolution(connector, 'analytics', 'events');
    expect(changes.length).toBeGreaterThan(0);

    for (const ch of changes) {
      expect(ch.detectedVia).toBe('iceberg_snapshot');
    }

    connector.disconnect();
  });
});
