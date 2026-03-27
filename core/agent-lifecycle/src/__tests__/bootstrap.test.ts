import { describe, it, expect } from 'vitest';
import { BootstrapManager } from '../bootstrap.js';

describe('BootstrapManager', () => {
  it('creates config for new customer', () => {
    const config = BootstrapManager.createForNewCustomer('pipeline');
    expect(config.enabled).toBe(true);
    expect(config.confidenceElevation).toBe(15);
    expect(config.rules?.requireSamplePipeline).toBe(true);
  });

  it('creates quality-specific bootstrap rules', () => {
    const config = BootstrapManager.createForNewCustomer('quality');
    expect(config.rules?.learningPeriodMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('creates incident-specific bootstrap rules', () => {
    const config = BootstrapManager.createForNewCustomer('incident');
    expect(config.rules?.minHistoricalIncidents).toBe(50);
  });

  it('is in bootstrap when within duration', () => {
    const bm = new BootstrapManager({
      enabled: true,
      startedAt: Date.now(),
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
    });
    expect(bm.isInBootstrap()).toBe(true);
    expect(bm.getConfidenceElevation()).toBe(15);
  });

  it('is not in bootstrap when expired', () => {
    const bm = new BootstrapManager({
      enabled: true,
      startedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
    });
    expect(bm.isInBootstrap()).toBe(false);
    expect(bm.getConfidenceElevation()).toBe(0);
  });

  it('tracks learning period for quality agent', () => {
    const bm = new BootstrapManager({
      enabled: true,
      startedAt: Date.now(),
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
      rules: { learningPeriodMs: 7 * 24 * 60 * 60 * 1000 },
    });
    expect(bm.isInLearningPeriod()).toBe(true);
  });

  it('learning period expires after 7 days', () => {
    const bm = new BootstrapManager({
      enabled: true,
      startedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
      rules: { learningPeriodMs: 7 * 24 * 60 * 60 * 1000 },
    });
    expect(bm.isInLearningPeriod()).toBe(false);
    expect(bm.isInBootstrap()).toBe(true); // Still in 30-day bootstrap
  });

  it('checks ML detection readiness for incident agent', () => {
    const bm = new BootstrapManager({
      enabled: true,
      startedAt: Date.now(),
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
      rules: { minHistoricalIncidents: 50 },
    });
    expect(bm.canUseMLDetection(30)).toBe(false);
    expect(bm.canUseMLDetection(50)).toBe(true);
    expect(bm.canUseMLDetection(100)).toBe(true);
  });

  it('checks sample pipeline for pipeline agent', () => {
    const bm = new BootstrapManager({
      enabled: true,
      startedAt: Date.now(),
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
      rules: { requireSamplePipeline: true },
    });
    expect(bm.hasSamplePipeline(0)).toBe(false);
    expect(bm.hasSamplePipeline(1)).toBe(true);
  });

  it('tracks progress percentage', () => {
    const bm = new BootstrapManager({
      enabled: true,
      startedAt: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
    });
    const progress = bm.getProgress();
    expect(progress).toBeGreaterThan(45);
    expect(progress).toBeLessThan(55);
  });

  it('disabled bootstrap returns 0 elevation', () => {
    const bm = new BootstrapManager({
      enabled: false,
      startedAt: Date.now(),
      durationMs: 30 * 24 * 60 * 60 * 1000,
      confidenceElevation: 15,
    });
    expect(bm.isInBootstrap()).toBe(false);
    expect(bm.getConfidenceElevation()).toBe(0);
  });
});
