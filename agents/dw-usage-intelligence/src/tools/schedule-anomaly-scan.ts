/**
 * schedule_anomaly_scan — Schedule recurring anomaly detection (Pro tier).
 *
 * Stores schedule configuration in KV store.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { kvStore } from '../backends.js';

export const scheduleAnomalyScanDefinition: ToolDefinition = {
  name: 'schedule_anomaly_scan',
  description:
    'Schedule recurring anomaly detection scans. Configure frequency, sensitivity, and target agents. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      scheduleId: { type: 'string', description: 'Unique schedule identifier. Auto-generated if omitted.' },
      cron: { type: 'string', description: 'Cron expression for scan frequency. Defaults to "0 */6 * * *" (every 6 hours).' },
      sensitivity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Detection sensitivity. Defaults to "medium".' },
      agentName: { type: 'string', description: 'Target specific agent. Omit for all agents.' },
      enabled: { type: 'boolean', description: 'Whether the schedule is active. Defaults to true.' },
    },
    required: [],
  },
};

export const scheduleAnomalyScanHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('schedule_anomaly_scan')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'schedule_anomaly_scan requires Pro tier or higher. Set DW_LICENSE_TIER=pro to enable.' }) }],
      isError: true,
    };
  }

  try {
    const scheduleId = (args.scheduleId as string) ?? `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cron = (args.cron as string) ?? '0 */6 * * *';
    const sensitivity = (args.sensitivity as string) ?? 'medium';
    const agentName = args.agentName as string | undefined;
    const enabled = (args.enabled as boolean) ?? true;

    const schedule = {
      scheduleId,
      cron,
      sensitivity,
      agentName: agentName ?? 'all',
      enabled,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await kvStore.set(`anomaly_schedule:${scheduleId}`, JSON.stringify(schedule));

    return {
      content: [{ type: 'text', text: JSON.stringify({ ...schedule, status: 'scheduled' }, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
