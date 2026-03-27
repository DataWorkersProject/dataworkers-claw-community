import { describe, it, expect } from 'vitest';
import { ConfidenceScorer } from '../confidence.js';

const defaultConfig = {
  proceedThreshold: 0.70,
  autoApplyThreshold: 0.85,
  semanticOverrideThreshold: 0.75,
};

describe('ConfidenceScorer', () => {
  const scorer = new ConfidenceScorer(defaultConfig);

  // REQ-LIFE-007: Three thresholds
  it('rejects below 70%', () => {
    expect(scorer.canProceed(0.65)).toBe(false);
    expect(scorer.recommend(0.65)).toBe('reject');
  });

  it('allows proceed at exactly 70%', () => {
    expect(scorer.canProceed(0.70)).toBe(true);
  });

  it('routes to human review between 70-85%', () => {
    expect(scorer.recommend(0.75)).toBe('human-review');
    expect(scorer.canProceed(0.75)).toBe(true);
    expect(scorer.canAutoApply(0.75)).toBe(false);
  });

  it('auto-applies at 85%+', () => {
    expect(scorer.recommend(0.85)).toBe('auto-apply');
    expect(scorer.canAutoApply(0.85)).toBe(true);
  });

  it('auto-applies at 95%', () => {
    expect(scorer.recommend(0.95)).toBe('auto-apply');
  });

  // Semantic override
  it('semantic override at 75%', () => {
    expect(scorer.meetsSemanticOverride(0.75)).toBe(true);
    expect(scorer.meetsSemanticOverride(0.74)).toBe(false);
  });

  it('recommendWithoutSemanticLayer uses 75% threshold', () => {
    expect(scorer.recommendWithoutSemanticLayer(0.65)).toBe('reject');
    expect(scorer.recommendWithoutSemanticLayer(0.72)).toBe('human-review');
    expect(scorer.recommendWithoutSemanticLayer(0.75)).toBe('auto-apply');
  });

  // Bootstrap elevation
  it('elevates thresholds during bootstrap', () => {
    const bootstrapScorer = new ConfidenceScorer(defaultConfig, {
      enabled: true,
      startedAt: Date.now(),
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
    });
    // 70% + 15% = 85% effective proceed threshold
    expect(bootstrapScorer.canProceed(0.80)).toBe(false);
    expect(bootstrapScorer.canProceed(0.85)).toBe(true);
    expect(bootstrapScorer.recommend(0.85)).toBe('human-review');
    // auto-apply would be 85% + 15% = 100%, capped at 100%
    expect(bootstrapScorer.recommend(0.99)).toBe('human-review');
    expect(bootstrapScorer.recommend(1.0)).toBe('auto-apply');
  });

  it('no elevation after bootstrap expires', () => {
    const expiredScorer = new ConfidenceScorer(defaultConfig, {
      enabled: true,
      startedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
    });
    expect(expiredScorer.canProceed(0.70)).toBe(true);
    expect(expiredScorer.recommend(0.85)).toBe('auto-apply');
  });
});
