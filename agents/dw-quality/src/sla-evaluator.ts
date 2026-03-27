/**
 * SLA Evaluator — persists SLAs to the relational store,
 * evaluates quality results against SLA rules, and produces
 * SLAViolation objects.
 */

import type { IRelationalStore, IMessageBus, MessageBusEvent } from '@data-workers/infrastructure-stubs';
import type { SLADefinition, SLARule, SLAViolation, QualityCheckResult } from './types.js';

export class SLAEvaluator {
  private store: IRelationalStore;
  private messageBus: IMessageBus;
  private initialized = false;

  constructor(store: IRelationalStore, messageBus: IMessageBus) {
    this.store = store;
    this.messageBus = messageBus;
  }

  /** Ensure SLA tables exist in the relational store. */
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    await this.store.createTable('sla_definitions');
    await this.store.createTable('sla_violations');
    this.initialized = true;
  }

  /** Persist an SLA definition to the relational store. */
  async saveSLA(sla: SLADefinition): Promise<void> {
    await this.ensureTable();
    await this.store.insert('sla_definitions', {
      id: sla.id,
      datasetId: sla.datasetId,
      customerId: sla.customerId,
      rules: JSON.stringify(sla.rules),
      createdAt: sla.createdAt,
      updatedAt: sla.updatedAt,
    });
  }

  /** Retrieve SLAs for a given dataset and customer. */
  async getSLAs(datasetId: string, customerId: string): Promise<SLADefinition[]> {
    await this.ensureTable();
    const rows = await this.store.query('sla_definitions', (row) =>
      row.datasetId === datasetId && row.customerId === customerId,
    );
    return rows.map((row) => ({
      id: row.id as string,
      datasetId: row.datasetId as string,
      customerId: row.customerId as string,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : (row.rules as SLARule[]),
      createdAt: row.createdAt as number,
      updatedAt: row.updatedAt as number,
    }));
  }

  /**
   * Evaluate a quality check result against all matching SLAs.
   * Returns a list of violations found.
   */
  async evaluate(result: QualityCheckResult): Promise<SLAViolation[]> {
    const slas = await this.getSLAs(result.datasetId, result.customerId);
    const violations: SLAViolation[] = [];

    for (const sla of slas) {
      for (const rule of sla.rules) {
        // Find the metric value in the quality check result
        const matchingMetric = result.metrics.find((m) => m.type === rule.metric || m.name === rule.metric);
        if (!matchingMetric) continue;

        const violated = this.isViolated(matchingMetric.value, rule);
        if (violated) {
          const violation: SLAViolation = {
            id: `slav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            slaId: sla.id,
            datasetId: result.datasetId,
            customerId: result.customerId,
            rule,
            actualValue: matchingMetric.value,
            violatedAt: Date.now(),
            severity: rule.severity,
            description: `SLA violation: ${rule.description} — actual ${matchingMetric.value}, threshold ${rule.operator} ${rule.threshold}`,
          };

          violations.push(violation);

          // Persist violation
          await this.store.insert('sla_violations', {
            ...violation,
            rule: JSON.stringify(rule),
          });

          // Publish SLA violation event
          await this.messageBus.publish('sla_violation', {
            id: violation.id,
            type: 'sla_violation',
            payload: {
              slaId: sla.id,
              datasetId: result.datasetId,
              metric: rule.metric,
              actualValue: matchingMetric.value,
              threshold: rule.threshold,
              operator: rule.operator,
              severity: rule.severity,
            },
            timestamp: violation.violatedAt,
            customerId: result.customerId,
          } as MessageBusEvent);
        }
      }
    }

    return violations;
  }

  /** Check if a value violates a rule. */
  private isViolated(value: number, rule: SLARule): boolean {
    switch (rule.operator) {
      case 'lt': return !(value < rule.threshold);
      case 'lte': return !(value <= rule.threshold);
      case 'gt': return !(value > rule.threshold);
      case 'gte': return !(value >= rule.threshold);
      case 'eq': return value !== rule.threshold;
      default: return false;
    }
  }
}
