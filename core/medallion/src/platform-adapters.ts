/**
 * @data-workers/medallion — Platform Adapters
 *
 * Stub adapters for Snowflake, Databricks, BigQuery, and dbt.
 * Each adapter implements MedallionPlatformAdapter for its platform.
 */

import type {
  MedallionLayer,
  MedallionPlatformAdapter,
  PromotionRule,
  PromotionResult,
} from './types.js';

// ─── Helper ──────────────────────────────────────────────────────────

function generatePromotionId(platform: string): string {
  return `promo_${platform}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function stubPromotionResult(
  rule: PromotionRule,
  promotionId: string
): PromotionResult {
  const rowsProcessed = Math.floor(Math.random() * 10000) + 1000;
  const rowsPromoted = Math.floor(rowsProcessed * 0.97);
  return {
    promotionId,
    rule,
    status: 'success',
    rowsProcessed,
    rowsPromoted,
    rowsQuarantined: rowsProcessed - rowsPromoted,
    qualityResults: [],
    durationMs: Math.floor(Math.random() * 2000) + 200,
    timestamp: Date.now(),
  };
}

// ─── Snowflake ───────────────────────────────────────────────────────

export class SnowflakeMedallionAdapter implements MedallionPlatformAdapter {
  name = 'snowflake';

  resolveLayerLocation(layer: MedallionLayer, table: string): string {
    return `${layer.toUpperCase()}_DB.PUBLIC.${table.toUpperCase()}`;
  }

  async executePromotion(rule: PromotionRule): Promise<PromotionResult> {
    const id = generatePromotionId('snowflake');
    return stubPromotionResult(rule, id);
  }

  async rollbackPromotion(_promotionId: string): Promise<void> {
    // Stub: would use Snowflake Time Travel
  }

  async compact(_layer: MedallionLayer, _table: string): Promise<void> {
    // Stub: Snowflake auto-compacts via micro-partitioning
  }
}

// ─── Databricks ──────────────────────────────────────────────────────

export class DatabricksMedallionAdapter implements MedallionPlatformAdapter {
  name = 'databricks';

  resolveLayerLocation(layer: MedallionLayer, table: string): string {
    return `${layer}_catalog.default.${table}`;
  }

  async executePromotion(rule: PromotionRule): Promise<PromotionResult> {
    const id = generatePromotionId('databricks');
    return stubPromotionResult(rule, id);
  }

  async rollbackPromotion(_promotionId: string): Promise<void> {
    // Stub: would use Delta Lake RESTORE TABLE
  }

  async compact(_layer: MedallionLayer, _table: string): Promise<void> {
    // Stub: OPTIMIZE table ZORDER BY (columns)
  }
}

// ─── BigQuery ────────────────────────────────────────────────────────

export class BigQueryMedallionAdapter implements MedallionPlatformAdapter {
  name = 'bigquery';

  resolveLayerLocation(layer: MedallionLayer, table: string): string {
    return `project.${layer}_dataset.${table}`;
  }

  async executePromotion(rule: PromotionRule): Promise<PromotionResult> {
    const id = generatePromotionId('bigquery');
    return stubPromotionResult(rule, id);
  }

  async rollbackPromotion(_promotionId: string): Promise<void> {
    // Stub: would use BigQuery snapshot decorators
  }

  async compact(_layer: MedallionLayer, _table: string): Promise<void> {
    // Stub: BigQuery auto-compacts
  }
}

// ─── dbt ─────────────────────────────────────────────────────────────

export class DbtMedallionAdapter implements MedallionPlatformAdapter {
  name = 'dbt';

  resolveLayerLocation(layer: MedallionLayer, table: string): string {
    return `{{ ref('${layer}_${table}') }}`;
  }

  async executePromotion(rule: PromotionRule): Promise<PromotionResult> {
    const id = generatePromotionId('dbt');
    // dbt promotions run via dbt build --select model
    return stubPromotionResult(rule, id);
  }

  async rollbackPromotion(_promotionId: string): Promise<void> {
    // Stub: dbt does not natively support rollback
  }

  async compact(_layer: MedallionLayer, _table: string): Promise<void> {
    // Stub: handled by underlying warehouse
  }
}
