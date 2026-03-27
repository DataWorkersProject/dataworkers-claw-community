/**
 * detect_drift — Threshold-based behavioral drift detection.
 *
 * Compares last 1-hour metrics vs 7-day baseline.
 * Alerts if:
 *   - error_rate > 5% (absolute threshold)
 *   - p99 latency > 2x baseline
 *
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { DriftAlert, DriftSeverity } from '../types.js';
import { relationalStore } from '../backends.js';

export const detectDriftDefinition: ToolDefinition = {
  name: 'detect_drift',
  description:
    'Detect behavioral drift by comparing recent metrics against 7-day baseline. Alerts on error rate spikes (>5%) and latency anomalies (p99 > 2x baseline).',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Specific agent to check. Omit for all agents.' },
    },
    required: [],
  },
};

export const detectDriftHandler: ToolHandler = async (args) => {
  const rawAgentName = args.agentName as string | undefined;
  const agentName = rawAgentName?.replace(/^dw-/, '') ?? undefined;

  try {
    // Get all agents or specific one
    const allRows = await relationalStore.query(
      'agent_metrics',
      agentName ? (row) => row.agentName === agentName : undefined,
    );

    if (allRows.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `No metrics found${agentName ? ` for agent '${agentName}'` : ''}` }) }],
        isError: true,
      };
    }

    // Group by agent
    const byAgent: Record<string, typeof allRows> = {};
    for (const row of allRows) {
      const name = row.agentName as string;
      if (!byAgent[name]) byAgent[name] = [];
      byAgent[name].push(row);
    }

    const now = Date.now();
    const alerts: DriftAlert[] = [];

    for (const [name, rows] of Object.entries(byAgent)) {
      // Sort by day (0 = most recent)
      rows.sort((a, b) => (a.day as number) - (b.day as number));

      // Recent = day 0 (last 1 hour approximation)
      const recent = rows.find((r) => (r.day as number) === 0);
      if (!recent) continue;

      // Baseline = average of days 1-6
      const baselineRows = rows.filter((r) => (r.day as number) > 0);
      if (baselineRows.length === 0) continue;

      const baselineErrorRate = baselineRows.reduce((s, r) => s + (r.errorRate as number), 0) / baselineRows.length;
      const baselineP99 = baselineRows.reduce((s, r) => s + (r.p99 as number), 0) / baselineRows.length;

      const currentErrorRate = recent.errorRate as number;
      const currentP99 = recent.p99 as number;

      // Check error rate > 5%
      if (currentErrorRate > 0.05) {
        const severity: DriftSeverity = currentErrorRate > 0.20 ? 'critical' : 'warning';
        alerts.push({
          agentName: name,
          metric: 'error_rate',
          currentValue: Math.round(currentErrorRate * 10000) / 10000,
          baselineValue: Math.round(baselineErrorRate * 10000) / 10000,
          threshold: 0.05,
          severity,
          detectedAt: now,
        });
      }

      // Check p99 > 2x baseline
      if (currentP99 > baselineP99 * 2) {
        alerts.push({
          agentName: name,
          metric: 'p99_latency',
          currentValue: Math.round(currentP99 * 100) / 100,
          baselineValue: Math.round(baselineP99 * 100) / 100,
          threshold: 2.0,
          severity: 'warning',
          detectedAt: now,
        });
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify(alerts, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
