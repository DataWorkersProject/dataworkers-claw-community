/**
 * get_evaluation_report — Human evaluation scores.
 *
 * Aggregates evaluation scores for an agent across accuracy, completeness,
 * safety, and helpfulness dimensions.
 *
 * NO LLM calls — purely deterministic aggregation.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { EvaluationReport } from '../types.js';
import { relationalStore } from '../backends.js';

export const getEvaluationReportDefinition: ToolDefinition = {
  name: 'get_evaluation_report',
  description:
    'Get aggregated human evaluation scores for an agent. Breaks down by accuracy, completeness, safety, and helpfulness.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Name of the agent to evaluate.' },
      period: { type: 'string', description: 'Time period: "7d", "30d". Defaults to "7d".' },
    },
    required: ['agentName'],
  },
};

export const getEvaluationReportHandler: ToolHandler = async (args) => {
  const agentName = args.agentName as string;
  const period = (args.period as string) ?? '7d';

  try {
    const rows = await relationalStore.query(
      'evaluation_scores',
      (row) => row.agentName === agentName,
    );

    if (rows.length === 0) {
      const emptyReport: EvaluationReport = {
        agentName,
        period,
        averageScore: 0,
        totalEvaluations: 0,
        breakdown: { accuracy: 0, completeness: 0, safety: 0, helpfulness: 0 },
      };
      return {
        content: [{ type: 'text', text: JSON.stringify({ ...emptyReport, message: 'No evaluation data available yet' }, null, 2) }],
      };
    }

    const totalEvaluations = rows.length;
    const avgAccuracy = rows.reduce((s, r) => s + (r.accuracy as number), 0) / totalEvaluations;
    const avgCompleteness = rows.reduce((s, r) => s + (r.completeness as number), 0) / totalEvaluations;
    const avgSafety = rows.reduce((s, r) => s + (r.safety as number), 0) / totalEvaluations;
    const avgHelpfulness = rows.reduce((s, r) => s + (r.helpfulness as number), 0) / totalEvaluations;

    const averageScore = (avgAccuracy + avgCompleteness + avgSafety + avgHelpfulness) / 4;

    const report: EvaluationReport = {
      agentName,
      period,
      averageScore: Math.round(averageScore * 10000) / 10000,
      totalEvaluations,
      breakdown: {
        accuracy: Math.round(avgAccuracy * 10000) / 10000,
        completeness: Math.round(avgCompleteness * 10000) / 10000,
        safety: Math.round(avgSafety * 10000) / 10000,
        helpfulness: Math.round(avgHelpfulness * 10000) / 10000,
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
