import type { AgentType, BootstrapConfig, BootstrapRules } from './types.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Bootstrap manager for new customer onboarding (REQ-LIFE-008).
 *
 * Per-agent bootstrap behaviors:
 * - Quality: learning-only for 7 days
 * - Incident: rule-based until 50+ historical incidents
 * - Schema: full initial crawl first
 * - Context-Catalog: initial discovery crawl (<4h for 10K tables)
 * - Pipeline: requires >= 1 sample pipeline
 * - All agents: +15 confidence points for first 30 days
 */
export class BootstrapManager {
  private config: BootstrapConfig;

  constructor(config: BootstrapConfig) {
    this.config = config;
  }

  /**
   * Create a default bootstrap config for a new customer.
   */
  static createForNewCustomer(agentType: AgentType): BootstrapConfig {
    return {
      enabled: true,
      startedAt: Date.now(),
      durationMs: THIRTY_DAYS_MS,
      confidenceElevation: 15,
      rules: BootstrapManager.getDefaultRules(agentType),
    };
  }

  /**
   * Get default bootstrap rules for a given agent type.
   */
  static getDefaultRules(agentType: AgentType): BootstrapRules {
    switch (agentType) {
      case 'quality':
        return { learningPeriodMs: SEVEN_DAYS_MS };
      case 'incident':
        return { minHistoricalIncidents: 50 };
      case 'pipeline':
        return { requireSamplePipeline: true };
      case 'context-catalog':
        return { initialCrawlTargetMs: FOUR_HOURS_MS };
      default:
        return {};
    }
  }

  /**
   * Whether the agent is still in bootstrap mode.
   */
  isInBootstrap(): boolean {
    if (!this.config.enabled) return false;
    const elapsed = Date.now() - this.config.startedAt;
    return elapsed < this.config.durationMs;
  }

  /**
   * Get the confidence elevation during bootstrap.
   */
  getConfidenceElevation(): number {
    return this.isInBootstrap() ? this.config.confidenceElevation : 0;
  }

  /**
   * Whether the quality agent is still in learning-only mode.
   */
  isInLearningPeriod(): boolean {
    if (!this.config.rules?.learningPeriodMs) return false;
    if (!this.isInBootstrap()) return false;
    const elapsed = Date.now() - this.config.startedAt;
    return elapsed < this.config.rules.learningPeriodMs;
  }

  /**
   * Whether the incident agent can use ML-based detection.
   */
  canUseMLDetection(historicalIncidentCount: number): boolean {
    const minRequired = this.config.rules?.minHistoricalIncidents ?? 50;
    return historicalIncidentCount >= minRequired;
  }

  /**
   * Whether the pipeline agent has the required sample pipeline.
   */
  hasSamplePipeline(pipelineCount: number): boolean {
    if (!this.config.rules?.requireSamplePipeline) return true;
    return pipelineCount >= 1;
  }

  /**
   * Get remaining bootstrap time in ms.
   */
  getRemainingMs(): number {
    if (!this.isInBootstrap()) return 0;
    const elapsed = Date.now() - this.config.startedAt;
    return Math.max(0, this.config.durationMs - elapsed);
  }

  /**
   * Get bootstrap progress as a percentage (0-100).
   */
  getProgress(): number {
    if (!this.config.enabled) return 100;
    const elapsed = Date.now() - this.config.startedAt;
    return Math.min(100, (elapsed / this.config.durationMs) * 100);
  }
}
