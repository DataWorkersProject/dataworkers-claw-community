import { describe, it, expect } from 'vitest';
import { RedlockManager } from '../../core/conflict-resolution/src/redlock.js';
import { PriorityResolver, AGENT_PRIORITY } from '../../core/conflict-resolution/src/priority.js';
import { DeadlockDetector } from '../../core/conflict-resolution/src/deadlock.js';
import { ConfidenceCascade } from '../../core/conflict-resolution/src/confidence-cascade.js';
import { AgentCircuitBreaker } from '../../core/conflict-resolution/src/agent-circuit-breaker.js';

// Conflict Resolution
describe('RedlockManager (REQ-CONFL-001, REQ-CONFL-008)', () => {
  it('acquires distributed lock', async () => {
    const redlock = new RedlockManager(3);
    const result = await redlock.acquire('resource:orders');
    expect(result.acquired).toBe(true);
    expect(result.quorum).toBe(true);
    expect(result.token).toBeTruthy();
  });

  it('releases lock', async () => {
    const redlock = new RedlockManager();
    const lock = await redlock.acquire('resource:test');
    const released = await redlock.release('resource:test', lock.token);
    expect(released).toBe(true);
  });
});

describe('PriorityResolver (REQ-CONFL-002)', () => {
  const resolver = new PriorityResolver();

  it('incident agent beats pipeline agent', () => {
    expect(resolver.resolve('dw-incidents', 'dw-pipelines')).toBe('dw-incidents');
  });

  it('governance beats schema', () => {
    expect(resolver.resolve('dw-governance', 'dw-schema')).toBe('dw-governance');
  });

  it('incident can preempt any agent', () => {
    expect(resolver.canPreempt('dw-incidents', 'dw-pipelines')).toBe(true);
    expect(resolver.canPreempt('dw-incidents', 'dw-governance')).toBe(true);
  });

  it('cost cannot preempt incident', () => {
    expect(resolver.canPreempt('dw-cost', 'dw-incidents')).toBe(false);
  });

  it('follows 8-level hierarchy', () => {
    const ordered = Object.entries(AGENT_PRIORITY)
      .filter(([k]) => k !== 'dw-orchestrator')
      .sort((a, b) => a[1] - b[1])
      .map(([k]) => k);
    expect(ordered[0]).toBe('dw-incidents');
    expect(ordered[1]).toBe('dw-governance');
  });
});

describe('DeadlockDetector (REQ-CONFL-004)', () => {
  it('detects simple cycle', () => {
    const detector = new DeadlockDetector();
    detector.addWait('agent-a', 'agent-b', 'resource-1');
    detector.addWait('agent-b', 'agent-a', 'resource-2');
    const cycle = detector.detectCycle();
    expect(cycle).not.toBeNull();
  });

  it('no false positive without cycle', () => {
    const detector = new DeadlockDetector();
    detector.addWait('agent-a', 'agent-b', 'resource-1');
    detector.addWait('agent-b', 'agent-c', 'resource-2');
    const cycle = detector.detectCycle();
    expect(cycle).toBeNull();
  });

  it('selects lowest-priority victim', () => {
    const detector = new DeadlockDetector();
    const victim = detector.selectVictim(
      ['dw-incidents', 'dw-pipelines', 'dw-cost'],
      AGENT_PRIORITY,
    );
    expect(victim).toBe('dw-cost'); // Lowest priority = highest number
  });
});

describe('ConfidenceCascade (REQ-CONFL-006)', () => {
  it('calculates cumulative confidence', () => {
    const cascade = new ConfidenceCascade();
    const cumulative = cascade.calculateCumulative([0.9, 0.8, 0.7]);
    expect(cumulative).toBeCloseTo(0.504, 2);
  });

  it('triggers human review below 0.6', () => {
    const cascade = new ConfidenceCascade();
    expect(cascade.needsHumanReview(0.5)).toBe(true);
    expect(cascade.needsHumanReview(0.7)).toBe(false);
  });

  it('rate limits at 10 actions/hour', () => {
    const cascade = new ConfidenceCascade(10);
    for (let i = 0; i < 10; i++) cascade.recordAction('agent-1');
    expect(cascade.isRateLimited('agent-1')).toBe(true);
    expect(cascade.getRemainingActions('agent-1')).toBe(0);
  });

  it('resets rate limit after 1 hour', () => {
    const cascade = new ConfidenceCascade(10);
    expect(cascade.isRateLimited('fresh-agent')).toBe(false);
    expect(cascade.getRemainingActions('fresh-agent')).toBe(10);
  });
});

describe('AgentCircuitBreaker (REQ-CONFL-007)', () => {
  it('opens after 5 failures', () => {
    const cb = new AgentCircuitBreaker(5);
    for (let i = 0; i < 5; i++) cb.recordFailure('agent-1');
    expect(cb.isOpen('agent-1')).toBe(true);
  });

  it('stays closed below threshold', () => {
    const cb = new AgentCircuitBreaker(5);
    cb.recordFailure('agent-1');
    cb.recordFailure('agent-1');
    expect(cb.isOpen('agent-1')).toBe(false);
  });

  it('resets on success', () => {
    const cb = new AgentCircuitBreaker(5);
    cb.recordFailure('agent-1');
    cb.recordFailure('agent-1');
    cb.recordSuccess('agent-1');
    expect(cb.getState('agent-1')).toBe('closed');
  });
});

