/**
 * Persona Scenarios: ML Engineer
 *
 * 10 scenarios covering feature suggestion, model selection, training,
 * evaluation, deployment, data quality for ML, and pipeline management.
 */

import type { PersonaScenario } from '../types.js';

const CID = 'test-customer-1';

export const mlEngineerScenarios: PersonaScenario[] = [
  // ── 1. Suggest features ────────────────────────────────────────────────
  {
    name: 'ml-suggest-features',
    persona: 'ml_engineer',
    question: 'Suggest features for a customer churn prediction model.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-ml',
        tool: 'suggest_features',
        args: { datasetId: 'ds-churn', target: 'is_churned', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['features'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns ranked feature suggestions with importance scores and data source references',
    difficulty: 'intermediate',
  },

  // ── 2. Select model ───────────────────────────────────────────────────
  {
    name: 'ml-select-model',
    persona: 'ml_engineer',
    question: 'What model type should I use for churn classification?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-ml',
        tool: 'select_model',
        args: { datasetId: 'ds-churn', target: 'is_churned', taskType: 'classification', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['recommendations'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Recommends model types ranked by suitability with reasoning and trade-offs',
    difficulty: 'intermediate',
  },

  // ── 3. Train model ────────────────────────────────────────────────────
  {
    name: 'ml-train-model',
    persona: 'ml_engineer',
    question: 'Train a random forest model for the churn experiment.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-ml',
        tool: 'train_model',
        args: {
          experimentId: 'exp-001',
          modelType: 'random_forest',
          datasetId: 'ds-churn',
          target: 'is_churned',
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['modelId', 'status'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns model ID, training status, and basic metrics from the training run',
    difficulty: 'intermediate',
  },

  // ── 4. Evaluate model ──────────────────────────────────────────────────
  {
    name: 'ml-evaluate-model',
    persona: 'ml_engineer',
    question: 'Evaluate model-001 on the churn test set. How does it perform?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-ml',
        tool: 'evaluate_model',
        args: { modelId: 'model-001', datasetId: 'ds-churn', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['metrics'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns evaluation metrics (accuracy, precision, recall, F1) with confidence intervals',
    difficulty: 'intermediate',
  },

  // ── 5. Deploy model ────────────────────────────────────────────────────
  {
    name: 'ml-deploy-model',
    persona: 'ml_engineer',
    question: 'Deploy model-001 to the staging environment.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-ml',
        tool: 'deploy_model',
        args: { modelId: 'model-001', environment: 'staging', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['deploymentId', 'status'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns deployment ID, endpoint URL, and deployment status',
    difficulty: 'intermediate',
  },

  // ── 6. Check data quality for ML dataset ───────────────────────────────
  {
    name: 'ml-check-data-quality',
    persona: 'ml_engineer',
    question: 'Check the data quality of the customers dataset before I use it for training.',
    applicableSeeds: ['jaffle-shop', 'openmetadata'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-quality',
        tool: 'run_quality_check',
        args: { datasetId: 'dim_customers', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['dim_customers'],
        requiredFields: ['checks', 'status'],
        forbiddenEntities: [],
      },
      openmetadata: {
        requiredEntities: ['customers'],
        requiredFields: ['checks', 'status'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns quality check results with null rates, uniqueness, and distribution stats relevant to ML',
    difficulty: 'basic',
  },

  // ── 7. Search for training datasets ────────────────────────────────────
  {
    name: 'ml-search-training-data',
    persona: 'ml_engineer',
    question: 'Find all datasets tagged with ML or suitable for model training.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'search_datasets',
        args: { query: 'ml churn prediction', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['churn_prediction'],
        requiredFields: ['results'],
        forbiddenEntities: ['nonexistent_ml_features_v4'],
      },
    },
    actionabilityCriteria: 'Returns datasets with ML-relevant tags, descriptions, and quality scores',
    difficulty: 'basic',
  },

  // ── 8. Check freshness before training ─────────────────────────────────
  {
    name: 'ml-check-freshness-for-training',
    persona: 'ml_engineer',
    question: 'Is the customer events data fresh enough for retraining?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-context-catalog',
        tool: 'check_freshness',
        args: { assetId: 'fact_orders', customerId: CID },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: ['fact_orders'],
        requiredFields: ['freshnessScore', 'lastUpdated'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Returns freshness score and last-updated timestamp to determine if retraining is safe',
    difficulty: 'basic',
  },

  // ── 9. Generate ETL pipeline for features ──────────────────────────────
  {
    name: 'ml-generate-feature-pipeline',
    persona: 'ml_engineer',
    question: 'Generate a pipeline to compute and materialize churn prediction features.',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 5000,
    routes: [
      {
        agent: 'dw-pipelines',
        tool: 'generate_pipeline',
        args: {
          description: 'Compute churn prediction features from customers and orders, materialize to feature store',
          customerId: CID,
        },
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['pipeline', 'steps'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Produces a pipeline spec with feature computation and materialization steps',
    difficulty: 'advanced',
  },

  // ── 10. Detect data drift ──────────────────────────────────────────────
  {
    name: 'ml-detect-drift',
    persona: 'ml_engineer',
    question: 'Is there any data drift that might affect our deployed models?',
    applicableSeeds: ['jaffle-shop'],
    maxLatencyMs: 2000,
    routes: [
      {
        agent: 'dw-observability',
        tool: 'detect_drift',
        args: {},
      },
    ],
    expectedResponses: {
      'jaffle-shop': {
        requiredEntities: [],
        requiredFields: ['driftDetected'],
        forbiddenEntities: [],
      },
    },
    actionabilityCriteria: 'Reports drift status with affected features, magnitude, and recommended actions',
    difficulty: 'advanced',
  },
];
