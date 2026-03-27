import { describe, it, expect } from 'vitest';
import { server } from '../index.js';

describe('dw-ml MCP Server', () => {
  it('registers all 16 tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(16);
    expect(tools.map((t) => t.name)).toEqual([
      'suggest_features',
      'select_model',
      'train_model',
      'evaluate_model',
      'deploy_model',
      'get_ml_status',
      'create_experiment',
      'log_metrics',
      'compare_experiments',
      'register_model',
      'get_model_versions',
      'create_feature_pipeline',
      'get_feature_stats',
      'explain_model',
      'detect_model_drift',
      'ab_test_models',
    ]);
  });

  // ── suggest_features ─────────────────────────────────────────────────

  describe('suggest_features', () => {
    it('returns feature suggestions for churn dataset', async () => {
      const result = await server.callTool('suggest_features', { dataset_id: 'ds-churn-001' });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.datasetId).toBe('ds-churn-001');
      expect(data.datasetName).toBe('Customer Churn Dataset');
      expect(data.suggestionsCount).toBeGreaterThan(0);
      expect(Array.isArray(data.suggestions)).toBe(true);

      // Verify suggestion structure
      const suggestion = data.suggestions[0];
      expect(suggestion.column).toBeDefined();
      expect(suggestion.transformationType).toBeDefined();
      expect(suggestion.reason).toBeDefined();
      expect(suggestion.estimatedImpact).toBeDefined();
      expect(suggestion.newFeatureName).toBeDefined();
    });

    it('suggests one-hot encoding for low-cardinality categoricals', async () => {
      const result = await server.callTool('suggest_features', { dataset_id: 'ds-churn-001' });
      const data = JSON.parse(result.content[0].text!);

      const oneHot = data.suggestions.find(
        (s: any) => s.column === 'contract_type' && s.transformationType === 'one_hot_encoding',
      );
      expect(oneHot).toBeDefined();
      expect(oneHot.estimatedImpact).toBe('high');
    });

    it('suggests date decomposition for datetime columns', async () => {
      const result = await server.callTool('suggest_features', { dataset_id: 'ds-revenue-001' });
      const data = JSON.parse(result.content[0].text!);

      const dateSuggestion = data.suggestions.find(
        (s: any) => s.transformationType === 'date_decomposition',
      );
      expect(dateSuggestion).toBeDefined();
      expect(dateSuggestion.column).toBe('date');
      expect(dateSuggestion.estimatedImpact).toBe('high');
    });

    it('returns error for non-existent dataset', async () => {
      const result = await server.callTool('suggest_features', { dataset_id: 'ds-nonexistent' });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toContain('not found');
    });

    it('respects max_suggestions limit', async () => {
      const result = await server.callTool('suggest_features', { dataset_id: 'ds-churn-001', max_suggestions: 2 });
      const data = JSON.parse(result.content[0].text!);
      expect(data.suggestionsCount).toBeLessThanOrEqual(2);
    });
  });

  // ── select_model ─────────────────────────────────────────────────────

  describe('select_model', () => {
    it('recommends classification algorithms for churn dataset', async () => {
      const result = await server.callTool('select_model', { dataset_id: 'ds-churn-001' });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.datasetId).toBe('ds-churn-001');
      expect(data.taskType).toBe('classification');
      expect(data.recommendations.length).toBeGreaterThan(0);

      // XGBoost should be top-ranked for classification
      expect(data.recommendations[0].algorithm).toBe('xgboost');
      expect(data.recommendations[0].score).toBeGreaterThan(0.9);
    });

    it('recommends regression algorithms for revenue dataset', async () => {
      const result = await server.callTool('select_model', { dataset_id: 'ds-revenue-001' });
      const data = JSON.parse(result.content[0].text!);

      expect(data.taskType).toBe('regression');
      expect(data.recommendations[0].algorithm).toBe('lightgbm');
    });

    it('respects top_n limit', async () => {
      const result = await server.callTool('select_model', { dataset_id: 'ds-churn-001', top_n: 2 });
      const data = JSON.parse(result.content[0].text!);
      expect(data.recommendations).toHaveLength(2);
    });

    it('allows task_type override', async () => {
      const result = await server.callTool('select_model', {
        dataset_id: 'ds-churn-001',
        task_type: 'regression',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.taskType).toBe('regression');
    });

    it('returns error for non-existent dataset', async () => {
      const result = await server.callTool('select_model', { dataset_id: 'ds-nonexistent' });
      expect(result.isError).toBe(true);
    });

    it('includes pros and cons for each recommendation', async () => {
      const result = await server.callTool('select_model', { dataset_id: 'ds-churn-001' });
      const data = JSON.parse(result.content[0].text!);

      for (const rec of data.recommendations) {
        expect(Array.isArray(rec.pros)).toBe(true);
        expect(Array.isArray(rec.cons)).toBe(true);
        expect(rec.pros.length).toBeGreaterThan(0);
        expect(rec.cons.length).toBeGreaterThan(0);
      }
    });
  });

  // ── train_model (Pro gated) ─────────────────────────────────────────

  describe('train_model', () => {
    it('returns pro_feature upgrade message', async () => {
      const result = await server.callTool('train_model', {
        dataset_id: 'ds-churn-001',
        algorithm: 'xgboost',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBe('pro_feature');
      expect(data.message).toContain('Data Workers Pro');
      expect(data.tool).toBe('train_model');
    });
  });

  // ── evaluate_model ───────────────────────────────────────────────────

  describe('evaluate_model', () => {
    it('evaluates a single model by ID', async () => {
      const result = await server.callTool('evaluate_model', { model_id: 'model-churn-xgb-001' });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.modelId).toBe('model-churn-xgb-001');
      expect(data.algorithm).toBe('xgboost');
      expect(data.metrics.accuracy).toBe(0.94);
      expect(data.metrics.auc).toBe(0.96);
    });

    it('returns leaderboard for dataset', async () => {
      const result = await server.callTool('evaluate_model', { dataset_id: 'ds-churn-001' });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.datasetId).toBe('ds-churn-001');
      expect(data.leaderboard.length).toBeGreaterThanOrEqual(1);
      expect(data.leaderboard[0].rank).toBe(1);
    });

    it('returns error when no arguments provided', async () => {
      const result = await server.callTool('evaluate_model', {});
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toContain('Provide model_id or dataset_id');
    });

    it('returns error for non-existent model', async () => {
      const result = await server.callTool('evaluate_model', { model_id: 'model-nonexistent' });
      expect(result.isError).toBe(true);
    });
  });

  // ── deploy_model (Pro gated) ────────────────────────────────────────

  describe('deploy_model', () => {
    it('returns pro_feature upgrade message', async () => {
      const result = await server.callTool('deploy_model', {
        model_id: 'model-churn-xgb-001',
        environment: 'staging',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBe('pro_feature');
      expect(data.message).toContain('Data Workers Pro');
      expect(data.tool).toBe('deploy_model');
    });
  });

  // ── get_ml_status ────────────────────────────────────────────────────

  describe('get_ml_status', () => {
    it('returns status for a seeded model', async () => {
      const result = await server.callTool('get_ml_status', { model_id: 'model-churn-xgb-001' });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.modelId).toBe('model-churn-xgb-001');
      // Should have model info
      expect(data.model).toBeDefined();
      expect(data.model.algorithm).toBe('xgboost');
      expect(data.model.metrics.accuracy).toBe(0.94);
    });

    it('includes deployment info for deployed models', async () => {
      const result = await server.callTool('get_ml_status', { model_id: 'model-churn-xgb-001' });
      const data = JSON.parse(result.content[0].text!);

      expect(data.deployment).toBeDefined();
      expect(data.deployment.endpoint).toBe('/api/v1/predict/churn');
      expect(data.deployment.environment).toBe('production');
      expect(data.deployment.status).toBe('active');
    });

    it('returns error for non-existent model', async () => {
      const result = await server.callTool('get_ml_status', { model_id: 'model-nonexistent' });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toContain('not found');
    });

    it('returns status for seeded revenue model', async () => {
      const result = await server.callTool('get_ml_status', { model_id: 'model-revenue-lgbm-001' });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.modelId).toBe('model-revenue-lgbm-001');
      expect(data.model).toBeDefined();
      expect(data.model.algorithm).toBe('lightgbm');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // v2 TOOLS
  // ══════════════════════════════════════════════════════════════════════

  // ── create_experiment (Pro gated) ────────────────────────────────────

  describe('create_experiment', () => {
    it('returns pro_feature upgrade message', async () => {
      const result = await server.callTool('create_experiment', {
        name: 'Revenue Forecast v2',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBe('pro_feature');
      expect(data.message).toContain('Data Workers Pro');
      expect(data.tool).toBe('create_experiment');
    });
  });

  // ── log_metrics (Pro gated) ─────────────────────────────────────────

  describe('log_metrics', () => {
    it('returns pro_feature upgrade message', async () => {
      const result = await server.callTool('log_metrics', {
        experiment_id: 'exp-churn-001',
        metrics: { accuracy: 0.96 },
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBe('pro_feature');
      expect(data.message).toContain('Data Workers Pro');
      expect(data.tool).toBe('log_metrics');
    });
  });

  // ── compare_experiments ──────────────────────────────────────────────

  describe('compare_experiments', () => {
    it('compares runs in an experiment', async () => {
      const result = await server.callTool('compare_experiments', {
        experiment_id: 'exp-churn-001',
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.experimentId).toBe('exp-churn-001');
      expect(data.experimentName).toBe('Churn Prediction Experiment');
      expect(data.totalRuns).toBeGreaterThanOrEqual(2);
      expect(data.comparison.length).toBeGreaterThanOrEqual(2);
      expect(data.comparison[0].rank).toBe(1);
    });

    it('ranks by specified metric', async () => {
      const result = await server.callTool('compare_experiments', {
        experiment_id: 'exp-churn-001',
        metric: 'loss',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.rankMetric).toBe('loss');
      expect(data.lowerIsBetter).toBe(true);
    });

    it('respects top_n limit', async () => {
      const result = await server.callTool('compare_experiments', {
        experiment_id: 'exp-churn-001',
        top_n: 1,
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.comparison.length).toBe(1);
    });

    it('returns error for non-existent experiment', async () => {
      const result = await server.callTool('compare_experiments', {
        experiment_id: 'exp-nonexistent',
      });
      expect(result.isError).toBe(true);
    });
  });

  // ── register_model (Pro gated) ──────────────────────────────────────

  describe('register_model', () => {
    it('returns pro_feature upgrade message', async () => {
      const result = await server.callTool('register_model', {
        model_id: 'model-churn-xgb-001',
        model_name: 'churn-predictor',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBe('pro_feature');
      expect(data.message).toContain('Data Workers Pro');
      expect(data.tool).toBe('register_model');
    });
  });

  // ── get_model_versions ───────────────────────────────────────────────

  describe('get_model_versions', () => {
    it('lists versions for a registered model', async () => {
      const result = await server.callTool('get_model_versions', {
        model_name: 'churn-predictor',
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.modelName).toBe('churn-predictor');
      expect(data.totalVersions).toBeGreaterThanOrEqual(1);
      expect(data.versions[0].version).toBeDefined();
      expect(data.versions[0].stage).toBeDefined();
      expect(data.versions[0].algorithm).toBe('xgboost');
    });

    it('filters by stage', async () => {
      const result = await server.callTool('get_model_versions', {
        model_name: 'churn-predictor',
        stage: 'production',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.versions.every((v: any) => v.stage === 'production')).toBe(true);
    });

    it('returns error for non-existent model name', async () => {
      const result = await server.callTool('get_model_versions', {
        model_name: 'nonexistent-model',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toContain('No registered model');
    });
  });

  // ── create_feature_pipeline (Pro gated) ─────────────────────────────

  describe('create_feature_pipeline', () => {
    it('returns pro_feature upgrade message', async () => {
      const result = await server.callTool('create_feature_pipeline', {
        name: 'Revenue Features',
        dataset_id: 'ds-revenue-001',
        transforms: [],
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBe('pro_feature');
      expect(data.message).toContain('Data Workers Pro');
      expect(data.tool).toBe('create_feature_pipeline');
    });
  });

  // ── get_feature_stats ────────────────────────────────────────────────

  describe('get_feature_stats', () => {
    it('returns stats for all features in a dataset', async () => {
      const result = await server.callTool('get_feature_stats', {
        dataset_id: 'ds-churn-001',
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.datasetId).toBe('ds-churn-001');
      expect(data.featureCount).toBe(7); // all columns
      expect(data.stats.length).toBe(7);
    });

    it('returns numeric stats with mean, std, min, max', async () => {
      const result = await server.callTool('get_feature_stats', {
        dataset_id: 'ds-churn-001',
        features: ['tenure_months'],
      });
      const data = JSON.parse(result.content[0].text!);

      const stat = data.stats[0];
      expect(stat.feature).toBe('tenure_months');
      expect(stat.type).toBe('numeric');
      expect(stat.mean).toBeDefined();
      expect(stat.std).toBeDefined();
      expect(stat.min).toBeDefined();
      expect(stat.max).toBeDefined();
      expect(stat.p25).toBeDefined();
      expect(stat.p50).toBeDefined();
      expect(stat.p75).toBeDefined();
    });

    it('returns categorical stats', async () => {
      const result = await server.callTool('get_feature_stats', {
        dataset_id: 'ds-churn-001',
        features: ['contract_type'],
      });
      const data = JSON.parse(result.content[0].text!);

      const stat = data.stats[0];
      expect(stat.type).toBe('categorical');
      expect(stat.uniqueValues).toBe(3);
    });

    it('returns error for non-existent dataset', async () => {
      const result = await server.callTool('get_feature_stats', {
        dataset_id: 'ds-nonexistent',
      });
      expect(result.isError).toBe(true);
    });

    it('returns error for non-existent features', async () => {
      const result = await server.callTool('get_feature_stats', {
        dataset_id: 'ds-churn-001',
        features: ['no_such_column'],
      });
      expect(result.isError).toBe(true);
    });
  });

  // ── explain_model ────────────────────────────────────────────────────

  describe('explain_model', () => {
    it('explains feature importance for a model', async () => {
      const result = await server.callTool('explain_model', {
        model_id: 'model-churn-xgb-001',
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text!);
      expect(data.modelId).toBe('model-churn-xgb-001');
      expect(data.algorithm).toBe('xgboost');
      expect(data.method).toBe('shap');
      expect(data.explanations.length).toBe(5); // 5 features
      expect(data.explanations[0].feature).toBeDefined();
      expect(data.explanations[0].importance).toBeDefined();
      expect(data.explanations[0].direction).toBeDefined();
      expect(data.summary).toContain('Top feature');
    });

    it('supports different explanation methods', async () => {
      const result = await server.callTool('explain_model', {
        model_id: 'model-churn-xgb-001',
        method: 'permutation',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.method).toBe('permutation');
    });

    it('respects top_n limit', async () => {
      const result = await server.callTool('explain_model', {
        model_id: 'model-churn-xgb-001',
        top_n: 2,
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.explanations.length).toBe(2);
    });

    it('importances sum approximately to 1', async () => {
      const result = await server.callTool('explain_model', {
        model_id: 'model-churn-xgb-001',
      });
      const data = JSON.parse(result.content[0].text!);
      const total = data.explanations.reduce((s: number, e: any) => s + e.importance, 0);
      expect(total).toBeGreaterThan(0.95);
      expect(total).toBeLessThan(1.05);
    });

    it('returns error for non-existent model', async () => {
      const result = await server.callTool('explain_model', {
        model_id: 'model-nonexistent',
      });
      expect(result.isError).toBe(true);
    });
  });

  // ── detect_model_drift (Enterprise gated) ───────────────────────────

  describe('detect_model_drift', () => {
    it('returns pro_feature upgrade message', async () => {
      const result = await server.callTool('detect_model_drift', {
        model_id: 'model-churn-xgb-001',
        baseline_dataset_id: 'ds-churn-001',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBe('pro_feature');
      expect(data.message).toContain('Data Workers Pro');
      expect(data.tool).toBe('detect_model_drift');
    });
  });

  // ── ab_test_models (Enterprise gated) ───────────────────────────────

  describe('ab_test_models', () => {
    it('returns pro_feature upgrade message', async () => {
      const result = await server.callTool('ab_test_models', {
        model_a_id: 'model-churn-xgb-001',
        model_b_id: 'model-revenue-lgbm-001',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBe('pro_feature');
      expect(data.message).toContain('Data Workers Pro');
      expect(data.tool).toBe('ab_test_models');
    });
  });
});
