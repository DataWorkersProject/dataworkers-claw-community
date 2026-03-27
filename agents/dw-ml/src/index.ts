/**
 * dw-ml — ML Agent
 *
 * MCP server exposing 16 ML tools:
 *
 * Community/read:
 * - suggest_features: Feature engineering suggestions
 * - select_model: Algorithm recommendation
 * - evaluate_model: Model evaluation & comparison
 * - get_ml_status: Training/deployment status
 * - explain_model: SHAP-style feature importance explanations
 * - get_model_versions: Model registry version listing
 * - get_feature_stats: Feature distribution statistics
 *
 * Pro/write:
 * - train_model: Model training orchestration
 * - deploy_model: Model deployment
 * - create_experiment: MLflow-compatible experiment tracking
 * - log_metrics: Training metrics logging per run
 * - register_model: Model registry with versioning
 * - create_feature_pipeline: Feature engineering pipeline definition
 *
 * Enterprise:
 * - compare_experiments: Side-by-side experiment comparison (read)
 * - detect_model_drift: Production model drift detection (write)
 * - ab_test_models: A/B test configuration for model comparison (write)
 */

import { DataWorkersMCPServer, startStdioTransport } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';

// v1 tools
import { suggestFeaturesDefinition, suggestFeaturesHandler } from './tools/suggest-features.js';
import { selectModelDefinition, selectModelHandler } from './tools/select-model.js';
import { trainModelDefinition, trainModelHandler } from './tools/train-model.js';
import { evaluateModelDefinition, evaluateModelHandler } from './tools/evaluate-model.js';
import { deployModelDefinition, deployModelHandler } from './tools/deploy-model.js';
import { getMLStatusDefinition, getMLStatusHandler } from './tools/get-ml-status.js';

// v2 tools — Experiment tracking
import { createExperimentDefinition, createExperimentHandler } from './tools/create-experiment.js';
import { logMetricsDefinition, logMetricsHandler } from './tools/log-metrics.js';
import { compareExperimentsDefinition, compareExperimentsHandler } from './tools/compare-experiments.js';

// v2 tools — Model registry
import { registerModelDefinition, registerModelHandler } from './tools/register-model.js';
import { getModelVersionsDefinition, getModelVersionsHandler } from './tools/get-model-versions.js';

// v2 tools — Feature pipeline
import { createFeaturePipelineDefinition, createFeaturePipelineHandler } from './tools/create-feature-pipeline.js';
import { getFeatureStatsDefinition, getFeatureStatsHandler } from './tools/get-feature-stats.js';

// v2 tools — Explainability & monitoring
import { explainModelDefinition, explainModelHandler } from './tools/explain-model.js';
import { detectModelDriftDefinition, detectModelDriftHandler } from './tools/detect-model-drift.js';
import { abTestModelsDefinition, abTestModelsHandler } from './tools/ab-test-models.js';

const AGENT_ID = 'dw-ml';

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.2.0',
  description: 'MLOps & Models Agent — feature engineering, model selection, training, evaluation, deployment, experiment tracking, model registry, drift detection, A/B testing',
});

// ── v1 tools (6) ────────────────────────────────────────────────────
server.registerTool(suggestFeaturesDefinition, withMiddleware(AGENT_ID, 'suggest_features', suggestFeaturesHandler));
server.registerTool(selectModelDefinition, withMiddleware(AGENT_ID, 'select_model', selectModelHandler));
server.registerTool(trainModelDefinition, withMiddleware(AGENT_ID, 'train_model', trainModelHandler));
server.registerTool(evaluateModelDefinition, withMiddleware(AGENT_ID, 'evaluate_model', evaluateModelHandler));
server.registerTool(deployModelDefinition, withMiddleware(AGENT_ID, 'deploy_model', deployModelHandler));
server.registerTool(getMLStatusDefinition, withMiddleware(AGENT_ID, 'get_ml_status', getMLStatusHandler));

// ── v2 tools — Experiment tracking (3) ──────────────────────────────
server.registerTool(createExperimentDefinition, withMiddleware(AGENT_ID, 'create_experiment', createExperimentHandler));
server.registerTool(logMetricsDefinition, withMiddleware(AGENT_ID, 'log_metrics', logMetricsHandler));
server.registerTool(compareExperimentsDefinition, withMiddleware(AGENT_ID, 'compare_experiments', compareExperimentsHandler));

// ── v2 tools — Model registry (2) ──────────────────────────────────
server.registerTool(registerModelDefinition, withMiddleware(AGENT_ID, 'register_model', registerModelHandler));
server.registerTool(getModelVersionsDefinition, withMiddleware(AGENT_ID, 'get_model_versions', getModelVersionsHandler));

// ── v2 tools — Feature pipeline (2) ────────────────────────────────
server.registerTool(createFeaturePipelineDefinition, withMiddleware(AGENT_ID, 'create_feature_pipeline', createFeaturePipelineHandler));
server.registerTool(getFeatureStatsDefinition, withMiddleware(AGENT_ID, 'get_feature_stats', getFeatureStatsHandler));

// ── v2 tools — Explainability & monitoring (3) ─────────────────────
server.registerTool(explainModelDefinition, withMiddleware(AGENT_ID, 'explain_model', explainModelHandler));
server.registerTool(detectModelDriftDefinition, withMiddleware(AGENT_ID, 'detect_model_drift', detectModelDriftHandler));
server.registerTool(abTestModelsDefinition, withMiddleware(AGENT_ID, 'ab_test_models', abTestModelsHandler));

server.captureCapabilities();

// Stdio transport for standalone MCP server mode
if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}

export { server };
export { messageBus } from './backends.js';
export default server;
