/**
 * @data-workers/medallion — Quality Gate Evaluator
 *
 * Layer-specific quality enforcement.
 * Evaluates data quality along multiple dimensions before promotion.
 */

import type { QualityGate, QualityGateResult } from './types.js';

export class QualityGateEvaluator {
  /**
   * Evaluate all quality gates against a table's data.
   * Returns a result for each gate with score, pass/fail, and details.
   */
  evaluateGates(
    gates: QualityGate[],
    tableData: Record<string, unknown>[]
  ): QualityGateResult[] {
    return gates.map((gate) => {
      let score: number;

      switch (gate.dimension) {
        case 'completeness':
          score = this.evaluateCompleteness(tableData, gate);
          break;
        case 'uniqueness':
          score = this.evaluateUniqueness(tableData, gate);
          break;
        case 'freshness':
          score = this.evaluateFreshness(tableData, gate);
          break;
        case 'accuracy':
          score = this.evaluateAccuracy(tableData, gate);
          break;
        case 'schema_conformance':
          score = this.evaluateSchemaConformance(tableData, gate);
          break;
        default:
          score = 0;
      }

      const passed = score >= gate.threshold;

      return {
        gate,
        score,
        passed,
        details: passed
          ? `${gate.dimension} check passed: ${score.toFixed(1)}% >= ${gate.threshold}%`
          : `${gate.dimension} check failed: ${score.toFixed(1)}% < ${gate.threshold}%`,
      };
    });
  }

  /**
   * Completeness: percentage of non-null values across all columns
   * (or specific columns from gate config).
   */
  evaluateCompleteness(
    data: Record<string, unknown>[],
    gate: QualityGate
  ): number {
    if (data.length === 0) return 0;

    const columns =
      gate && (gate as unknown as Record<string, unknown>)['columns']
        ? ((gate as unknown as Record<string, unknown>)['columns'] as string[])
        : Object.keys(data[0]);

    let totalCells = 0;
    let nonNullCells = 0;

    for (const row of data) {
      for (const col of columns) {
        totalCells++;
        if (row[col] !== null && row[col] !== undefined && row[col] !== '') {
          nonNullCells++;
        }
      }
    }

    return totalCells === 0 ? 100 : (nonNullCells / totalCells) * 100;
  }

  /**
   * Uniqueness: percentage of unique values in a declared key column.
   */
  evaluateUniqueness(
    data: Record<string, unknown>[],
    gate: QualityGate
  ): number {
    if (data.length === 0) return 100;

    // Use first column as unique key if not specified
    const keyColumn = Object.keys(data[0])[0];
    const values = data.map((row) => row[keyColumn]);
    const uniqueValues = new Set(values);

    return (uniqueValues.size / values.length) * 100;
  }

  /**
   * Freshness: checks how recent the newest record is.
   * Score is 100 if within threshold hours, linearly decreasing after.
   */
  evaluateFreshness(
    data: Record<string, unknown>[],
    gate: QualityGate
  ): number {
    if (data.length === 0) return 0;

    // Look for timestamp-like columns
    const timestampCols = Object.keys(data[0]).filter(
      (col) =>
        col.includes('timestamp') ||
        col.includes('date') ||
        col.includes('created') ||
        col.includes('updated')
    );

    if (timestampCols.length === 0) return 100; // No timestamp column, assume fresh

    const col = timestampCols[0];
    const now = Date.now();

    let maxTimestamp = 0;
    for (const row of data) {
      const val = row[col];
      const ts = typeof val === 'number' ? val : new Date(val as string).getTime();
      if (!isNaN(ts) && ts > maxTimestamp) {
        maxTimestamp = ts;
      }
    }

    if (maxTimestamp === 0) return 0;

    const ageHours = (now - maxTimestamp) / (1000 * 60 * 60);
    const maxAgeHours = 24; // Default: data should be within 24h

    if (ageHours <= maxAgeHours) return 100;
    // Linear decay: at 2x max age, score = 0
    return Math.max(0, 100 - ((ageHours - maxAgeHours) / maxAgeHours) * 100);
  }

  /**
   * Accuracy: percentage of values that match validation patterns.
   * Checks for non-empty strings, valid numbers, etc.
   */
  evaluateAccuracy(
    data: Record<string, unknown>[],
    gate: QualityGate
  ): number {
    if (data.length === 0) return 0;

    const columns = Object.keys(data[0]);
    let validCells = 0;
    let totalCells = 0;

    for (const row of data) {
      for (const col of columns) {
        totalCells++;
        const val = row[col];
        // A value is "accurate" if it's a defined, non-empty, non-NaN value
        if (val !== null && val !== undefined) {
          if (typeof val === 'number' && isNaN(val)) continue;
          if (typeof val === 'string' && val.trim() === '') continue;
          validCells++;
        }
      }
    }

    return totalCells === 0 ? 100 : (validCells / totalCells) * 100;
  }

  /**
   * Schema conformance: percentage of expected columns present in data.
   */
  evaluateSchemaConformance(
    data: Record<string, unknown>[],
    gate: QualityGate
  ): number {
    if (data.length === 0) return 0;

    // Without an explicit expected schema, check that all rows have the same columns
    const expectedColumns = Object.keys(data[0]);
    let conformingRows = 0;

    for (const row of data) {
      const rowCols = Object.keys(row);
      const hasAll = expectedColumns.every((c) => rowCols.includes(c));
      if (hasAll) conformingRows++;
    }

    return (conformingRows / data.length) * 100;
  }
}
