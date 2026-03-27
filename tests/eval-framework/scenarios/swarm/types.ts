/**
 * Eval Framework — Swarm Scenario Types
 *
 * Shared type definitions for all swarm evaluation scenarios.
 */

// ---------------------------------------------------------------------------
// Scenario definition types
// ---------------------------------------------------------------------------

export interface DynamicInput {
  /** Step ID to get the value from */
  fromStep: string;
  /** Field name (as defined in that step's extractFields) */
  field: string;
  /** Fallback value if the upstream step didn't produce the field */
  fallback?: unknown;
  /** Optional transform function to apply to the extracted value */
  transform?: (value: string) => string;
}

export interface SwarmStep {
  /** Unique step identifier within the scenario */
  id: string;
  /** Agent name (server key) */
  agent: string;
  /** MCP tool name */
  tool: string;
  /** Static input fields */
  inputTemplate: Record<string, unknown>;
  /** Fields that depend on output from previous steps */
  dynamicInputs?: Record<string, DynamicInput>;
  /** Fields to extract from the response for downstream steps */
  extractFields?: Record<string, string>;
  /** Fields expected in the response (for completeness checking) */
  expectedFields?: string[];
}

export interface SwarmScenario {
  name: string;
  description: string;
  steps: SwarmStep[];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface SwarmStepResult {
  stepId: string;
  agent: string;
  tool: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  handoffSuccess: boolean;
  output: any;
}

export interface SwarmScenarioResult {
  scenario: string;
  steps: SwarmStepResult[];
  success: boolean;
  totalLatencyMs: number;
}

export interface SwarmEvalResult {
  scenario: string;
  description: string;
  success: boolean;
  totalLatencyMs: number;
  stepCount: number;
  stepsSucceeded: number;
  stepsFailed: number;
  handoffSuccessRate: number;
  automationCoverage: number;
  productivityScore: number;
  userValueScore: number;
  overallScore: number;
  steps: SwarmStepResult[];
}
