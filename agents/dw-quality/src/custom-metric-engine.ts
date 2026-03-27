/**
 * Custom Metric Engine — allows defining and evaluating user-defined
 * quality metrics beyond the built-in set.
 *
 * Custom metrics can specify SQL-based or function-based evaluators
 * and integrate with the standard quality scoring pipeline.
 */

import type { QualityMetric, MetricType } from './types.js';

export interface CustomMetricDefinition {
  id: string;
  name: string;
  description: string;
  type: MetricType;
  /** SQL query that returns a single numeric value. */
  sql?: string;
  /** Programmatic evaluator function. */
  evaluator?: (data: Record<string, unknown>[]) => number;
  threshold: number;
  /** 'gte' means value must be >= threshold to pass, 'lte' means value must be <= threshold. */
  operator: 'gte' | 'lte';
  customerId: string;
  datasetId: string;
}

export class CustomMetricEngine {
  private definitions: Map<string, CustomMetricDefinition> = new Map();

  /** Register a custom metric definition. */
  register(definition: CustomMetricDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  /** Unregister a custom metric. */
  unregister(id: string): boolean {
    return this.definitions.delete(id);
  }

  /** List all registered custom metrics for a dataset. */
  list(datasetId: string, customerId: string): CustomMetricDefinition[] {
    return Array.from(this.definitions.values()).filter(
      (d) => d.datasetId === datasetId && d.customerId === customerId,
    );
  }

  /**
   * Evaluate a custom metric using its evaluator function.
   * Returns a QualityMetric result.
   */
  evaluate(definition: CustomMetricDefinition, data: Record<string, unknown>[]): QualityMetric {
    let value: number;

    if (definition.evaluator) {
      value = definition.evaluator(data);
    } else {
      // SQL-based metrics need to be evaluated externally
      value = 0;
    }

    const passed = definition.operator === 'gte'
      ? value >= definition.threshold
      : value <= definition.threshold;

    return {
      name: definition.name,
      type: definition.type,
      value,
      threshold: definition.threshold,
      passed,
      details: {
        customMetricId: definition.id,
        description: definition.description,
        operator: definition.operator,
      },
    };
  }

  /**
   * Evaluate all custom metrics for a dataset.
   */
  evaluateAll(
    datasetId: string,
    customerId: string,
    data: Record<string, unknown>[],
  ): QualityMetric[] {
    const definitions = this.list(datasetId, customerId);
    return definitions.map((def) => this.evaluate(def, data));
  }
}
