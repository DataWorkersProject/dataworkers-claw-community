/**
 * get_anomaly_context — Correlate anomalies with deployments and incidents.
 *
 * Enriches anomaly causes by querying deployment and incident data
 * from other agents via the message bus.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { messageBus } from '../backends.js';

export const getAnomalyContextDefinition: ToolDefinition = {
  name: 'get_anomaly_context',
  description:
    'Enrich usage anomaly causes with deployment and incident context from other agents. Correlates anomaly timestamps with recent deployments and active incidents to identify root causes.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Agent where anomaly was detected.' },
      detectedAt: { type: 'number', description: 'Timestamp when anomaly was detected.' },
      windowMs: { type: 'number', description: 'Time window to search for correlated events. Defaults to 3600000 (1 hour).' },
    },
    required: ['agentName', 'detectedAt'],
  },
};

export const getAnomalyContextHandler: ToolHandler = async (args) => {
  const agentName = args.agentName as string;
  const detectedAt = args.detectedAt as number;
  const windowMs = (args.windowMs as number) ?? 3600000;

  try {
    const context: {
      agentName: string;
      detectedAt: number;
      deployments: Record<string, unknown> | null;
      incidents: Record<string, unknown> | null;
      correlationWindow: string;
    } = {
      agentName,
      detectedAt,
      deployments: null,
      incidents: null,
      correlationWindow: `${windowMs / 60000} minutes`,
    };

    // Try to get deployment context
    try {
      const deployments = await messageBus.request(
        'dw-pipelines.get_recent_deployments',
        { agentName, since: detectedAt - windowMs, until: detectedAt, source: 'dw-usage-intelligence' },
        500,
      );
      context.deployments = deployments;
    } catch {
      context.deployments = { available: false, message: 'Pipeline agent not reachable' };
    }

    // Try to get incident context
    try {
      const incidents = await messageBus.request(
        'dw-incidents.get_active_incidents',
        { agentName, since: detectedAt - windowMs, until: detectedAt, source: 'dw-usage-intelligence' },
        500,
      );
      context.incidents = incidents;
    } catch {
      context.incidents = { available: false, message: 'Incident agent not reachable' };
    }

    return { content: [{ type: 'text', text: JSON.stringify(context, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
