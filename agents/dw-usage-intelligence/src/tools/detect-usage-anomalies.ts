/**
 * detect_usage_anomalies — Drops, spikes, and behavior shifts in usage patterns.
 *
 * Compares recent usage (last 1 day) against a 7-day baseline.
 * Alerts on significant deviations per agent/tool.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { UsageAnomaly, UsageAnomaliesResult, AnomalySeverity } from '../types.js';
import { relationalStore, getCurrentTimestamp } from '../backends.js';

export const detectUsageAnomaliesDefinition: ToolDefinition = {
  name: 'detect_usage_anomalies',
  description:
    'Detect anomalies in practitioner usage patterns: sudden drops (possible friction), unusual spikes (automation loops or incidents), and behavior shifts. Compares recent usage against baseline.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Check specific agent. Omit for all agents.' },
      sensitivity: { type: 'string', description: '"low", "medium", "high". Defaults to "medium". Higher sensitivity means smaller deviations trigger alerts.' },
    },
    required: [],
  },
};

export const detectUsageAnomaliesHandler: ToolHandler = async (args) => {
  const agentName = args.agentName as string | undefined;
  const sensitivity = (args.sensitivity as string) ?? 'medium';

  try {
    const now = getCurrentTimestamp();
    const dayMs = 24 * 60 * 60 * 1000;
    const recentCutoff = now - dayMs;
    const baselineCutoff = now - 8 * dayMs; // 7 days before recent

    // Thresholds based on sensitivity
    const dropThreshold = sensitivity === 'high' ? 0.7 : sensitivity === 'low' ? 0.3 : 0.5;
    const spikeMultiplier = sensitivity === 'high' ? 2 : sensitivity === 'low' ? 5 : 3;

    // Get recent and baseline events
    const recentEvents = await relationalStore.query(
      'usage_events',
      (row) => {
        if ((row.timestamp as number) < recentCutoff) return false;
        if (agentName && row.agentName !== agentName) return false;
        return true;
      },
    );

    const baselineEvents = await relationalStore.query(
      'usage_events',
      (row) => {
        const ts = row.timestamp as number;
        if (ts < baselineCutoff || ts >= recentCutoff) return false;
        if (agentName && row.agentName !== agentName) return false;
        return true;
      },
    );

    // Group by agent:tool
    const recentByTool: Record<string, number> = {};
    const baselineByTool: Record<string, number> = {};
    const agentSet = new Set<string>();

    for (const row of recentEvents) {
      const key = `${row.agentName}:${row.toolName}`;
      recentByTool[key] = (recentByTool[key] || 0) + 1;
      agentSet.add(row.agentName as string);
    }

    for (const row of baselineEvents) {
      const key = `${row.agentName}:${row.toolName}`;
      baselineByTool[key] = (baselineByTool[key] || 0) + 1;
      agentSet.add(row.agentName as string);
    }

    const anomalies: UsageAnomaly[] = [];
    const allKeys = new Set([...Object.keys(recentByTool), ...Object.keys(baselineByTool)]);

    for (const key of allKeys) {
      const [agent, tool] = key.split(':');
      const recentCount = recentByTool[key] || 0;
      const baselineCount = baselineByTool[key] || 0;
      const baselineDailyAvg = baselineCount / 7; // 7 day baseline

      if (baselineDailyAvg < 1 && recentCount < 3) continue; // Skip very low usage tools

      // Check for usage drop
      if (baselineDailyAvg > 0 && recentCount < baselineDailyAvg * dropThreshold) {
        const dropPct = Math.round((1 - recentCount / baselineDailyAvg) * 100);
        const severity: AnomalySeverity = dropPct > 80 ? 'critical' : dropPct > 50 ? 'warning' : 'info';
        anomalies.push({
          type: 'usage_drop',
          agentName: agent,
          toolName: tool,
          description: `Usage dropped ${dropPct}% vs 7-day baseline`,
          currentValue: recentCount,
          baselineValue: Math.round(baselineDailyAvg * 10) / 10,
          severity,
          possibleCauses: ['tool_friction', 'alternative_discovered', 'seasonal_pattern'],
          detectedAt: now,
        });
      }

      // Check for usage spike
      if (baselineDailyAvg > 0 && recentCount > baselineDailyAvg * spikeMultiplier) {
        const spikePct = Math.round((recentCount / baselineDailyAvg - 1) * 100);
        const severity: AnomalySeverity = spikePct > 500 ? 'warning' : 'info';
        anomalies.push({
          type: 'usage_spike',
          agentName: agent,
          toolName: tool,
          description: `${spikePct}% increase vs 7-day daily average`,
          currentValue: recentCount,
          baselineValue: Math.round(baselineDailyAvg * 10) / 10,
          severity,
          possibleCauses: ['active_incident_investigation', 'automation_loop', 'new_user_onboarding'],
          detectedAt: now,
        });
      }
    }

    // ── Behavior shift detection ──────────────────────────
    // A behavior shift means the tool-usage distribution within an agent
    // changed significantly between baseline and recent periods.
    const behaviorShiftThreshold = sensitivity === 'high' ? 0.25 : sensitivity === 'low' ? 0.55 : 0.40;

    // Group by agent for distribution comparison
    const recentByAgent: Record<string, Record<string, number>> = {};
    const baselineByAgent: Record<string, Record<string, number>> = {};

    for (const row of recentEvents) {
      const agent = row.agentName as string;
      const tool = row.toolName as string;
      if (!recentByAgent[agent]) recentByAgent[agent] = {};
      recentByAgent[agent][tool] = (recentByAgent[agent][tool] || 0) + 1;
    }
    for (const row of baselineEvents) {
      const agent = row.agentName as string;
      const tool = row.toolName as string;
      if (!baselineByAgent[agent]) baselineByAgent[agent] = {};
      baselineByAgent[agent][tool] = (baselineByAgent[agent][tool] || 0) + 1;
    }

    for (const agent of Object.keys(recentByAgent)) {
      const recentDist = recentByAgent[agent];
      const baselineDist = baselineByAgent[agent];
      if (!baselineDist) continue;

      const recentTotal = Object.values(recentDist).reduce((s, v) => s + v, 0);
      const baselineTotal = Object.values(baselineDist).reduce((s, v) => s + v, 0);
      if (recentTotal < 3 || baselineTotal < 3) continue;

      // Compute Jensen-Shannon-like divergence via tool proportion differences
      const allTools = new Set([...Object.keys(recentDist), ...Object.keys(baselineDist)]);
      let divergence = 0;
      for (const tool of allTools) {
        const recentProp = (recentDist[tool] || 0) / recentTotal;
        const baselineProp = (baselineDist[tool] || 0) / baselineTotal;
        divergence += Math.abs(recentProp - baselineProp);
      }
      divergence /= 2; // Normalize to 0-1

      if (divergence > behaviorShiftThreshold) {
        // Find the tool with the biggest shift
        let maxShiftTool = '';
        let maxShift = 0;
        for (const tool of allTools) {
          const recentProp = (recentDist[tool] || 0) / recentTotal;
          const baselineProp = (baselineDist[tool] || 0) / baselineTotal;
          const shift = Math.abs(recentProp - baselineProp);
          if (shift > maxShift) { maxShift = shift; maxShiftTool = tool; }
        }

        const severity: AnomalySeverity = divergence > 0.6 ? 'warning' : 'info';
        anomalies.push({
          type: 'behavior_shift',
          agentName: agent,
          toolName: maxShiftTool,
          description: `Tool usage distribution shifted ${Math.round(divergence * 100)}% vs baseline — most changed tool: ${maxShiftTool}`,
          currentValue: Math.round(divergence * 100),
          baselineValue: 0,
          severity,
          possibleCauses: ['workflow_change', 'new_feature_adoption', 'team_restructuring'],
          detectedAt: now,
        });
      }
    }

    // Sort by severity (critical first)
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const result: UsageAnomaliesResult = {
      anomalies,
      checkedAgents: agentSet.size,
      totalAnomalies: anomalies.length,
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
