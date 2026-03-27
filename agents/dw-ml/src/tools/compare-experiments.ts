/**
 * compare_experiments — Side-by-side comparison of experiment runs.
 *
 * Enterprise/read tool. Shows metrics delta, hyperparameter diffs,
 * and ranks runs by chosen metric.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { relationalStore, seeded } from '../backends.js';

export const compareExperimentsDefinition: ToolDefinition = {
  name: 'compare_experiments',
  description:
    'Side-by-side comparison of experiment runs. Shows metrics delta, hyperparameter diffs, and ranks runs by chosen metric. (Enterprise tier, read operation)',
  inputSchema: {
    type: 'object',
    properties: {
      experiment_id: { type: 'string', description: 'ID of the experiment to compare runs for.' },
      metric: { type: 'string', description: 'Metric to rank runs by. Default: first available metric.' },
      top_n: { type: 'number', description: 'Number of top runs to return. Default: 10.' },
    },
    required: ['experiment_id'],
  },
};

export const compareExperimentsHandler: ToolHandler = async (args) => {
  await seeded;

  const experimentId = args.experiment_id as string;
  const sortMetric = args.metric as string | undefined;
  const topN = (args.top_n as number) ?? 10;

  try {
    // Validate experiment exists
    const experiments = await relationalStore.query('ml_experiments', (r) => r.id === experimentId);
    if (experiments.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Experiment "${experimentId}" not found` }) }],
        isError: true,
      };
    }

    const experiment = experiments[0];

    // Get all runs for this experiment
    const runs = await relationalStore.query('ml_experiment_runs', (r) => r.experimentId === experimentId);

    if (runs.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `No runs found for experiment "${experimentId}"` }) }],
        isError: true,
      };
    }

    // Parse metrics for all runs
    const parsedRuns = runs.map((run) => {
      const metrics = JSON.parse(run.metrics as string) as Record<string, number>;
      return {
        runId: run.id as string,
        modelId: run.modelId as string | null,
        step: run.step as number,
        metrics,
        loggedAt: new Date(run.loggedAt as number).toISOString(),
      };
    });

    // Determine sort metric
    const availableMetrics = Object.keys(parsedRuns[0].metrics);
    const rankMetric = sortMetric ?? availableMetrics[0];
    const lowerIsBetter = ['loss', 'rmse', 'mae'].includes(rankMetric);

    // Sort runs by metric
    parsedRuns.sort((a, b) => {
      const aVal = a.metrics[rankMetric] ?? (lowerIsBetter ? Infinity : -Infinity);
      const bVal = b.metrics[rankMetric] ?? (lowerIsBetter ? Infinity : -Infinity);
      return lowerIsBetter ? aVal - bVal : bVal - aVal;
    });

    const topRuns = parsedRuns.slice(0, topN);

    // Compute metrics delta between best and worst
    const best = topRuns[0];
    const comparison = topRuns.map((run, index) => {
      const delta: Record<string, number> = {};
      for (const key of availableMetrics) {
        if (best.metrics[key] !== undefined && run.metrics[key] !== undefined) {
          delta[key] = Number((run.metrics[key] - best.metrics[key]).toFixed(6));
        }
      }
      return {
        rank: index + 1,
        ...run,
        deltaFromBest: delta,
      };
    });

    const result = {
      experimentId,
      experimentName: experiment.name,
      rankMetric,
      lowerIsBetter,
      totalRuns: runs.length,
      availableMetrics,
      comparison,
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
