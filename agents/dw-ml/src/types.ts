/**
 * Type definitions for the ML Agent (dw-ml).
 */

// ── Dataset types ────────────────────────────────────────────────────

export type TaskType = 'classification' | 'regression' | 'timeseries' | 'anomaly';

export interface ColumnInfo {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'text' | 'boolean';
  nullRate: number;
  cardinality: number;
  sampleValues: unknown[];
}

export interface MLDataset {
  id: string;
  name: string;
  source: string;
  columns: ColumnInfo[];
  rowCount: number;
  features: string[];
  targetColumn?: string;
  taskType?: TaskType;
  createdAt: number;
}

// ── Feature engineering ──────────────────────────────────────────────

export type TransformationType =
  | 'one_hot_encoding'
  | 'label_encoding'
  | 'normalization'
  | 'standardization'
  | 'date_decomposition'
  | 'text_embedding'
  | 'binning'
  | 'log_transform'
  | 'polynomial'
  | 'interaction';

export interface FeatureSuggestion {
  column: string;
  transformationType: TransformationType;
  reason: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  newFeatureName: string;
}

// ── Model configuration & training ───────────────────────────────────

export type Algorithm =
  | 'xgboost'
  | 'lightgbm'
  | 'random_forest'
  | 'linear_regression'
  | 'logistic_regression'
  | 'gradient_boosting'
  | 'decision_tree'
  | 'svm'
  | 'neural_network';

export interface ModelConfig {
  algorithm: Algorithm;
  hyperparameters: Record<string, unknown>;
  targetColumn: string;
  features: string[];
  taskType: TaskType;
  timeBudgetSeconds?: number;
}

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  auc?: number;
  rmse?: number;
  mae?: number;
  r2?: number;
  confusionMatrix?: number[][];
}

export interface TrainingResult {
  modelId: string;
  datasetId: string;
  metrics: ModelMetrics;
  trainingTimeMs: number;
  algorithm: Algorithm;
  hyperparameters: Record<string, unknown>;
  targetColumn: string;
  features: string[];
  taskType: TaskType;
  trainedAt: number;
}

// ── Deployment ───────────────────────────────────────────────────────

export type DeploymentStatus = 'pending' | 'deploying' | 'active' | 'failed' | 'retired';

export interface DeploymentConfig {
  modelId: string;
  endpoint: string;
  environment: 'staging' | 'production';
  scalingConfig: {
    minInstances: number;
    maxInstances: number;
    targetLatencyMs: number;
  };
}

export interface Deployment {
  id: string;
  modelId: string;
  endpoint: string;
  environment: 'staging' | 'production';
  status: DeploymentStatus;
  scalingConfig: {
    minInstances: number;
    maxInstances: number;
    targetLatencyMs: number;
  };
  createdAt: number;
  updatedAt: number;
}

// ── Experiment tracking ──────────────────────────────────────────────

export interface Experiment {
  id: string;
  name: string;
  description: string;
  tags: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  modelId?: string;
  metrics: Record<string, number>;
  step?: number;
  loggedAt: number;
}

// ── Model registry ──────────────────────────────────────────────────

export type ModelStage = 'staging' | 'production' | 'archived';

export interface ModelRegistryEntry {
  id: string;
  modelName: string;
  version: number;
  modelId: string;
  stage: ModelStage;
  description: string;
  registeredAt: number;
}

// ── Feature pipelines ───────────────────────────────────────────────

export interface FeatureTransform {
  column: string;
  transformationType: TransformationType;
  params?: Record<string, unknown>;
  outputColumn: string;
}

export interface FeaturePipeline {
  id: string;
  name: string;
  datasetId: string;
  transforms: FeatureTransform[];
  createdAt: number;
}

// ── Drift detection ─────────────────────────────────────────────────

export type DriftMethod = 'ks' | 'psi' | 'wasserstein';

export interface DriftScore {
  feature: string;
  score: number;
  threshold: number;
  isDrifted: boolean;
  method: DriftMethod;
}

export interface DriftReport {
  id: string;
  modelId: string;
  baselineDatasetId: string;
  overallDriftDetected: boolean;
  driftScores: DriftScore[];
  detectedAt: number;
}

// ── A/B testing ─────────────────────────────────────────────────────

export type ABTestStatus = 'running' | 'completed' | 'stopped';

export interface ABTestConfig {
  id: string;
  modelAId: string;
  modelBId: string;
  trafficSplit: number;        // 0-1, fraction going to model B
  metric: string;
  minSampleSize: number;
  durationHours: number;
  status: ABTestStatus;
  results?: ABTestResults;
  createdAt: number;
}

export interface ABTestResults {
  modelAMetric: number;
  modelBMetric: number;
  pValue: number;
  isSignificant: boolean;
  winner: 'A' | 'B' | 'inconclusive';
  samplesCollected: number;
}

// ── Status tracking ──────────────────────────────────────────────────

export type MLStage = 'queued' | 'preprocessing' | 'training' | 'evaluating' | 'completed' | 'failed' | 'deploying' | 'deployed';

export interface MLStatus {
  modelId: string;
  stage: MLStage;
  progress: number;       // 0-100
  startedAt: number;
  completedAt?: number;
  message?: string;
  error?: string;
}
