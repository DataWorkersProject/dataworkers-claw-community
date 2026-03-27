/**
 * @data-workers/medallion — Medallion Coordinator
 *
 * Saga-based promotion orchestration.
 * Coordinates the full promotion lifecycle:
 *   1. Validate preconditions
 *   2. Run quality gates
 *   3. Execute promotion via platform adapter
 *   4. Update lineage
 *   5. Log audit entry
 *   On failure: compensate (rollback)
 */

import type {
  PromotionRule,
  PromotionResult,
  QualityGateResult,
  MedallionPlatformAdapter,
} from './types.js';
import { QualityGateEvaluator } from './quality-gate-evaluator.js';
import { LayerRegistry } from './layer-registry.js';
import { LineageTracker } from './lineage-tracker.js';
import { AuditLog } from './rbac-audit.js';

export class MedallionCoordinator {
  private evaluator: QualityGateEvaluator;
  private registry: LayerRegistry;
  private lineageTracker: LineageTracker;
  private auditLog: AuditLog;
  private completedPromotions: Map<string, PromotionResult> = new Map();

  constructor(
    registry: LayerRegistry,
    lineageTracker: LineageTracker,
    auditLog: AuditLog
  ) {
    this.evaluator = new QualityGateEvaluator();
    this.registry = registry;
    this.lineageTracker = lineageTracker;
    this.auditLog = auditLog;
  }

  /**
   * Execute a full promotion saga.
   */
  async executePromotion(
    rule: PromotionRule,
    adapter: MedallionPlatformAdapter,
    tableData?: Record<string, unknown>[]
  ): Promise<PromotionResult> {
    const startTime = Date.now();

    // Step 1: Validate preconditions
    if (!this.registry.validatePromotionOrder(rule.sourceLayer, rule.targetLayer)) {
      return this.failedResult(rule, startTime, 'Invalid promotion order');
    }

    const sourceMapping = this.registry.resolve(rule.sourceLayer, rule.sourceTable);
    if (!sourceMapping) {
      return this.failedResult(
        rule,
        startTime,
        `Source table '${rule.sourceTable}' not registered in ${rule.sourceLayer} layer`
      );
    }

    // Step 2: Run quality gates (if data provided)
    let qualityResults: QualityGateResult[] = [];
    if (rule.qualityGates.length > 0 && tableData && tableData.length > 0) {
      qualityResults = this.evaluator.evaluateGates(rule.qualityGates, tableData);

      const blockingFailures = qualityResults.filter(
        (r) => !r.passed && r.gate.onFailure === 'block'
      );

      if (blockingFailures.length > 0) {
        const details = blockingFailures
          .map((f) => f.details)
          .join('; ');

        const result: PromotionResult = {
          promotionId: `promo_failed_${Date.now()}`,
          rule,
          status: 'failed',
          rowsProcessed: 0,
          rowsPromoted: 0,
          rowsQuarantined: 0,
          qualityResults,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
        };

        this.auditLog.log({
          id: `audit_${Date.now()}`,
          timestamp: Date.now(),
          action: 'promote',
          actor: 'medallion-coordinator',
          sourceLayer: rule.sourceLayer,
          targetLayer: rule.targetLayer,
          table: rule.sourceTable,
          details: { status: 'failed', reason: details },
        });

        return result;
      }

      // Check for quarantine gates
      const quarantineFailures = qualityResults.filter(
        (r) => !r.passed && r.gate.onFailure === 'quarantine'
      );

      if (quarantineFailures.length > 0) {
        const result: PromotionResult = {
          promotionId: `promo_quarantined_${Date.now()}`,
          rule,
          status: 'quarantined',
          rowsProcessed: tableData.length,
          rowsPromoted: 0,
          rowsQuarantined: tableData.length,
          qualityResults,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
        };

        this.auditLog.log({
          id: `audit_${Date.now()}`,
          timestamp: Date.now(),
          action: 'quarantine',
          actor: 'medallion-coordinator',
          sourceLayer: rule.sourceLayer,
          targetLayer: rule.targetLayer,
          table: rule.sourceTable,
          details: { status: 'quarantined' },
        });

        return result;
      }
    }

    // Step 3: Execute promotion via adapter
    let result: PromotionResult;
    try {
      result = await adapter.executePromotion(rule);
      result.qualityResults = qualityResults;
      result.durationMs = Date.now() - startTime;
    } catch (error) {
      return this.failedResult(
        rule,
        startTime,
        `Adapter error: ${(error as Error).message}`
      );
    }

    // Step 4: Track lineage
    const lineageEdgeId = this.lineageTracker.trackPromotion(result);
    result.lineageEdgeId = lineageEdgeId;

    // Step 5: Audit log
    this.auditLog.log({
      id: `audit_${Date.now()}`,
      timestamp: Date.now(),
      action: 'promote',
      actor: 'medallion-coordinator',
      sourceLayer: rule.sourceLayer,
      targetLayer: rule.targetLayer,
      table: rule.sourceTable,
      details: {
        status: result.status,
        rowsPromoted: result.rowsPromoted,
        promotionId: result.promotionId,
      },
    });

    this.completedPromotions.set(result.promotionId, result);

    return result;
  }

  /** Rollback a previously completed promotion. */
  async rollback(
    promotionId: string,
    adapter: MedallionPlatformAdapter
  ): Promise<void> {
    await adapter.rollbackPromotion(promotionId);

    const original = this.completedPromotions.get(promotionId);

    this.auditLog.log({
      id: `audit_rollback_${Date.now()}`,
      timestamp: Date.now(),
      action: 'rollback',
      actor: 'medallion-coordinator',
      sourceLayer: original?.rule.sourceLayer ?? 'bronze',
      targetLayer: original?.rule.targetLayer,
      table: original?.rule.sourceTable ?? 'unknown',
      details: { promotionId },
    });

    this.completedPromotions.delete(promotionId);
  }

  private failedResult(
    rule: PromotionRule,
    startTime: number,
    reason: string
  ): PromotionResult {
    return {
      promotionId: `promo_failed_${Date.now()}`,
      rule,
      status: 'failed',
      rowsProcessed: 0,
      rowsPromoted: 0,
      rowsQuarantined: 0,
      qualityResults: [],
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }
}
