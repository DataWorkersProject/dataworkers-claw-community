import { describe, it, expect, beforeEach } from 'vitest';
import { AgentStateMachine } from '../state-machine.js';
import type { AgentLifecycleConfig } from '../types.js';

const defaultConfig: AgentLifecycleConfig = {
  agentId: 'test-agent-1',
  agentType: 'pipeline',
  timeouts: {
    planningMs: 30_000,
    executionSimpleMs: 300_000,
    executionComplexMs: 1_800_000,
    validationMs: 120_000,
    llmCallMs: 60_000,
  },
  retry: { maxAttempts: 3, backoffMs: [1_000, 4_000, 16_000] },
  confidence: {
    proceedThreshold: 0.70,
    autoApplyThreshold: 0.85,
    semanticOverrideThreshold: 0.75,
  },
};

describe('AgentStateMachine', () => {
  let sm: AgentStateMachine;

  beforeEach(() => {
    sm = new AgentStateMachine({ ...defaultConfig });
  });

  // REQ-LIFE-001: Basic state machine
  it('starts in IDLE state', () => {
    expect(sm.getState()).toBe('IDLE');
  });

  it('follows happy path: IDLE -> QUEUED -> PLANNING -> EXECUTING -> VALIDATING -> COMPLETED', () => {
    sm.transition('QUEUED', 'event received');
    expect(sm.getState()).toBe('QUEUED');

    sm.transition('PLANNING', 'slot acquired');
    expect(sm.getState()).toBe('PLANNING');

    sm.transition('EXECUTING', 'plan approved', 0.85);
    expect(sm.getState()).toBe('EXECUTING');

    sm.transition('VALIDATING', 'execution complete');
    expect(sm.getState()).toBe('VALIDATING');

    sm.transition('COMPLETED', 'all gates passed');
    expect(sm.getState()).toBe('COMPLETED');
  });

  it('rejects invalid transitions', () => {
    expect(() => sm.transition('EXECUTING')).toThrow('Invalid state transition');
  });

  it('records transition history', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    const history = sm.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].from).toBe('IDLE');
    expect(history[0].to).toBe('QUEUED');
  });

  // REQ-LIFE-002: Confidence-gated transitions
  it('requires confidence >= 70% for PLANNING -> EXECUTING', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    expect(() => sm.transition('EXECUTING', 'low conf', 0.65)).toThrow('confidence');
  });

  it('allows PLANNING -> EXECUTING at exactly 70%', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.transition('EXECUTING', 'proceed', 0.70);
    expect(sm.getState()).toBe('EXECUTING');
  });

  it('allows PLANNING -> ESCALATED for low confidence', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.transition('ESCALATED', 'low_confidence');
    expect(sm.getState()).toBe('ESCALATED');
  });

  // REQ-LIFE-002: Retry with backoff
  it('allows FAILED -> QUEUED for retry (up to max)', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.transition('FAILED', 'error');
    sm.transition('QUEUED', 'retry 1');
    expect(sm.getRetryCount()).toBe(1);
  });

  it('prevents retry beyond max attempts', () => {
    // Build up retries: IDLE -> QUEUED -> PLANNING -> FAILED -> QUEUED(retry) ... repeat
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.transition('FAILED', 'error 0');
    sm.transition('QUEUED', 'retry 1'); // retryCount = 1

    sm.transition('PLANNING');
    sm.transition('FAILED', 'error 1');
    sm.transition('QUEUED', 'retry 2'); // retryCount = 2

    sm.transition('PLANNING');
    sm.transition('FAILED', 'error 2');
    sm.transition('QUEUED', 'retry 3'); // retryCount = 3

    sm.transition('PLANNING');
    sm.transition('FAILED', 'error 3');
    // 4th retry should be blocked (maxAttempts = 3)
    expect(() => sm.transition('QUEUED', 'retry 4')).toThrow('Max retries exceeded');
  });

  it('resets retry count on COMPLETED', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.transition('FAILED');
    sm.transition('QUEUED', 'retry');
    sm.transition('PLANNING');
    sm.transition('EXECUTING', 'ok', 0.85);
    sm.transition('VALIDATING');
    sm.transition('COMPLETED');
    expect(sm.getRetryCount()).toBe(0);
  });

  // REQ-LIFE-004: SUSPENDED state
  it('transitions to SUSPENDED from PLANNING', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.suspend('redis_disconnect');
    expect(sm.getState()).toBe('SUSPENDED');
  });

  it('resumes from SUSPENDED to PLANNING', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.suspend('redis_disconnect');
    sm.resume('PLANNING', 'redis_recovered');
    expect(sm.getState()).toBe('PLANNING');
  });

  it('escalates from SUSPENDED', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.suspend('redis_disconnect');
    sm.resume('ESCALATED', 'redis_timeout_30s');
    expect(sm.getState()).toBe('ESCALATED');
  });

  // REQ-LIFE-008: Bootstrap confidence elevation
  it('elevates confidence threshold during bootstrap', () => {
    const bootstrapConfig: AgentLifecycleConfig = {
      ...defaultConfig,
      bootstrap: {
        enabled: true,
        startedAt: Date.now(),
        durationMs: 30 * 24 * 60 * 60 * 1000,
        confidenceElevation: 15,
      },
    };
    const bsm = new AgentStateMachine(bootstrapConfig);
    // Effective threshold: 0.70 + 0.15 = 0.85
    expect(bsm.getEffectiveProceedThreshold()).toBe(0.85);
    expect(bsm.getEffectiveAutoApplyThreshold()).toBe(1.0); // capped at 1.0
  });

  it('does not elevate after bootstrap expires', () => {
    const bootstrapConfig: AgentLifecycleConfig = {
      ...defaultConfig,
      bootstrap: {
        enabled: true,
        startedAt: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
        durationMs: 30 * 24 * 60 * 60 * 1000,
        confidenceElevation: 15,
      },
    };
    const bsm = new AgentStateMachine(bootstrapConfig);
    expect(bsm.getEffectiveProceedThreshold()).toBe(0.70);
  });

  // VALIDATING -> EXECUTING (re-run)
  it('allows VALIDATING -> EXECUTING for re-validation', () => {
    sm.transition('QUEUED');
    sm.transition('PLANNING');
    sm.transition('EXECUTING', 'proceed', 0.85);
    sm.transition('VALIDATING');
    sm.transition('EXECUTING', 're-run', 0.85);
    expect(sm.getState()).toBe('EXECUTING');
  });
});
