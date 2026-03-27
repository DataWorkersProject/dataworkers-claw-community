/**
 * Persona-based AI Eval Benchmark — Core Types
 *
 * Defines the type system for evaluating agent responses across
 * different data-team personas and seed datasets.
 */

// ---------------------------------------------------------------------------
// Enums / Unions
// ---------------------------------------------------------------------------

export type Persona =
  | 'data_engineer'
  | 'analytics_engineer'
  | 'data_platform_lead'
  | 'data_scientist'
  | 'ml_engineer'
  | 'openclaw_user'
  | 'governance_officer'
  | 'data_practitioner';

export type SeedDataset = 'jaffle-shop' | 'openmetadata';

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

/**
 * Dynamic input specification for multi-step scenarios.
 * Enables step N+1 to consume output from step N.
 */
export interface DynamicInput {
  fromStep: string;          // Step ID to pull data from
  field: string;             // Dot-notation path into that step's output (e.g., "results[0].name")
  fallback: unknown;         // Value to use if extraction fails
  transform?: string;        // Optional transform expression (e.g., "table:analytics.public.${value}")
}

export interface MultiStepRoute {
  id: string;                // Unique step identifier for cross-referencing
  agent: string;
  tool: string;
  args: Record<string, unknown>;
  dynamicInputs?: Record<string, DynamicInput>; // Args to populate from previous step outputs
  extractFields?: Record<string, string>;        // Fields to extract from output for downstream steps
}

export interface ToolRoute {
  agent: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface ExpectedResponse {
  requiredEntities: string[];       // Must appear in response
  requiredFields: string[];         // JSON fields that must exist
  forbiddenEntities?: string[];     // Must NOT appear (hallucination check)
  minResultCount?: number;
}

export interface PersonaScenario {
  name: string;
  persona: Persona;
  question: string;                 // Natural language question the persona asks
  applicableSeeds: SeedDataset[];
  routes: ToolRoute[];              // Agent + tool + args to call
  expectedResponses: Partial<Record<SeedDataset, ExpectedResponse>>;
  actionabilityCriteria: string;    // What "actionable" means for this question
  difficulty: 'basic' | 'intermediate' | 'advanced';
  isNegativeTest?: boolean;         // Scenario expected to fail/error gracefully
  isMultiStep?: boolean;            // Requires chaining multiple tools sequentially
  steps?: ToolRoute[];              // Sequential execution steps for multi-step scenarios (legacy)
  multiSteps?: MultiStepRoute[];    // Sequential steps WITH dynamic output->input chaining
  expectedErrorPattern?: string;    // Regex pattern the error response should match (negative tests)
  maxLatencyMs?: number;            // Latency budget for this scenario (persona-dependent)
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface PersonaScore {
  routingAccuracy: number;          // Did the right tool get called? (always 1.0 in direct mode)
  responseCompleteness: number;     // Required entities + fields found
  factualGrounding: number;         // No hallucinated entities
  actionability: number;            // Contains actions, values, recommendations
  seedSpecificity: number;          // Response reflects the specific seed data
  negativeHandling: number;         // Graceful error handling for negative tests (1.0 if N/A)
  responseStructure: number;        // Response matches expected tool schema (1.0 if N/A)
  latencyCompliance: number;        // 1.0 if within budget, degrades proportionally (1.0 if no budget)
  composite: number;                // Weighted average
}

export interface PersonaResult {
  scenario: PersonaScenario;
  seed: SeedDataset;
  response: unknown;
  scores: PersonaScore;
  latencyMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface PersonaReport {
  timestamp: string;
  totalScenarios: number;
  overallComposite: number;
  byPersona: Record<Persona, {
    count: number;
    avgComposite: number;
    results: PersonaResult[];
  }>;
  bySeed: Record<SeedDataset, {
    count: number;
    avgComposite: number;
  }>;
  byAgent: Record<string, {
    count: number;
    avgComposite: number;
    routingHitRate: number;
  }>;
  byDifficulty: Record<string, {
    count: number;
    avgComposite: number;
    weightedComposite: number;
  }>;
  multiSeedConsistency: {
    hardcodedCount: number;
    seedSensitiveCount: number;
    jaccardSimilarities: Array<{ scenario: string; similarity: number }>;
  };
  negativeTestSummary: {
    totalNegativeTests: number;
    gracefulHandlingRate: number;
  };
  multiStepSummary: {
    totalMultiStep: number;
    avgComposite: number;
    handoffSuccessRate: number;
  };
  latencyCompliance: {
    totalWithBudget: number;
    compliantCount: number;
    complianceRate: number;
  };
  coverageMap: {
    byAgent: Record<string, string[]>;     // agent -> persona names that test it
    byTool: Record<string, string[]>;      // tool -> persona names that test it
  };
}
