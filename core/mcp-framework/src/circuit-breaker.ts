import type { CircuitBreakerConfig } from './types.js';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker for MCP server connections (REQ-MCP-005).
 *
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests rejected immediately
 * - HALF-OPEN: After cooldown, allows one probe request
 *
 * Default: 3 failures in 60s window trips the breaker.
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private failures: number[] = [];
  private state: CircuitBreakerState = 'closed';
  private openedAt = 0;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      maxFailures: config?.maxFailures ?? 3,
      windowMs: config?.windowMs ?? 60_000,
      resetMs: config?.resetMs ?? 30_000,
    };
  }

  getState(): CircuitBreakerState {
    this.checkHalfOpen();
    return this.state;
  }

  isOpen(): boolean {
    this.checkHalfOpen();
    return this.state === 'open';
  }

  /**
   * Record a successful operation. Resets failure count and closes circuit.
   */
  recordSuccess(): void {
    this.failures = [];
    this.state = 'closed';
  }

  /**
   * Record a failed operation. Opens circuit if threshold exceeded.
   */
  recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);

    // Remove failures outside the window
    const windowStart = now - this.config.windowMs;
    this.failures = this.failures.filter((t) => t >= windowStart);

    if (this.failures.length >= this.config.maxFailures) {
      this.state = 'open';
      this.openedAt = now;
    }
  }

  /**
   * Reset the circuit breaker to closed state.
   */
  reset(): void {
    this.failures = [];
    this.state = 'closed';
    this.openedAt = 0;
  }

  /**
   * Get current failure count within the window.
   */
  getFailureCount(): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    this.failures = this.failures.filter((t) => t >= windowStart);
    return this.failures.length;
  }

  /**
   * Check if circuit should transition from open to half-open.
   */
  private checkHalfOpen(): void {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.config.resetMs) {
        this.state = 'half-open';
      }
    }
  }
}
