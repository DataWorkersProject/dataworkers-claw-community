import type { ValidationGate, ValidationInput, ValidationResult } from '../types.js';

/**
 * Confidence Gate (REQ-HALL-003).
 *
 * Every agent action must have a confidence score (0-1).
 * Actions below 0.85 are routed to human review.
 * This gate checks the score and makes the routing decision.
 */
export class ConfidenceGate implements ValidationGate {
  name = 'confidence';

  private threshold: number;

  constructor(threshold = 0.85) {
    this.threshold = threshold;
  }

  async validate(input: ValidationInput): Promise<ValidationResult> {
    const confidence = (input.metadata?.confidence as number) ?? 0;

    const passed = confidence >= this.threshold;

    return {
      passed,
      gateName: this.name,
      confidence,
      errors: passed ? [] : [{
        code: 'LOW_CONFIDENCE',
        message: `Confidence ${(confidence * 100).toFixed(1)}% is below threshold ${(this.threshold * 100).toFixed(1)}%. Routing to human review.`,
        severity: 'error',
      }],
      warnings: [],
      metadata: {
        threshold: this.threshold,
        recommendation: passed ? 'auto-apply' : 'human-review',
      },
    };
  }
}
