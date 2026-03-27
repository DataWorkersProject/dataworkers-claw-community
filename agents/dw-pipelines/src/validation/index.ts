/**
 * Pipeline Validation & Deployment module.
 * REQ-PIPE-004, REQ-PIPE-005, REQ-PIPE-006.
 */

export { PipelineValidator } from './pipeline-validator.js';
export { GitWorkflow } from './git-workflow.js';
export type { GitCommitResult, GitRollbackResult } from './git-workflow.js';
export { OrchestratorDeployer } from './orchestrator-deployer.js';
export { CrossAgentQueryClient } from './cross-agent-client.js';
export type { ReusableAsset, SchemaCompatibility } from './cross-agent-client.js';
