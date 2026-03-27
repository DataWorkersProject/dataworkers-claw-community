import { describe, it, expect } from 'vitest';
import { AgentCircuitBreaker } from '../agent-circuit-breaker.js';

describe('AgentCircuitBreaker (REQ-CONFL-007)', () => {
  it('starts in closed state', () => {
    const cb = new AgentCircuitBreaker();
    expect(cb.getState('agent-1')).toBe('closed');
    expect(cb.isOpen('agent-1')).toBe(false);
  });

  it('transitions to open after N consecutive failures', () => {
    const cb = new AgentCircuitBreaker(3); // 3 failures to trip
    cb.recordFailure('agent-1');
    cb.recordFailure('agent-1');
    expect(cb.getState('agent-1')).toBe('closed');
    cb.recordFailure('agent-1');
    expect(cb.getState('agent-1')).toBe('open');
    expect(cb.isOpen('agent-1')).toBe(true);
  });

  it('success resets to closed', () => {
    const cb = new AgentCircuitBreaker(2);
    cb.recordFailure('agent-1');
    cb.recordFailure('agent-1');
    expect(cb.isOpen('agent-1')).toBe(true);
    cb.recordSuccess('agent-1');
    expect(cb.getState('agent-1')).toBe('closed');
    expect(cb.isOpen('agent-1')).toBe(false);
  });

  it('reset clears state completely', () => {
    const cb = new AgentCircuitBreaker(2);
    cb.recordFailure('agent-1');
    cb.recordFailure('agent-1');
    cb.reset('agent-1');
    expect(cb.getState('agent-1')).toBe('closed');
  });

  it('agents are independent', () => {
    const cb = new AgentCircuitBreaker(2);
    cb.recordFailure('agent-1');
    cb.recordFailure('agent-1');
    expect(cb.isOpen('agent-1')).toBe(true);
    expect(cb.isOpen('agent-2')).toBe(false);
  });

  it('half-open after reset timeout', async () => {
    const cb = new AgentCircuitBreaker(1, 600_000, 1); // 1ms reset
    cb.recordFailure('agent-1');
    expect(cb.getState('agent-1')).toBe('open');
    // Wait just over 1ms for half-open transition
    await new Promise((r) => setTimeout(r, 5));
    expect(cb.getState('agent-1')).toBe('half-open');
  });

  it('default config: 5 failures, 10min window, 30min reset', () => {
    const cb = new AgentCircuitBreaker();
    // Should take 5 failures to open
    for (let i = 0; i < 4; i++) cb.recordFailure('agent-1');
    expect(cb.isOpen('agent-1')).toBe(false);
    cb.recordFailure('agent-1');
    expect(cb.isOpen('agent-1')).toBe(true);
  });

  it('half-open transitions to closed on success', async () => {
    const cb = new AgentCircuitBreaker(1, 600_000, 1);
    cb.recordFailure('agent-1');
    await new Promise((r) => setTimeout(r, 5));
    expect(cb.getState('agent-1')).toBe('half-open');
    cb.recordSuccess('agent-1');
    expect(cb.getState('agent-1')).toBe('closed');
  });
});
