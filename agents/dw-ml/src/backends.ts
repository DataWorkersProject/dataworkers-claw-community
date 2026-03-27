/**
 * Shared backend infrastructure for dw-ml.
 * Initializes and seeds in-memory stores with sample ML datasets, models, and deployments.
 */

import {
  createRelationalStore,
  InMemoryRelationalStore,
  createKeyValueStore,
  createMessageBus,
} from '@data-workers/infrastructure-stubs';

// ── Relational store for ML data ─────────────────────────────────────

export const relationalStore = await createRelationalStore();
export const kvStore = await createKeyValueStore();
export const messageBus = await createMessageBus();

// ── Seed data ────────────────────────────────────────────────────────

export const seeded = (async () => {
  if (!(relationalStore instanceof InMemoryRelationalStore)) return;

  await relationalStore.createTable('ml_datasets');
  await relationalStore.createTable('ml_models');
  await relationalStore.createTable('ml_deployments');
  await relationalStore.createTable('ml_experiments');
  await relationalStore.createTable('ml_experiment_runs');
  await relationalStore.createTable('ml_model_registry');
  await relationalStore.createTable('ml_feature_pipelines');
  await relationalStore.createTable('ml_drift_reports');
  await relationalStore.createTable('ml_ab_tests');

  const now = Date.now();

  // ── 3 sample datasets ──────────────────────────────────────────────

  await relationalStore.insert('ml_datasets', {
    id: 'ds-churn-001',
    name: 'Customer Churn Dataset',
    source: 'analytics.dim_customers',
    columns: JSON.stringify([
      { name: 'customer_id', type: 'categorical', nullRate: 0, cardinality: 50000, sampleValues: ['C001', 'C002', 'C003'] },
      { name: 'tenure_months', type: 'numeric', nullRate: 0.01, cardinality: 72, sampleValues: [12, 24, 36] },
      { name: 'monthly_charges', type: 'numeric', nullRate: 0.02, cardinality: 1500, sampleValues: [29.99, 59.99, 99.99] },
      { name: 'total_charges', type: 'numeric', nullRate: 0.03, cardinality: 48000, sampleValues: [359.88, 1439.76, 3599.64] },
      { name: 'contract_type', type: 'categorical', nullRate: 0, cardinality: 3, sampleValues: ['monthly', 'annual', 'two_year'] },
      { name: 'support_tickets', type: 'numeric', nullRate: 0, cardinality: 20, sampleValues: [0, 2, 5] },
      { name: 'is_churned', type: 'boolean', nullRate: 0, cardinality: 2, sampleValues: [true, false] },
    ]),
    rowCount: 50000,
    features: JSON.stringify(['tenure_months', 'monthly_charges', 'total_charges', 'contract_type', 'support_tickets']),
    targetColumn: 'is_churned',
    taskType: 'classification',
    createdAt: now - 7 * 24 * 60 * 60 * 1000,
  });

  await relationalStore.insert('ml_datasets', {
    id: 'ds-revenue-001',
    name: 'Daily Revenue Dataset',
    source: 'analytics.fct_daily_revenue',
    columns: JSON.stringify([
      { name: 'date', type: 'datetime', nullRate: 0, cardinality: 730, sampleValues: ['2025-01-01', '2025-06-15', '2025-12-31'] },
      { name: 'revenue', type: 'numeric', nullRate: 0, cardinality: 730, sampleValues: [15000, 22000, 31000] },
      { name: 'transactions', type: 'numeric', nullRate: 0, cardinality: 500, sampleValues: [120, 250, 400] },
      { name: 'avg_order_value', type: 'numeric', nullRate: 0.01, cardinality: 680, sampleValues: [45.50, 88.00, 125.75] },
      { name: 'channel', type: 'categorical', nullRate: 0, cardinality: 4, sampleValues: ['web', 'mobile', 'store', 'api'] },
    ]),
    rowCount: 730,
    features: JSON.stringify(['date', 'transactions', 'avg_order_value', 'channel']),
    targetColumn: 'revenue',
    taskType: 'regression',
    createdAt: now - 14 * 24 * 60 * 60 * 1000,
  });

  await relationalStore.insert('ml_datasets', {
    id: 'ds-quality-001',
    name: 'Data Quality Scores',
    source: 'analytics.fct_quality_scores',
    columns: JSON.stringify([
      { name: 'table_name', type: 'categorical', nullRate: 0, cardinality: 200, sampleValues: ['orders', 'customers', 'products'] },
      { name: 'completeness', type: 'numeric', nullRate: 0, cardinality: 100, sampleValues: [0.95, 0.88, 0.72] },
      { name: 'freshness_hours', type: 'numeric', nullRate: 0.05, cardinality: 48, sampleValues: [1, 6, 24] },
      { name: 'row_count', type: 'numeric', nullRate: 0, cardinality: 150, sampleValues: [1000, 50000, 1000000] },
      { name: 'has_anomaly', type: 'boolean', nullRate: 0, cardinality: 2, sampleValues: [true, false] },
    ]),
    rowCount: 5000,
    features: JSON.stringify(['completeness', 'freshness_hours', 'row_count']),
    targetColumn: 'has_anomaly',
    taskType: 'classification',
    createdAt: now - 3 * 24 * 60 * 60 * 1000,
  });

  // ── 2 trained models ───────────────────────────────────────────────

  await relationalStore.insert('ml_models', {
    id: 'model-churn-xgb-001',
    datasetId: 'ds-churn-001',
    algorithm: 'xgboost',
    hyperparameters: JSON.stringify({ max_depth: 6, learning_rate: 0.1, n_estimators: 200, subsample: 0.8 }),
    targetColumn: 'is_churned',
    features: JSON.stringify(['tenure_months', 'monthly_charges', 'total_charges', 'contract_type', 'support_tickets']),
    taskType: 'classification',
    metrics: JSON.stringify({
      accuracy: 0.94,
      precision: 0.89,
      recall: 0.82,
      f1: 0.85,
      auc: 0.96,
      confusionMatrix: [[43200, 800], [900, 5100]],
    }),
    trainingTimeMs: 45200,
    trainedAt: now - 5 * 24 * 60 * 60 * 1000,
  });

  await relationalStore.insert('ml_models', {
    id: 'model-revenue-lgbm-001',
    datasetId: 'ds-revenue-001',
    algorithm: 'lightgbm',
    hyperparameters: JSON.stringify({ num_leaves: 31, learning_rate: 0.05, n_estimators: 500, min_child_samples: 20 }),
    targetColumn: 'revenue',
    features: JSON.stringify(['transactions', 'avg_order_value', 'channel']),
    taskType: 'regression',
    metrics: JSON.stringify({
      rmse: 1250.5,
      mae: 890.3,
      r2: 0.92,
    }),
    trainingTimeMs: 32100,
    trainedAt: now - 10 * 24 * 60 * 60 * 1000,
  });

  // ── 1 deployment ───────────────────────────────────────────────────

  await relationalStore.insert('ml_deployments', {
    id: 'deploy-churn-001',
    modelId: 'model-churn-xgb-001',
    endpoint: '/api/v1/predict/churn',
    environment: 'production',
    status: 'active',
    scalingConfig: JSON.stringify({ minInstances: 2, maxInstances: 8, targetLatencyMs: 100 }),
    createdAt: now - 4 * 24 * 60 * 60 * 1000,
    updatedAt: now - 1 * 24 * 60 * 60 * 1000,
  });

  // ── 1 experiment ─────────────────────────────────────────────────

  await relationalStore.insert('ml_experiments', {
    id: 'exp-churn-001',
    name: 'Churn Prediction Experiment',
    description: 'Comparing algorithms for customer churn prediction',
    tags: JSON.stringify({ team: 'data-science', priority: 'high' }),
    createdAt: now - 6 * 24 * 60 * 60 * 1000,
    updatedAt: now - 5 * 24 * 60 * 60 * 1000,
  });

  // ── 2 experiment runs ────────────────────────────────────────────

  await relationalStore.insert('ml_experiment_runs', {
    id: 'run-001',
    experimentId: 'exp-churn-001',
    modelId: 'model-churn-xgb-001',
    metrics: JSON.stringify({ accuracy: 0.94, f1: 0.85, auc: 0.96, loss: 0.18 }),
    step: 1,
    loggedAt: now - 5 * 24 * 60 * 60 * 1000,
  });

  await relationalStore.insert('ml_experiment_runs', {
    id: 'run-002',
    experimentId: 'exp-churn-001',
    modelId: 'model-revenue-lgbm-001',
    metrics: JSON.stringify({ rmse: 1250.5, mae: 890.3, r2: 0.92, loss: 0.25 }),
    step: 1,
    loggedAt: now - 5 * 24 * 60 * 60 * 1000,
  });

  // ── 1 model registry entry ───────────────────────────────────────

  await relationalStore.insert('ml_model_registry', {
    id: 'reg-churn-001',
    modelName: 'churn-predictor',
    version: 1,
    modelId: 'model-churn-xgb-001',
    stage: 'production',
    description: 'XGBoost churn predictor v1 — promoted to production',
    registeredAt: now - 4 * 24 * 60 * 60 * 1000,
  });

  // ── 1 feature pipeline ───────────────────────────────────────────

  await relationalStore.insert('ml_feature_pipelines', {
    id: 'fp-churn-001',
    name: 'Churn Feature Pipeline',
    datasetId: 'ds-churn-001',
    transforms: JSON.stringify([
      { column: 'contract_type', transformationType: 'one_hot_encoding', outputColumn: 'contract_type_onehot' },
      { column: 'tenure_months', transformationType: 'normalization', outputColumn: 'tenure_months_normalized' },
      { column: 'total_charges', transformationType: 'log_transform', outputColumn: 'total_charges_log' },
    ]),
    createdAt: now - 6 * 24 * 60 * 60 * 1000,
  });
})();
