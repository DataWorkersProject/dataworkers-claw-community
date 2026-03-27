/**
 * @data-workers/medallion — Promotion Engine
 *
 * Evaluates promotion rules and triggers promotion sagas.
 * Central entry point that ties together all medallion components.
 */

import type {
  PromotionRule,
  PromotionResult,
  QualityGateResult,
  MedallionPlatformAdapter,
} from './types.js';
import { LayerRegistry } from './layer-registry.js';
import { QualityGateEvaluator } from './quality-gate-evaluator.js';
import { MedallionCoordinator } from './medallion-coordinator.js';
import { LineageTracker } from './lineage-tracker.js';
import { AuditLog } from './rbac-audit.js';
import { IcebergMedallionAdapter } from './iceberg-adapter.js';

export class PromotionEngine {
  private registry: LayerRegistry;
  private evaluator: QualityGateEvaluator;
  private coordinator: MedallionCoordinator;
  private lineageTracker: LineageTracker;
  private auditLog: AuditLog;
  private adapters: Map<string, MedallionPlatformAdapter> = new Map();

  constructor(registry: LayerRegistry) {
    this.registry = registry;
    this.evaluator = new QualityGateEvaluator();
    this.lineageTracker = new LineageTracker();
    this.auditLog = new AuditLog();
    this.coordinator = new MedallionCoordinator(
      registry,
      this.lineageTracker,
      this.auditLog
    );

    // Register default adapter
    const iceberg = new IcebergMedallionAdapter();
    this.adapters.set(iceberg.name, iceberg);
  }

  /** Register a platform adapter. */
  registerAdapter(adapter: MedallionPlatformAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Execute a full promotion.
   */
  async promote(
    rule: PromotionRule,
    tableData?: Record<string, unknown>[]
  ): Promise<PromotionResult> {
    // 1. Validate rule
    if (!this.registry.validatePromotionOrder(rule.sourceLayer, rule.targetLayer)) {
      return {
        promotionId: `promo_invalid_${Date.now()}`,
        rule,
        status: 'failed',
        rowsProcessed: 0,
        rowsPromoted: 0,
        rowsQuarantined: 0,
        qualityResults: [],
        durationMs: 0,
        timestamp: Date.now(),
      };
    }

    // 2. Get adapter (from source table's platform, or default iceberg)
    const sourceMapping = this.registry.resolve(rule.sourceLayer, rule.sourceTable);
    const platform = sourceMapping?.platform ?? 'iceberg';
    const adapter = this.adapters.get(platform) ?? this.adapters.get('iceberg')!;

    // 3. Delegate to coordinator
    return this.coordinator.executePromotion(rule, adapter, tableData);
  }

  /**
   * Dry run: evaluate quality gates without actually promoting.
   */
  async dryRun(
    rule: PromotionRule,
    tableData: Record<string, unknown>[] = []
  ): Promise<{
    wouldPromote: boolean;
    qualityResults: QualityGateResult[];
    validationErrors: string[];
  }> {
    const validationErrors: string[] = [];

    // Validate promotion order
    if (!this.registry.validatePromotionOrder(rule.sourceLayer, rule.targetLayer)) {
      validationErrors.push(
        `Invalid promotion order: ${rule.sourceLayer}→${rule.targetLayer}`
      );
    }

    // Check source registration
    if (!this.registry.resolve(rule.sourceLayer, rule.sourceTable)) {
      validationErrors.push(
        `Source table '${rule.sourceTable}' not registered in ${rule.sourceLayer}`
      );
    }

    // Evaluate quality gates
    let qualityResults: QualityGateResult[] = [];
    if (rule.qualityGates.length > 0 && tableData.length > 0) {
      qualityResults = this.evaluator.evaluateGates(rule.qualityGates, tableData);
    }

    const blockingFailures = qualityResults.filter(
      (r) => !r.passed && r.gate.onFailure === 'block'
    );

    const wouldPromote =
      validationErrors.length === 0 && blockingFailures.length === 0;

    return { wouldPromote, qualityResults, validationErrors };
  }

  /** Expose the lineage tracker for inspection. */
  getLineageTracker(): LineageTracker {
    return this.lineageTracker;
  }

  /** Expose the audit log for inspection. */
  getAuditLog(): AuditLog {
    return this.auditLog;
  }
}
