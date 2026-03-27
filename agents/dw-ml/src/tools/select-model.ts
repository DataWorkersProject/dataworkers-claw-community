/**
 * select_model — Recommend ML algorithms based on dataset characteristics.
 *
 * Community/read tool. Analyzes dataset size, feature types, task type, and
 * class balance to recommend appropriate algorithms with rationale.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ColumnInfo, Algorithm, TaskType } from '../types.js';
import { relationalStore, seeded } from '../backends.js';

export const selectModelDefinition: ToolDefinition = {
  name: 'select_model',
  description:
    'Given dataset characteristics, recommend ML algorithms (XGBoost, LightGBM, RandomForest, LinearRegression, LogisticRegression) with rationale.',
  inputSchema: {
    type: 'object',
    properties: {
      dataset_id: { type: 'string', description: 'ID of the dataset to analyze.' },
      task_type: {
        type: 'string',
        enum: ['classification', 'regression', 'timeseries', 'anomaly'],
        description: 'Override task type. If omitted, uses dataset metadata.',
      },
      top_n: { type: 'number', description: 'Number of recommendations to return. Default: 3.' },
    },
    required: ['dataset_id'],
  },
};

interface ModelRecommendation {
  algorithm: Algorithm;
  score: number;
  reason: string;
  pros: string[];
  cons: string[];
  estimatedTrainingTimeMs: number;
}

export const selectModelHandler: ToolHandler = async (args) => {
  await seeded;

  const datasetId = args.dataset_id as string;
  const topN = (args.top_n as number) ?? 3;

  try {
    const rows = await relationalStore.query('ml_datasets', (r) => r.id === datasetId);

    if (rows.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Dataset "${datasetId}" not found` }) }],
        isError: true,
      };
    }

    const dataset = rows[0];
    const columns: ColumnInfo[] = JSON.parse(dataset.columns as string);
    const rowCount = dataset.rowCount as number;
    const taskType = (args.task_type as TaskType) ?? (dataset.taskType as TaskType) ?? 'classification';

    const numericCols = columns.filter((c) => c.type === 'numeric').length;
    const categoricalCols = columns.filter((c) => c.type === 'categorical').length;
    const isLargeDataset = rowCount > 10000;

    const recommendations: ModelRecommendation[] = [];

    if (taskType === 'classification') {
      recommendations.push({
        algorithm: 'xgboost',
        score: 0.95,
        reason: 'XGBoost excels on tabular classification with mixed feature types',
        pros: ['Handles missing values natively', 'Built-in regularization', 'Feature importance'],
        cons: ['Requires hyperparameter tuning', 'Slower than LightGBM on large datasets'],
        estimatedTrainingTimeMs: Math.round(rowCount * 0.8),
      });

      recommendations.push({
        algorithm: 'lightgbm',
        score: isLargeDataset ? 0.93 : 0.88,
        reason: isLargeDataset
          ? 'LightGBM is fastest on large datasets with histogram-based splitting'
          : 'LightGBM is efficient but XGBoost may edge it on smaller datasets',
        pros: ['Very fast training', 'Low memory usage', 'Handles categorical features natively'],
        cons: ['Can overfit on small datasets', 'Less interpretable than linear models'],
        estimatedTrainingTimeMs: Math.round(rowCount * 0.5),
      });

      recommendations.push({
        algorithm: 'random_forest',
        score: 0.85,
        reason: 'Random Forest is robust with minimal tuning, good baseline',
        pros: ['Minimal hyperparameter tuning', 'Resistant to overfitting', 'Parallelizable'],
        cons: ['Slower inference', 'Less accurate than boosting methods', 'Large model size'],
        estimatedTrainingTimeMs: Math.round(rowCount * 1.2),
      });

      recommendations.push({
        algorithm: 'logistic_regression',
        score: categoricalCols < numericCols ? 0.75 : 0.65,
        reason: 'Logistic Regression provides interpretable baseline with fast training',
        pros: ['Highly interpretable', 'Very fast training and inference', 'Works well with feature engineering'],
        cons: ['Assumes linear decision boundary', 'Requires feature engineering', 'Lower accuracy on complex patterns'],
        estimatedTrainingTimeMs: Math.round(rowCount * 0.1),
      });
    } else if (taskType === 'regression') {
      recommendations.push({
        algorithm: 'lightgbm',
        score: 0.94,
        reason: 'LightGBM handles non-linear regression patterns efficiently',
        pros: ['Fast training', 'Handles non-linear relationships', 'Feature importance'],
        cons: ['Requires tuning for optimal results', 'Can overfit without regularization'],
        estimatedTrainingTimeMs: Math.round(rowCount * 0.6),
      });

      recommendations.push({
        algorithm: 'xgboost',
        score: 0.92,
        reason: 'XGBoost provides robust regression with built-in regularization',
        pros: ['Strong regularization options', 'Handles missing values', 'Flexible loss functions'],
        cons: ['Slower than LightGBM', 'Memory intensive on large datasets'],
        estimatedTrainingTimeMs: Math.round(rowCount * 0.9),
      });

      recommendations.push({
        algorithm: 'random_forest',
        score: 0.83,
        reason: 'Random Forest regression is a solid baseline with low variance',
        pros: ['Robust to outliers', 'No assumption of linearity', 'Feature importance'],
        cons: ['Cannot extrapolate beyond training range', 'Large model size'],
        estimatedTrainingTimeMs: Math.round(rowCount * 1.0),
      });

      recommendations.push({
        algorithm: 'linear_regression',
        score: numericCols > categoricalCols ? 0.72 : 0.60,
        reason: 'Linear Regression is the interpretable baseline for regression tasks',
        pros: ['Fully interpretable coefficients', 'Fastest training', 'Statistical significance tests'],
        cons: ['Assumes linearity', 'Sensitive to outliers', 'Requires feature engineering'],
        estimatedTrainingTimeMs: Math.round(rowCount * 0.05),
      });
    } else {
      // timeseries / anomaly — recommend gradient boosting family
      recommendations.push({
        algorithm: 'gradient_boosting',
        score: 0.88,
        reason: `Gradient Boosting is versatile for ${taskType} tasks on engineered features`,
        pros: ['Handles non-linear patterns', 'Works with lag features', 'Good accuracy'],
        cons: ['Requires feature engineering for temporal data', 'Sequential training'],
        estimatedTrainingTimeMs: Math.round(rowCount * 1.0),
      });

      recommendations.push({
        algorithm: 'xgboost',
        score: 0.86,
        reason: `XGBoost with time-based features works well for ${taskType}`,
        pros: ['Robust performance', 'Handles missing values', 'Regularization prevents overfitting'],
        cons: ['Not natively temporal', 'Needs manual lag feature creation'],
        estimatedTrainingTimeMs: Math.round(rowCount * 0.8),
      });

      recommendations.push({
        algorithm: 'random_forest',
        score: 0.78,
        reason: 'Random Forest baseline for comparison',
        pros: ['Simple to train', 'Good baseline', 'Robust'],
        cons: ['Not optimized for sequential data', 'Large model'],
        estimatedTrainingTimeMs: Math.round(rowCount * 1.2),
      });
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    const result = {
      datasetId,
      datasetName: dataset.name,
      taskType,
      rowCount,
      featureBreakdown: {
        numeric: numericCols,
        categorical: categoricalCols,
        total: columns.length,
      },
      recommendations: recommendations.slice(0, topN),
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
