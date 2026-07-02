/**
 * Onboarding Benchmark — High-Resolution Step Timer
 *
 * Provides nanosecond-precision timing for individual onboarding steps,
 * with pass/fail classification against configurable thresholds.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimingResult {
  stepId: string;
  stepName: string;
  durationMs: number;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

export class StepTimer {
  private start: bigint = 0n;

  begin(): void {
    this.start = process.hrtime.bigint();
  }

  end(stepId: string, stepName: string, thresholdMs: number): TimingResult {
    const elapsed = Number(process.hrtime.bigint() - this.start) / 1_000_000;
    return {
      stepId,
      stepName,
      durationMs: Math.round(elapsed),
      status: elapsed <= thresholdMs ? 'pass' : 'fail',
    };
  }

  /**
   * Create a TimingResult for a skipped step (e.g. data-source steps
   * when persona has dataSource === 'none').
   */
  static skip(stepId: string, stepName: string): TimingResult {
    return { stepId, stepName, durationMs: 0, status: 'skip' };
  }

  /**
   * Create a TimingResult for a failed step that threw an error.
   */
  static error(stepId: string, stepName: string, err: unknown): TimingResult {
    return {
      stepId,
      stepName,
      durationMs: 0,
      status: 'fail',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
