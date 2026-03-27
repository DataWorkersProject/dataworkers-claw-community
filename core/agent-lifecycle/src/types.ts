/**
 * Type definitions for agent lifecycle management.
 * Covers REQ-LIFE-001 through REQ-LIFE-008.
 */

// 9 states per REQ-LIFE-001
export type AgentState =
  | 'IDLE'
  | 'QUEUED'
  | 'PLANNING'
  | 'EXECUTING'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ESCALATED'
  | 'SUSPENDED';

export interface StateTransition {
  from: AgentState;
  to: AgentState;
  timestamp: number;
  reason?: string;
  confidence?: number;
}

export interface AgentLifecycleConfig {
  agentId: string;
  agentType: AgentType;
  timeouts: PhaseTimeouts;
  retry: RetryConfig;
  confidence: ConfidenceConfig;
  bootstrap?: BootstrapConfig;
}

export type AgentType =
  | 'pipeline'
  | 'incident'
  | 'context-catalog'
  | 'governance'
  | 'streaming'
  | 'schema'
  | 'quality'
  | 'orchestrator'
  | 'cost'
  | 'migration'
  | 'insights'
  | 'usage-intelligence';

// REQ-LIFE-003: Phase timeouts
export interface PhaseTimeouts {
  /** Planning phase timeout in ms. Default: 30_000 (30s) */
  planningMs: number;
  /** Execution timeout for simple ops in ms. Default: 300_000 (5min) */
  executionSimpleMs: number;
  /** Execution timeout for complex ops in ms. Default: 1_800_000 (30min) */
  executionComplexMs: number;
  /** Validation phase timeout in ms. Default: 120_000 (2min) */
  validationMs: number;
  /** LLM API call timeout in ms. Default: 60_000 (60s) per REQ-LIFE-005 */
  llmCallMs: number;
}

// REQ-LIFE-002: Retry with exponential backoff
export interface RetryConfig {
  /** Max retry attempts. Default: 3 */
  maxAttempts: number;
  /** Backoff delays in ms. Default: [1000, 4000, 16000] */
  backoffMs: number[];
}

// REQ-LIFE-007: Three confidence thresholds
export interface ConfidenceConfig {
  /** Proceed from PLANNING to EXECUTING. Default: 0.70 */
  proceedThreshold: number;
  /** Auto-apply without human review. Default: 0.85 */
  autoApplyThreshold: number;
  /** Semantic-layer-absent override. Default: 0.75 */
  semanticOverrideThreshold: number;
}

// REQ-LIFE-008: Bootstrap behavior for new customers
export interface BootstrapConfig {
  /** Whether this agent is in bootstrap mode */
  enabled: boolean;
  /** Bootstrap start date */
  startedAt: number;
  /** Bootstrap duration in ms. Default: 30 days */
  durationMs: number;
  /** Extra confidence points during bootstrap. Default: 15 */
  confidenceElevation: number;
  /** Agent-specific bootstrap rules */
  rules?: BootstrapRules;
}

export interface BootstrapRules {
  /** Quality: learning-only period in ms. Default: 7 days */
  learningPeriodMs?: number;
  /** Incident: min historical incidents before ML. Default: 50 */
  minHistoricalIncidents?: number;
  /** Pipeline: requires sample pipeline. Default: true */
  requireSamplePipeline?: boolean;
  /** Context-Catalog: initial crawl time target in ms. Default: 4h */
  initialCrawlTargetMs?: number;
}

// REQ-LIFE-006: Validation gate results
export type ValidationGateResult = 'PASSED' | 'FAILED' | 'INCONCLUSIVE';

export interface PhaseResult {
  success: boolean;
  confidence?: number;
  output?: unknown;
  error?: string;
  validationResult?: ValidationGateResult;
}

export type EscalationReason =
  | 'low_confidence'
  | 'max_retries_exceeded'
  | 'redis_disconnect'
  | 'llm_timeout'
  | 'validation_failure'
  | 'circuit_breaker'
  | 'novel_incident'
  | 'human_approval_required';

export interface EscalationEvent {
  agentId: string;
  agentType: AgentType;
  reason: EscalationReason;
  context: Record<string, unknown>;
  timestamp: number;
}
