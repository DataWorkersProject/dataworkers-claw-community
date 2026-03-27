import type { AgentState, StateTransition, AgentLifecycleConfig, EscalationReason } from './types.js';

export { type AgentState } from './types.js';

/**
 * Deterministic agent lifecycle state machine (REQ-LIFE-001, REQ-LIFE-002).
 *
 * States: IDLE -> QUEUED -> PLANNING -> EXECUTING -> VALIDATING -> COMPLETED/FAILED/ESCALATED/SUSPENDED
 *
 * Key transitions:
 * - PLANNING -> EXECUTING: requires confidence >= 70% (REQ-LIFE-002)
 * - PLANNING -> ESCALATED: confidence < 70%
 * - PLANNING -> SUSPENDED: Redis disconnect (REQ-LIFE-004)
 * - FAILED -> QUEUED: retry (max 3 with backoff)
 * - Any -> SUSPENDED: infrastructure failure
 */
export class AgentStateMachine {
  private state: AgentState = 'IDLE';
  private history: StateTransition[] = [];
  private config: AgentLifecycleConfig;
  private retryCount = 0;

  /**
   * Valid state transitions. Each state maps to its allowed target states.
   */
  private static VALID_TRANSITIONS: Record<AgentState, AgentState[]> = {
    IDLE: ['QUEUED'],
    QUEUED: ['PLANNING'],
    PLANNING: ['EXECUTING', 'FAILED', 'ESCALATED', 'SUSPENDED'],
    EXECUTING: ['VALIDATING', 'FAILED', 'ESCALATED', 'SUSPENDED'],
    VALIDATING: ['COMPLETED', 'FAILED', 'ESCALATED', 'EXECUTING'],
    COMPLETED: ['IDLE'],
    FAILED: ['IDLE', 'QUEUED'],
    ESCALATED: ['IDLE'],
    SUSPENDED: ['PLANNING', 'EXECUTING', 'VALIDATING', 'ESCALATED', 'IDLE'],
  };

  constructor(config: AgentLifecycleConfig) {
    this.config = config;
  }

  getState(): AgentState {
    return this.state;
  }

  getHistory(): StateTransition[] {
    return [...this.history];
  }

  getConfig(): AgentLifecycleConfig {
    return this.config;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Transition to a new state. Validates the transition is allowed.
   * For PLANNING -> EXECUTING, requires confidence score >= proceedThreshold.
   */
  transition(to: AgentState, reason?: string, confidence?: number): void {
    const validTargets = AgentStateMachine.VALID_TRANSITIONS[this.state];
    if (!validTargets || !validTargets.includes(to)) {
      throw new Error(
        `Invalid state transition: ${this.state} -> ${to}. Valid targets: ${(validTargets || []).join(', ')}`,
      );
    }

    // REQ-LIFE-002: Confidence gate for PLANNING -> EXECUTING
    if (this.state === 'PLANNING' && to === 'EXECUTING') {
      const threshold = this.getEffectiveProceedThreshold();
      if (confidence === undefined || confidence < threshold) {
        throw new Error(
          `Cannot transition PLANNING -> EXECUTING: confidence ${confidence ?? 'undefined'} < threshold ${threshold}. Use ESCALATED for low confidence.`,
        );
      }
    }

    // Track retries
    if (this.state === 'FAILED' && to === 'QUEUED') {
      this.retryCount++;
      if (this.retryCount > this.config.retry.maxAttempts) {
        throw new Error(
          `Max retries exceeded (${this.config.retry.maxAttempts}). Transition to ESCALATED instead.`,
        );
      }
    }

    // Reset retry count on success
    if (to === 'COMPLETED' || to === 'IDLE') {
      this.retryCount = 0;
    }

    const transition: StateTransition = {
      from: this.state,
      to,
      timestamp: Date.now(),
      reason,
      confidence,
    };

    this.history.push(transition);
    this.state = to;
  }

  /**
   * Check if a transition is valid from the current state.
   */
  canTransition(to: AgentState): boolean {
    const validTargets = AgentStateMachine.VALID_TRANSITIONS[this.state];
    return validTargets ? validTargets.includes(to) : false;
  }

  /**
   * Transition to SUSPENDED state (infrastructure failure).
   * REQ-LIFE-004: Redis disconnect during PLANNING.
   */
  suspend(reason: EscalationReason): void {
    if (!this.canTransition('SUSPENDED')) {
      throw new Error(`Cannot suspend from state ${this.state}`);
    }
    this.transition('SUSPENDED', reason);
  }

  /**
   * Resume from SUSPENDED state to the previous active state.
   */
  resume(toState: AgentState, reason?: string): void {
    if (this.state !== 'SUSPENDED') {
      throw new Error(`Cannot resume: not in SUSPENDED state (current: ${this.state})`);
    }
    this.transition(toState, reason ?? 'resumed_from_suspension');
  }

  /**
   * Get the effective proceed threshold, accounting for bootstrap elevation.
   * REQ-LIFE-008: +15 percentage points during bootstrap.
   */
  getEffectiveProceedThreshold(): number {
    const base = this.config.confidence.proceedThreshold;
    return Math.min(1.0, base + this.getBootstrapElevation());
  }

  /**
   * Get the effective auto-apply threshold, accounting for bootstrap elevation.
   */
  getEffectiveAutoApplyThreshold(): number {
    const base = this.config.confidence.autoApplyThreshold;
    return Math.min(1.0, base + this.getBootstrapElevation());
  }

  /**
   * Get bootstrap confidence elevation (0 if not in bootstrap or expired).
   * REQ-LIFE-008: +15 points for first 30 days.
   */
  private getBootstrapElevation(): number {
    const bootstrap = this.config.bootstrap;
    if (!bootstrap?.enabled) return 0;

    const elapsed = Date.now() - bootstrap.startedAt;
    if (elapsed >= bootstrap.durationMs) return 0;

    return bootstrap.confidenceElevation / 100;
  }
}
