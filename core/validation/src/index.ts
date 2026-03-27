/**
 * @data-workers/validation
 *
 * Hallucination reduction, deterministic validation gates,
 * and sandboxed execution for Data Workers agents.
 * Implements REQ-HALL-001 through REQ-HALL-007.
 */

export { FactualGroundingGate } from './gates/factual-grounding.js';
export { CodeValidationGate } from './gates/code-validation.js';
export { ConfidenceGate } from './gates/confidence-gate.js';
export { CitationTracker } from './gates/citation-tracker.js';
export { SandboxExecutor } from './gates/sandbox-executor.js';
export { OutputDiffGenerator } from './gates/output-diff.js';
export { ValidationPipeline } from './validation-pipeline.js';

export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationGate,
  ValidationInput,
  ContentType,
  Citation,
  OutputDiff,
  SandboxResult,
  SandboxConfig,
  PIIType,
  PIIDetection,
} from './types.js';
