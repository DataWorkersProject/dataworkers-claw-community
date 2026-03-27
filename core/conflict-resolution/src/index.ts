/**
 * @data-workers/conflict-resolution
 *
 * Distributed locking, priority hierarchy, deadlock detection,
 * confidence cascade, and agent circuit breakers.
 * Implements REQ-CONFL-001 through REQ-CONFL-008.
 */

export { RedlockManager } from './redlock.js';
export { PriorityResolver, AGENT_PRIORITY } from './priority.js';
export { DeadlockDetector } from './deadlock.js';
export { ConfidenceCascade } from './confidence-cascade.js';
export { AgentCircuitBreaker } from './agent-circuit-breaker.js';
