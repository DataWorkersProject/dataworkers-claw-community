/**
 * register_usage_datasets — Register usage data with dw-insights for NL querying.
 *
 * Publishes dataset registration events to the message bus so that dw-insights
 * can include usage data tables in its NL-to-SQL query engine.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { messageBus } from '../backends.js';

const USAGE_DATASETS = [
  {
    name: 'usage_events',
    description: 'All MCP tool call events with timestamps, users, agents, tools, outcomes, and durations',
    columns: ['id', 'timestamp', 'userId', 'teamId', 'agentName', 'toolName', 'inputSummary', 'outcome', 'durationMs', 'tokenCount', 'sessionId', 'sequenceIndex'],
  },
  {
    name: 'agent_metrics',
    description: 'Per-agent performance metrics: latency percentiles, error rates, token consumption',
    columns: ['agentName', 'timestamp', 'day', 'p50', 'p95', 'p99', 'errorRate', 'totalInvocations', 'avgTokens', 'avgConfidence', 'escalationRate'],
  },
  {
    name: 'audit_trail',
    description: 'SHA-256 hash-chained audit log entries for agent actions',
    columns: ['id', 'timestamp', 'agentName', 'action', 'input', 'output', 'confidence', 'hash', 'previousHash'],
  },
  {
    name: 'evaluation_scores',
    description: 'Human evaluation scores for agent quality: accuracy, completeness, safety, helpfulness',
    columns: ['agentName', 'evaluatedAt', 'accuracy', 'completeness', 'safety', 'helpfulness'],
  },
];

export const registerUsageDatasetsDefinition: ToolDefinition = {
  name: 'register_usage_datasets',
  description:
    'Register usage intelligence data tables with the dw-insights agent for natural language querying. Enables questions like "which agent has the highest error rate this week?".',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const registerUsageDatasetsHandler: ToolHandler = async () => {
  try {
    let registered = 0;

    for (const dataset of USAGE_DATASETS) {
      try {
        await messageBus.request(
          'dw-insights.register_dataset',
          {
            source: 'dw-usage-intelligence',
            dataset: dataset.name,
            description: dataset.description,
            columns: dataset.columns,
          },
          500,
        );
        registered++;
      } catch {
        // Insights agent may not be available — that's fine, publish an event instead
        await messageBus.publish('usage.dataset_registered', {
          id: `dataset-reg-${dataset.name}-${Date.now()}`,
          type: 'dataset_registered',
          payload: {
            source: 'dw-usage-intelligence',
            dataset: dataset.name,
            description: dataset.description,
            columns: dataset.columns,
          },
          timestamp: Date.now(),
          customerId: 'system',
        });
        registered++;
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          registered,
          totalDatasets: USAGE_DATASETS.length,
          datasets: USAGE_DATASETS.map((d) => d.name),
        }, null, 2),
      }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
