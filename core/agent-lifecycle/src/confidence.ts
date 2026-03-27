import type { ConfidenceConfig, BootstrapConfig } from './types.js';

/**
 * Confidence scoring system for agent decision-making (REQ-LIFE-007).
 *
 * Three independent thresholds:
 * - 70% (proceedThreshold): Can the agent proceed from PLANNING to EXECUTING?
 * - 85% (autoApplyThreshold): Can the action be auto-applied without human review?
 * - 75% (semanticOverrideThreshold): Override when no semantic layer is present
 *
 * During bootstrap (REQ-LIFE-008), all thresholds elevated by 15 points.
 */
export class ConfidenceScorer {
  private config: ConfidenceConfig;
  private bootstrap?: BootstrapConfig;

  constructor(config: ConfidenceConfig, bootstrap?: BootstrapConfig) {
    this.config = config;
    this.bootstrap = bootstrap;
  }

  /**
   * Whether confidence is high enough to proceed to execution (>= 70%).
   */
  canProceed(score: number): boolean {
    return score >= this.getEffectiveThreshold(this.config.proceedThreshold);
  }

  /**
   * Whether confidence is high enough to auto-apply without human review (>= 85%).
   */
  canAutoApply(score: number): boolean {
    return score >= this.getEffectiveThreshold(this.config.autoApplyThreshold);
  }

  /**
   * Whether confidence meets the semantic override threshold (>= 75%).
   * Used when no semantic layer is present.
   */
  meetsSemanticOverride(score: number): boolean {
    return score >= this.getEffectiveThreshold(this.config.semanticOverrideThreshold);
  }

  /**
   * Get the action recommendation for a given confidence score.
   *
   * - 'reject': confidence < 70% — do not execute
   * - 'human-review': 70% <= confidence < 85% — execute but route output to human
   * - 'auto-apply': confidence >= 85% — execute and auto-apply
   */
  recommend(score: number): 'reject' | 'human-review' | 'auto-apply' {
    if (!this.canProceed(score)) return 'reject';
    if (this.canAutoApply(score)) return 'auto-apply';
    return 'human-review';
  }

  /**
   * Get the action recommendation when no semantic layer is present.
   * Uses semanticOverrideThreshold (75%) instead of autoApplyThreshold (85%).
   */
  recommendWithoutSemanticLayer(score: number): 'reject' | 'human-review' | 'auto-apply' {
    if (!this.canProceed(score)) return 'reject';
    if (this.meetsSemanticOverride(score)) return 'auto-apply';
    return 'human-review';
  }

  /**
   * Get effective threshold accounting for bootstrap elevation.
   */
  private getEffectiveThreshold(base: number): number {
    return Math.min(1.0, base + this.getBootstrapElevation());
  }

  /**
   * Get bootstrap elevation (0 if not in bootstrap or expired).
   */
  private getBootstrapElevation(): number {
    if (!this.bootstrap?.enabled) return 0;
    const elapsed = Date.now() - this.bootstrap.startedAt;
    if (elapsed >= this.bootstrap.durationMs) return 0;
    return this.bootstrap.confidenceElevation / 100;
  }
}
