/**
 * @data-workers/medallion — Iceberg Adapter
 *
 * Iceberg platform adapter using branch-based promotion.
 * - Creates a branch for each promotion
 * - Writes promoted data to the branch
 * - Runs quality gates on the branch
 * - Fast-forward merges on success
 * - Drops the branch on failure
 */

import type {
  MedallionLayer,
  MedallionPlatformAdapter,
  PromotionRule,
  PromotionResult,
} from './types.js';

export class IcebergMedallionAdapter implements MedallionPlatformAdapter {
  name = 'iceberg';

  private rollbackLog: Map<string, PromotionRule> = new Map();

  /** Resolve fully-qualified Iceberg location for a layer + table. */
  resolveLayerLocation(layer: MedallionLayer, table: string): string {
    return `${layer}_db.default.${table}`;
  }

  /**
   * Execute a promotion via Iceberg branching.
   * Stub implementation — returns success with simulated metrics.
   */
  async executePromotion(rule: PromotionRule): Promise<PromotionResult> {
    const promotionId = `promo_iceberg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Simulate branch-based promotion workflow
    const rowsProcessed = Math.floor(Math.random() * 10000) + 1000;
    const rowsPromoted = Math.floor(rowsProcessed * 0.98); // ~2% filtered
    const rowsQuarantined = rowsProcessed - rowsPromoted;

    const startTime = Date.now();

    // Store for potential rollback
    this.rollbackLog.set(promotionId, rule);

    return {
      promotionId,
      rule,
      status: 'success',
      rowsProcessed,
      rowsPromoted,
      rowsQuarantined,
      qualityResults: [],
      durationMs: Date.now() - startTime + Math.floor(Math.random() * 500),
      timestamp: Date.now(),
    };
  }

  /** Rollback a promotion by dropping the promotion branch. */
  async rollbackPromotion(promotionId: string): Promise<void> {
    this.rollbackLog.delete(promotionId);
    // In production: DROP BRANCH promotion_{id} IN table
  }

  /** Compact small files in an Iceberg table. */
  async compact(layer: MedallionLayer, table: string): Promise<void> {
    // In production: CALL system.rewrite_data_files(table => '...')
    this.resolveLayerLocation(layer, table);
    // Stub: no-op
  }
}
