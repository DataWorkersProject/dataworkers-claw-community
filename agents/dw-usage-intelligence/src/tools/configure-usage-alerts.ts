/**
 * configure_usage_alerts — Configure alert thresholds for usage metrics (Pro tier).
 *
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { kvStore } from '../backends.js';

export const configureUsageAlertsDefinition: ToolDefinition = {
  name: 'configure_usage_alerts',
  description:
    'Configure alert thresholds for usage metrics. Set thresholds for usage drops, spikes, and error rates per agent. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      alertId: { type: 'string', description: 'Unique alert identifier. Auto-generated if omitted.' },
      agentName: { type: 'string', description: 'Target agent. Omit for platform-wide alerts.' },
      metric: { type: 'string', enum: ['usage_drop', 'usage_spike', 'error_rate', 'latency'], description: 'Metric to monitor. Defaults to "usage_drop".' },
      threshold: { type: 'number', description: 'Alert threshold value (e.g., 0.3 for 30% drop). Defaults to 0.3.' },
      enabled: { type: 'boolean', description: 'Whether the alert is active. Defaults to true.' },
    },
    required: [],
  },
};

export const configureUsageAlertsHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('configure_usage_alerts')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'configure_usage_alerts requires Pro tier or higher. Set DW_LICENSE_TIER=pro to enable.' }) }],
      isError: true,
    };
  }

  try {
    const alertId = (args.alertId as string) ?? `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const agentName = args.agentName as string | undefined;
    const metric = (args.metric as string) ?? 'usage_drop';
    const threshold = (args.threshold as number) ?? 0.3;
    const enabled = (args.enabled as boolean) ?? true;

    const alert = {
      alertId,
      agentName: agentName ?? 'all',
      metric,
      threshold,
      enabled,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await kvStore.set(`usage_alert:${alertId}`, JSON.stringify(alert));

    return {
      content: [{ type: 'text', text: JSON.stringify({ ...alert, status: 'configured' }, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
