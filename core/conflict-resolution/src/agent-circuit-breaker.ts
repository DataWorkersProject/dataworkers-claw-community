/**
 * Per-Agent Circuit Breaker (REQ-CONFL-007).
 *
 * 5 consecutive failures in 10-minute window -> OPEN.
 * Resets after manual review or 30 minutes with probe task.
 */

export type AgentCBState = 'closed' | 'open' | 'half-open';

export class AgentCircuitBreaker {
  private states = new Map<string, { state: AgentCBState; failures: number; openedAt: number }>;
  private maxFailures: number;
  private windowMs: number;
  private resetMs: number;

  constructor(maxFailures = 5, windowMs = 600_000, resetMs = 1_800_000) {
    this.states = new Map();
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.resetMs = resetMs;
  }

  recordFailure(agentId: string): AgentCBState {
    const entry = this.states.get(agentId) ?? { state: 'closed' as AgentCBState, failures: 0, openedAt: 0 };
    entry.failures++;
    if (entry.failures >= this.maxFailures) {
      entry.state = 'open';
      entry.openedAt = Date.now();
    }
    this.states.set(agentId, entry);
    return entry.state;
  }

  recordSuccess(agentId: string): void {
    this.states.set(agentId, { state: 'closed', failures: 0, openedAt: 0 });
  }

  getState(agentId: string): AgentCBState {
    const entry = this.states.get(agentId);
    if (!entry) return 'closed';
    if (entry.state === 'open' && Date.now() - entry.openedAt > this.resetMs) {
      entry.state = 'half-open';
    }
    return entry.state;
  }

  isOpen(agentId: string): boolean {
    return this.getState(agentId) === 'open';
  }

  reset(agentId: string): void {
    this.states.delete(agentId);
  }
}
