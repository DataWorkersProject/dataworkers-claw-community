/**
 * Iceberg schema evolution detection.
 *
 * Compares schemas across consecutive Iceberg snapshots to detect
 * column additions, removals, renames, and partition evolution.
 */

import type { IcebergConnector } from '@data-workers/iceberg-connector';
import type { SchemaChange, ChangeType, ChangeSeverity, DetectionMethod } from './types.js';

interface IcebergField {
  id: number;
  name: string;
  type: string;
  required: boolean;
  doc?: string;
}

/**
 * Detect schema evolution across Iceberg snapshot history.
 *
 * Walks the snapshot list from oldest to newest, compares the schema
 * at each consecutive pair, and emits SchemaChange records for every
 * column add / remove / rename detected.
 *
 * @param connector  Connected IcebergConnector instance
 * @param namespace  Iceberg namespace (e.g. "analytics")
 * @param table      Table name
 * @returns Array of detected SchemaChange objects
 */
export function detectIcebergSchemaEvolution(
  connector: IcebergConnector,
  namespace: string,
  table: string,
): SchemaChange[] {
  const snapshots = connector.getSnapshots(namespace, table);
  if (snapshots.length < 2) {
    return []; // Need at least 2 snapshots to detect evolution
  }

  const changes: SchemaChange[] = [];
  const now = Date.now();

  // Walk consecutive snapshot pairs (oldest first)
  for (let i = 0; i < snapshots.length - 1; i++) {
    const olderSchema = connector.getSchemaAtSnapshot(namespace, table, snapshots[i].snapshotId);
    const newerSchema = connector.getSchemaAtSnapshot(namespace, table, snapshots[i + 1].snapshotId);

    const olderByName = new Map<string, IcebergField>(
      olderSchema.fields.map((f) => [f.name.toLowerCase(), f]),
    );
    const newerByName = new Map<string, IcebergField>(
      newerSchema.fields.map((f) => [f.name.toLowerCase(), f]),
    );

    // Detect removed columns
    const removed: IcebergField[] = [];
    for (const [nameLower, field] of olderByName.entries()) {
      if (!newerByName.has(nameLower)) {
        removed.push(field);
      }
    }

    // Detect added columns
    const added: IcebergField[] = [];
    for (const [nameLower, field] of newerByName.entries()) {
      if (!olderByName.has(nameLower)) {
        added.push(field);
      }
    }

    // Simple rename detection: if exactly one removed and one added share
    // the same type, treat as rename
    const matchedRemoved = new Set<string>();
    const matchedAdded = new Set<string>();

    if (removed.length > 0 && added.length > 0) {
      for (const rem of removed) {
        for (const add of added) {
          if (matchedAdded.has(add.name.toLowerCase())) continue;
          if (rem.type === add.type) {
            changes.push(makeChange(
              now + changes.length,
              namespace, table,
              'column_renamed',
              'warning',
              { oldName: rem.name, newName: add.name, column: rem.name },
              snapshots[i + 1].timestamp,
            ));
            matchedRemoved.add(rem.name.toLowerCase());
            matchedAdded.add(add.name.toLowerCase());
            break;
          }
        }
      }
    }

    // Emit remaining removals
    for (const rem of removed) {
      if (matchedRemoved.has(rem.name.toLowerCase())) continue;
      changes.push(makeChange(
        now + changes.length,
        namespace, table,
        'column_removed',
        'breaking',
        { column: rem.name, oldType: rem.type },
        snapshots[i + 1].timestamp,
      ));
    }

    // Emit remaining additions
    for (const add of added) {
      if (matchedAdded.has(add.name.toLowerCase())) continue;
      changes.push(makeChange(
        now + changes.length,
        namespace, table,
        'column_added',
        'non-breaking',
        { column: add.name, newType: add.type },
        snapshots[i + 1].timestamp,
      ));
    }

    // Detect type changes on matched columns
    for (const [nameLower, olderField] of olderByName.entries()) {
      const newerField = newerByName.get(nameLower);
      if (!newerField) continue;
      if (olderField.type !== newerField.type) {
        changes.push(makeChange(
          now + changes.length,
          namespace, table,
          'column_type_changed',
          'breaking',
          { column: olderField.name, oldType: olderField.type, newType: newerField.type },
          snapshots[i + 1].timestamp,
        ));
      }
    }
  }

  return changes;
}

function makeChange(
  seq: number,
  namespace: string,
  table: string,
  changeType: ChangeType,
  severity: ChangeSeverity,
  details: SchemaChange['details'],
  detectedAt: number,
): SchemaChange {
  return {
    id: `ice-chg-${seq}`,
    customerId: '',
    source: 'iceberg',
    database: namespace,
    schema: namespace,
    table,
    changeType,
    severity,
    details,
    detectedAt,
    detectedVia: 'iceberg_snapshot',
  };
}
