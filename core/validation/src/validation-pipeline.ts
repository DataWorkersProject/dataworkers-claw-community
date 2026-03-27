import type { ValidationGate, ValidationInput, ValidationResult } from './types.js';

/**
 * Validation Pipeline.
 *
 * Composes multiple validation gates into an ordered pipeline.
 * All gates must pass for the overall validation to pass.
 * Gates run in order and can short-circuit on critical failures.
 */
export class ValidationPipeline {
  private gates: ValidationGate[] = [];

  /**
   * Add a gate to the pipeline.
   */
  addGate(gate: ValidationGate): void {
    this.gates.push(gate);
  }

  /**
   * Run all gates in order. Returns combined results.
   */
  async validate(
    input: ValidationInput,
    stopOnCritical = true,
  ): Promise<{
    passed: boolean;
    results: ValidationResult[];
    overallConfidence: number;
  }> {
    const results: ValidationResult[] = [];
    let allPassed = true;

    for (const gate of this.gates) {
      const result = await gate.validate(input);
      results.push(result);

      if (!result.passed) {
        allPassed = false;
        // Stop on critical errors
        if (stopOnCritical && result.errors.some((e) => e.severity === 'critical')) {
          break;
        }
      }
    }

    // Overall confidence is the minimum across all gates
    const overallConfidence = results.length > 0
      ? Math.min(...results.map((r) => r.confidence))
      : 1.0;

    return { passed: allPassed, results, overallConfidence };
  }

  /**
   * Get the list of gate names in the pipeline.
   */
  getGateNames(): string[] {
    return this.gates.map((g) => g.name);
  }
}
