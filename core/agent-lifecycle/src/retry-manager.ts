import type { RetryConfig } from './types.js';

/**
 * Manages retry logic with exponential backoff (REQ-LIFE-002).
 * Default: max 3 retries with delays of 1s, 4s, 16s.
 */
export class RetryManager {
  private config: RetryConfig;
  private attempts = 0;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxAttempts: config?.maxAttempts ?? 3,
      backoffMs: config?.backoffMs ?? [1_000, 4_000, 16_000],
    };
  }

  /**
   * Whether another retry is allowed.
   */
  canRetry(): boolean {
    return this.attempts < this.config.maxAttempts;
  }

  /**
   * Get the backoff delay for the current retry attempt.
   */
  getBackoffMs(): number {
    if (this.attempts >= this.config.backoffMs.length) {
      return this.config.backoffMs[this.config.backoffMs.length - 1];
    }
    return this.config.backoffMs[this.attempts];
  }

  /**
   * Record a retry attempt.
   */
  recordAttempt(): void {
    this.attempts++;
  }

  /**
   * Get the current attempt count.
   */
  getAttemptCount(): number {
    return this.attempts;
  }

  /**
   * Reset the retry counter.
   */
  reset(): void {
    this.attempts = 0;
  }

  /**
   * Execute a function with retry and backoff.
   * Returns the result on success, or throws after all retries exhausted.
   */
  async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const result = await fn();
        this.reset();
        return result;
      } catch (error) {
        this.recordAttempt();
        if (!this.canRetry()) {
          throw error;
        }
        const delay = this.getBackoffMs();
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
