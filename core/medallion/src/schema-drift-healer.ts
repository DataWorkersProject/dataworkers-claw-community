/**
 * @data-workers/medallion — Schema Drift Healer
 *
 * Detects and auto-heals schema changes between layers.
 * - Additive (new columns): auto-add downstream with null default
 * - Type widening (INT→BIGINT): auto-cast
 * - Breaking (removed columns, narrowing): create incident
 */

import type { ColumnDef, SchemaDrift, HealResult } from './types.js';

/** Type widening hierarchy — larger index = wider type. */
const TYPE_WIDTH: Record<string, number> = {
  boolean: 0,
  tinyint: 1,
  smallint: 2,
  int: 3,
  integer: 3,
  bigint: 4,
  float: 5,
  double: 6,
  decimal: 7,
  string: 8,
  text: 8,
  varchar: 8,
};

export class SchemaDriftHealer {
  /**
   * Detect schema drifts between a source schema and target schema.
   */
  detectDrift(sourceSchema: ColumnDef[], targetSchema: ColumnDef[]): SchemaDrift[] {
    const drifts: SchemaDrift[] = [];
    const sourceMap = new Map(sourceSchema.map((c) => [c.name, c]));
    const targetMap = new Map(targetSchema.map((c) => [c.name, c]));

    // Columns added in source but missing in target
    for (const [name, srcCol] of sourceMap) {
      if (!targetMap.has(name)) {
        drifts.push({
          kind: 'column_added',
          column: name,
          sourceType: srcCol.type,
          autoHealable: true,
          suggestedAction: `Add column '${name}' (${srcCol.type}, nullable) to target`,
        });
      }
    }

    // Columns removed from source (present in target but not source)
    for (const [name, tgtCol] of targetMap) {
      if (!sourceMap.has(name)) {
        drifts.push({
          kind: 'column_removed',
          column: name,
          targetType: tgtCol.type,
          autoHealable: false,
          suggestedAction: `Column '${name}' removed from source — manual migration required`,
        });
      }
    }

    // Type changes for columns present in both
    for (const [name, srcCol] of sourceMap) {
      const tgtCol = targetMap.get(name);
      if (!tgtCol) continue;

      if (srcCol.type.toLowerCase() !== tgtCol.type.toLowerCase()) {
        const srcWidth = TYPE_WIDTH[srcCol.type.toLowerCase()] ?? -1;
        const tgtWidth = TYPE_WIDTH[tgtCol.type.toLowerCase()] ?? -1;

        if (srcWidth > tgtWidth && srcWidth >= 0 && tgtWidth >= 0) {
          // Source is wider — widening (safe)
          drifts.push({
            kind: 'type_widened',
            column: name,
            sourceType: srcCol.type,
            targetType: tgtCol.type,
            autoHealable: true,
            suggestedAction: `Widen column '${name}' from ${tgtCol.type} to ${srcCol.type}`,
          });
        } else {
          // Source is narrower — narrowing (breaking)
          drifts.push({
            kind: 'type_narrowed',
            column: name,
            sourceType: srcCol.type,
            targetType: tgtCol.type,
            autoHealable: false,
            suggestedAction: `Type narrowing on '${name}' (${tgtCol.type}→${srcCol.type}) — manual migration required`,
          });
        }
      }

      // Nullable changes
      if (srcCol.nullable !== tgtCol.nullable) {
        drifts.push({
          kind: 'nullable_changed',
          column: name,
          sourceType: `nullable=${srcCol.nullable}`,
          targetType: `nullable=${tgtCol.nullable}`,
          autoHealable: srcCol.nullable && !tgtCol.nullable, // making nullable is safe
          suggestedAction: srcCol.nullable
            ? `Make column '${name}' nullable in target`
            : `Column '${name}' changed to NOT NULL — may cause failures`,
        });
      }
    }

    return drifts;
  }

  /**
   * Attempt to auto-heal all healable drifts.
   * Returns healed drifts, unhealed drifts, and migration SQL stubs.
   */
  autoHeal(drifts: SchemaDrift[]): HealResult {
    const healed: SchemaDrift[] = [];
    const unhealed: SchemaDrift[] = [];
    const migrations: string[] = [];

    for (const drift of drifts) {
      if (drift.autoHealable) {
        healed.push(drift);

        switch (drift.kind) {
          case 'column_added':
            migrations.push(
              `ALTER TABLE target ADD COLUMN ${drift.column} ${drift.sourceType} DEFAULT NULL;`
            );
            break;
          case 'type_widened':
            migrations.push(
              `ALTER TABLE target ALTER COLUMN ${drift.column} SET DATA TYPE ${drift.sourceType};`
            );
            break;
          case 'nullable_changed':
            migrations.push(
              `ALTER TABLE target ALTER COLUMN ${drift.column} DROP NOT NULL;`
            );
            break;
        }
      } else {
        unhealed.push(drift);
        migrations.push(`-- MANUAL: ${drift.suggestedAction}`);
      }
    }

    return { healed, unhealed, migrations };
  }
}
