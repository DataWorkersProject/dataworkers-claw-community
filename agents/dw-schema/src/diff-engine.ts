/**
 * Schema diff engine for comparing column snapshots.
 * Detects additions, removals, type changes, and renames via Levenshtein heuristic.
 */

import type { SchemaChange, ChangeType, ChangeSeverity } from './types.js';
import { loadSchemaAgentConfig } from './types.js';
import type { ColumnDef } from '@data-workers/infrastructure-stubs';

const config = loadSchemaAgentConfig();

/**
 * Compute the Levenshtein edit distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Determine the severity of a type change.
 * Widening changes (e.g., VARCHAR(50) -> VARCHAR(100)) are non-breaking.
 * Narrowing or incompatible changes are breaking.
 */
function classifyTypeChangeSeverity(oldType: string, newType: string): ChangeSeverity {
  const wideningPatterns: Array<[RegExp, RegExp]> = [
    [/^VARCHAR\((\d+)\)$/i, /^VARCHAR\((\d+)\)$/i],
    [/^DECIMAL\((\d+),(\d+)\)$/i, /^DECIMAL\((\d+),(\d+)\)$/i],
  ];

  for (const [oldPat, newPat] of wideningPatterns) {
    const oldMatch = oldType.match(oldPat);
    const newMatch = newType.match(newPat);
    if (oldMatch && newMatch) {
      const oldSize = parseInt(oldMatch[1], 10);
      const newSize = parseInt(newMatch[1], 10);
      if (newSize >= oldSize) return 'non-breaking';
      return 'breaking';
    }
  }

  // Known widening type promotions
  const wideningMap: Record<string, string[]> = {
    'INTEGER': ['BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'],
    'FLOAT': ['DOUBLE'],
    'INT': ['BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'],
  };
  if (wideningMap[oldType.toUpperCase()]?.includes(newType.toUpperCase())) {
    return 'non-breaking';
  }

  return 'breaking';
}

/**
 * Diff two column lists and produce SchemaChange descriptors.
 * Columns are matched by name (case-insensitive), not ordinal position.
 * Rename detection: if a column is removed and another is added with the same type
 * and Levenshtein distance < renameDistanceThreshold, it is classified as column_renamed.
 * A confidence score (0-1) is attached to rename detections.
 */
export function diffSchemas(
  oldColumns: ColumnDef[],
  newColumns: ColumnDef[],
  context: {
    customerId: string;
    source: string;
    database: string;
    schema: string;
    table: string;
  },
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const now = Date.now();

  const oldByName = new Map(oldColumns.map(c => [c.name.toLowerCase(), c]));
  const newByName = new Map(newColumns.map(c => [c.name.toLowerCase(), c]));

  // Find removed columns
  const removed: ColumnDef[] = [];
  for (const [nameLower, oldCol] of oldByName.entries()) {
    if (!newByName.has(nameLower)) {
      removed.push(oldCol);
    }
  }

  // Find added columns
  const added: ColumnDef[] = [];
  for (const [nameLower, newCol] of newByName.entries()) {
    if (!oldByName.has(nameLower)) {
      added.push(newCol);
    }
  }

  // Detect renames: removed + added with same type and Levenshtein < threshold
  const matchedRemoved = new Set<string>();
  const matchedAdded = new Set<string>();

  for (const rem of removed) {
    for (const add of added) {
      if (matchedAdded.has(add.name.toLowerCase())) continue;
      if (rem.type.toUpperCase() === add.type.toUpperCase()) {
        const dist = levenshtein(rem.name.toLowerCase(), add.name.toLowerCase());
        if (dist < config.renameDistanceThreshold && dist > 0) {
          const confidence = 1 - dist / Math.max(rem.name.length, add.name.length);
          if (confidence >= config.renameMinConfidence) {
            changes.push({
              id: `chg-${now}-${changes.length}`,
              customerId: context.customerId,
              source: context.source,
              database: context.database,
              schema: context.schema,
              table: context.table,
              changeType: 'column_renamed',
              severity: 'warning',
              details: {
                oldName: rem.name,
                newName: add.name,
                column: rem.name,
              },
              detectedAt: now,
              detectedVia: 'information_schema',
              confidence,
            });
            matchedRemoved.add(rem.name.toLowerCase());
            matchedAdded.add(add.name.toLowerCase());
            break;
          }
        }
      }
    }
  }

  // Emit remaining removed columns
  for (const rem of removed) {
    if (matchedRemoved.has(rem.name.toLowerCase())) continue;
    changes.push({
      id: `chg-${now}-${changes.length}`,
      customerId: context.customerId,
      source: context.source,
      database: context.database,
      schema: context.schema,
      table: context.table,
      changeType: 'column_removed',
      severity: 'breaking',
      details: { column: rem.name, oldType: rem.type },
      detectedAt: now,
      detectedVia: 'information_schema',
    });
  }

  // Emit remaining added columns
  for (const add of added) {
    if (matchedAdded.has(add.name.toLowerCase())) continue;
    changes.push({
      id: `chg-${now}-${changes.length}`,
      customerId: context.customerId,
      source: context.source,
      database: context.database,
      schema: context.schema,
      table: context.table,
      changeType: 'column_added',
      severity: 'non-breaking',
      details: { column: add.name, newType: add.type },
      detectedAt: now,
      detectedVia: 'information_schema',
    });
  }

  // Detect type changes on matched columns
  for (const [nameLower, oldCol] of oldByName.entries()) {
    const newCol = newByName.get(nameLower);
    if (!newCol) continue;
    if (oldCol.type.toUpperCase() !== newCol.type.toUpperCase()) {
      const severity = classifyTypeChangeSeverity(oldCol.type, newCol.type);
      changes.push({
        id: `chg-${now}-${changes.length}`,
        customerId: context.customerId,
        source: context.source,
        database: context.database,
        schema: context.schema,
        table: context.table,
        changeType: 'column_type_changed',
        severity,
        details: { column: oldCol.name, oldType: oldCol.type, newType: newCol.type },
        detectedAt: now,
        detectedVia: 'information_schema',
      });
    }
  }

  return changes;
}
