import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { metricStore } from '../backends.js';

export const resolveMetricDefinition: ToolDefinition = {
  name: 'resolve_metric',
  description: 'Resolve an ambiguous metric name to its canonical semantic layer definition. If multiple definitions match, returns all candidates for disambiguation.',
  inputSchema: {
    type: 'object',
    properties: {
      metricName: { type: 'string', description: 'Metric name to resolve (e.g., "revenue", "MRR", "churn rate").' },
      customerId: { type: 'string' },
      domain: { type: 'string', description: 'Optional domain filter (e.g., "finance", "product").' },
    },
    required: ['metricName', 'customerId'],
  },
};

export const resolveMetricHandler: ToolHandler = async (args) => {
  const metricName = (args.metricName as string).toLowerCase();
  const customerId = args.customerId as string;
  const domain = args.domain as string | undefined;

  const result = metricStore.resolveMetric(metricName, customerId, domain);

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
};
