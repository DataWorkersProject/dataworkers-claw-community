import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ maxFailures: 3, windowMs: 60_000, resetMs: 1_000 });
  });

  it('starts in closed state', () => {
    expect(cb.getState()).toBe('closed');
    expect(cb.isOpen()).toBe(false);
  });

  it('remains closed below failure threshold', () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('closed');
    expect(cb.getFailureCount()).toBe(2);
  });

  it('opens after reaching failure threshold (REQ-MCP-005: 3 failures/60s)', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    expect(cb.isOpen()).toBe(true);
  });

  it('resets on success', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.getState()).toBe('closed');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('transitions to half-open after cooldown', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('open');

    // Wait for reset period
    await new Promise((r) => setTimeout(r, 1_100));
    expect(cb.getState()).toBe('half-open');
  });

  it('manual reset works', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    cb.reset();
    expect(cb.getState()).toBe('closed');
  });

  it('uses default config when none provided', () => {
    const defaultCb = new CircuitBreaker();
    expect(defaultCb.getState()).toBe('closed');
    defaultCb.recordFailure();
    defaultCb.recordFailure();
    defaultCb.recordFailure();
    expect(defaultCb.getState()).toBe('open');
  });

  // Per-tool isolation test
  it('separate breakers are independent (per-tool isolation)', () => {
    const breakerA = new CircuitBreaker({ maxFailures: 3, windowMs: 60_000, resetMs: 1_000 });
    const breakerB = new CircuitBreaker({ maxFailures: 3, windowMs: 60_000, resetMs: 1_000 });

    // Trip breaker A
    breakerA.recordFailure();
    breakerA.recordFailure();
    breakerA.recordFailure();
    expect(breakerA.isOpen()).toBe(true);

    // Breaker B should still be closed
    expect(breakerB.isOpen()).toBe(false);
    expect(breakerB.getState()).toBe('closed');

    // Successes on B don't affect A
    breakerB.recordSuccess();
    expect(breakerA.isOpen()).toBe(true);
  });
});
