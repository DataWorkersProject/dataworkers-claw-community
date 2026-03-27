/**
 * Root Cause Analysis Engine.
 * REQ-INC-002, REQ-INC-005.
 */

export { LineageTraverser } from './lineage-traverser.js';
export type { LineageNode, LineageEdge, TraversalResult } from './lineage-traverser.js';
export { IncidentClassifier } from './incident-classifier.js';
export type { ClassificationResult, ClassificationInput } from './incident-classifier.js';
export { HistoryMatcher } from './history-matcher.js';
export type { MatchResult } from './history-matcher.js';
export { RCAOrchestrator } from './rca-orchestrator.js';
