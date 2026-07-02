/**
 * dw-ml — Exported tool definitions and handlers.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

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

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const mlTools: ToolEntry[] = [
  // v1
  { definition: suggestFeaturesDefinition, handler: suggestFeaturesHandler },
  { definition: selectModelDefinition, handler: selectModelHandler },
  { definition: trainModelDefinition, handler: trainModelHandler },
  { definition: evaluateModelDefinition, handler: evaluateModelHandler },
  { definition: deployModelDefinition, handler: deployModelHandler },
  { definition: getMLStatusDefinition, handler: getMLStatusHandler },
  // v2 — Experiment tracking
  { definition: createExperimentDefinition, handler: createExperimentHandler },
  { definition: logMetricsDefinition, handler: logMetricsHandler },
  { definition: compareExperimentsDefinition, handler: compareExperimentsHandler },
  // v2 — Model registry
  { definition: registerModelDefinition, handler: registerModelHandler },
  { definition: getModelVersionsDefinition, handler: getModelVersionsHandler },
  // v2 — Feature pipeline
  { definition: createFeaturePipelineDefinition, handler: createFeaturePipelineHandler },
  { definition: getFeatureStatsDefinition, handler: getFeatureStatsHandler },
  // v2 — Explainability & monitoring
  { definition: explainModelDefinition, handler: explainModelHandler },
  { definition: detectModelDriftDefinition, handler: detectModelDriftHandler },
  { definition: abTestModelsDefinition, handler: abTestModelsHandler },
];
