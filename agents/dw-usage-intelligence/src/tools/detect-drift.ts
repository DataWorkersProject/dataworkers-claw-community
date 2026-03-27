/**
 * detect_drift — Threshold-based behavioral drift detection (retained from dw-observability).
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
import { relationalStore, getCurrentTimestamp } from '../backends.js';

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

    const byAgent: Record<string, typeof allRows> = {};
    for (const row of allRows) {
      const name = row.agentName as string;
      if (!byAgent[name]) byAgent[name] = [];
      byAgent[name].push(row);
    }

    const now = getCurrentTimestamp();
    const alerts: DriftAlert[] = [];

    for (const [name, rows] of Object.entries(byAgent)) {
      rows.sort((a, b) => (a.day as number) - (b.day as number));

      const recent = rows.find((r) => (r.day as number) === 0);
      if (!recent) continue;

      const baselineRows = rows.filter((r) => (r.day as number) > 0);
      if (baselineRows.length === 0) continue;

      const baselineErrorRate = baselineRows.reduce((s, r) => s + (r.errorRate as number), 0) / baselineRows.length;
      const baselineP99 = baselineRows.reduce((s, r) => s + (r.p99 as number), 0) / baselineRows.length;

      const currentErrorRate = recent.errorRate as number;
      const currentP99 = recent.p99 as number;

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

      // Escalation rate drift (> 2x baseline)
      const baselineEscalation = baselineRows.reduce((s, r) => s + (r.escalationRate as number), 0) / baselineRows.length;
      const currentEscalation = recent.escalationRate as number;
      if (baselineEscalation > 0 && currentEscalation > baselineEscalation * 2) {
        alerts.push({
          agentName: name,
          metric: 'escalation_rate',
          currentValue: Math.round(currentEscalation * 10000) / 10000,
          baselineValue: Math.round(baselineEscalation * 10000) / 10000,
          threshold: 2.0,
          severity: 'warning',
          detectedAt: now,
        });
      }

      // Confidence drift (dropped > 10% below baseline)
      const baselineConfidence = baselineRows.reduce((s, r) => s + (r.avgConfidence as number), 0) / baselineRows.length;
      const currentConfidence = recent.avgConfidence as number;
      if (baselineConfidence > 0 && currentConfidence < baselineConfidence * 0.9) {
        alerts.push({
          agentName: name,
          metric: 'confidence',
          currentValue: Math.round(currentConfidence * 10000) / 10000,
          baselineValue: Math.round(baselineConfidence * 10000) / 10000,
          threshold: 0.9,
          severity: 'warning',
          detectedAt: now,
        });
      }

      // Token consumption drift (> 2x baseline)
      const baselineTokens = baselineRows.reduce((s, r) => s + (r.avgTokens as number), 0) / baselineRows.length;
      const currentTokens = recent.avgTokens as number;
      if (baselineTokens > 0 && currentTokens > baselineTokens * 2) {
        alerts.push({
          agentName: name,
          metric: 'token_consumption',
          currentValue: Math.round(currentTokens),
          baselineValue: Math.round(baselineTokens),
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
