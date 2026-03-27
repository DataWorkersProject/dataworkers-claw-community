/**
 * @data-workers/agent-lifecycle
 *
 * Agent lifecycle state machine, confidence scoring, retry policies,
 * timeout management, and bootstrap behavior.
 * Implements REQ-LIFE-001 through REQ-LIFE-008.
 */

export { AgentStateMachine, AgentState } from './state-machine.js';
export { ConfidenceScorer } from './confidence.js';
export { RetryManager } from './retry-manager.js';
export { TimeoutManager } from './timeout-manager.js';
export { BootstrapManager } from './bootstrap.js';

export type {
  AgentLifecycleConfig,
  AgentType,
  StateTransition,
  PhaseTimeouts,
  RetryConfig,
  ConfidenceConfig,
  BootstrapConfig,
  BootstrapRules,
  ValidationGateResult,
  PhaseResult,
  EscalationReason,
  EscalationEvent,
} from './types.js';
