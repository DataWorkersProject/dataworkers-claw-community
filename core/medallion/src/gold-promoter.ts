/**
 * @data-workers/medallion — Gold Promoter
 *
 * Silver-to-Gold promotion with aggregation and join support.
 * Builds transform steps for aggregate rollups, multi-table joins,
 * and feature engineering.
 */

import type { TransformStep, AggregationConfig, JoinConfig } from './types.js';

export class GoldPromoter {
  /**
   * Build aggregation transform steps from a config.
   * Produces a sequence of transforms: filter → aggregate → rename.
   */
  buildAggregation(config: AggregationConfig): TransformStep[] {
    const steps: TransformStep[] = [];

    // Step 1: Aggregate by dimensions and measures
    steps.push({
      type: 'aggregate',
      config: {
        dimensions: config.dimensions,
        measures: config.measures.map((m) => ({
          column: m.column,
          function: m.function,
          alias: m.alias,
        })),
      },
    });

    // Step 2: Rename aggregated columns to their aliases
    const renames: Record<string, string> = {};
    for (const measure of config.measures) {
      const generatedName = `${measure.function.toLowerCase()}_${measure.column}`;
      if (generatedName !== measure.alias) {
        renames[generatedName] = measure.alias;
      }
    }

    if (Object.keys(renames).length > 0) {
      steps.push({
        type: 'rename',
        config: { columns: renames },
      });
    }

    return steps;
  }

  /**
   * Build join transform steps from a config.
   * Produces a single join step that combines two Silver tables.
   */
  buildJoin(config: JoinConfig): TransformStep[] {
    const steps: TransformStep[] = [];

    steps.push({
      type: 'join',
      config: {
        leftTable: config.leftTable,
        rightTable: config.rightTable,
        joinType: config.joinType,
        joinKeys: config.joinKeys,
        selectColumns: config.selectColumns,
      },
    });

    // Step 2: Deduplicate after join to eliminate fan-out duplicates
    steps.push({
      type: 'deduplicate',
      config: {
        keys: config.selectColumns.length > 0 ? config.selectColumns : undefined,
      },
    });

    return steps;
  }

  /**
   * Build feature engineering transforms: computed columns, casts, etc.
   */
  buildFeatureEngineering(features: Array<{
    name: string;
    expression: string;
    type: string;
  }>): TransformStep[] {
    return features.map((f) => ({
      type: 'custom' as const,
      config: {
        operation: 'feature_engineering',
        outputColumn: f.name,
        expression: f.expression,
        outputType: f.type,
      },
    }));
  }
}
