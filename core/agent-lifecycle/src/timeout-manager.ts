import type { PhaseTimeouts, AgentState } from './types.js';

/**
 * Manages phase-specific timeouts (REQ-LIFE-003, REQ-LIFE-005).
 *
 * Default timeouts:
 * - Planning: 30s
 * - Execution (simple): 5min
 * - Execution (complex): 30min
 * - Validation: 2min
 * - LLM call: 60s
 */
export class TimeoutManager {
  private config: PhaseTimeouts;
  private activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(config?: Partial<PhaseTimeouts>) {
    this.config = {
      planningMs: config?.planningMs ?? 30_000,
      executionSimpleMs: config?.executionSimpleMs ?? 300_000,
      executionComplexMs: config?.executionComplexMs ?? 1_800_000,
      validationMs: config?.validationMs ?? 120_000,
      llmCallMs: config?.llmCallMs ?? 60_000,
    };
  }

  /**
   * Get the timeout for a given agent state and complexity.
   */
  getTimeoutForPhase(state: AgentState, isComplex = false): number {
    switch (state) {
      case 'PLANNING':
        return this.config.planningMs;
      case 'EXECUTING':
        return isComplex ? this.config.executionComplexMs : this.config.executionSimpleMs;
      case 'VALIDATING':
        return this.config.validationMs;
      default:
        return 0; // No timeout for non-active states
    }
  }

  /**
   * Get the LLM call timeout (REQ-LIFE-005: 60s).
   */
  getLlmTimeout(): number {
    return this.config.llmCallMs;
  }

  /**
   * Execute a function with a phase timeout.
   */
  async withPhaseTimeout<T>(
    phase: AgentState,
    fn: () => Promise<T>,
    isComplex = false,
  ): Promise<T> {
    const timeoutMs = this.getTimeoutForPhase(phase, isComplex);
    if (timeoutMs === 0) return fn();
    return this.withTimeout(fn(), timeoutMs, `${phase} phase`);
  }

  /**
   * Execute a function with the LLM call timeout.
   */
  async withLlmTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return this.withTimeout(fn(), this.config.llmCallMs, 'LLM call');
  }

  /**
   * Start a named timer that fires a callback on timeout.
   */
  startTimer(name: string, timeoutMs: number, onTimeout: () => void): void {
    this.cancelTimer(name);
    const timer = setTimeout(() => {
      this.activeTimers.delete(name);
      onTimeout();
    }, timeoutMs);
    this.activeTimers.set(name, timer);
  }

  /**
   * Cancel a named timer.
   */
  cancelTimer(name: string): void {
    const timer = this.activeTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(name);
    }
  }

  /**
   * Cancel all active timers.
   */
  cancelAll(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }
}
