/**
 * publish_usage_events — Publish usage_anomaly_detected and adoption_change events.
 *
 * Publishes events to the message bus when anomalies or adoption changes are detected,
 * enabling other agents to react to usage pattern changes.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { messageBus, relationalStore } from '../backends.js';

export const publishUsageEventsDefinition: ToolDefinition = {
  name: 'publish_usage_events',
  description:
    'Detect and publish usage events to the message bus: usage_anomaly_detected when anomalies are found, adoption_change when agent adoption status shifts. Enables reactive cross-agent workflows.',
  inputSchema: {
    type: 'object',
    properties: {
      eventType: {
        type: 'string',
        description: '"anomaly" or "adoption". Defaults to both.',
      },
    },
    required: [],
  },
};

export const publishUsageEventsHandler: ToolHandler = async (args) => {
  const eventType = args.eventType as string | undefined;
  const publishAnomalies = !eventType || eventType === 'anomaly';
  const publishAdoption = !eventType || eventType === 'adoption';

  try {
    let anomaliesPublished = 0;
    let adoptionPublished = 0;

    if (publishAnomalies) {
      // Detect anomalies (last 1 day vs 7-day baseline)
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const recentCutoff = now - dayMs;
      const baselineCutoff = now - 8 * dayMs;

      const recentEvents = await relationalStore.query(
        'usage_events',
        (row) => (row.timestamp as number) >= recentCutoff,
      );
      const baselineEvents = await relationalStore.query(
        'usage_events',
        (row) => {
          const ts = row.timestamp as number;
          return ts >= baselineCutoff && ts < recentCutoff;
        },
      );

      // Group by agent
      const recentByAgent: Record<string, number> = {};
      const baselineByAgent: Record<string, number> = {};
      for (const r of recentEvents) {
        const a = r.agentName as string;
        recentByAgent[a] = (recentByAgent[a] || 0) + 1;
      }
      for (const r of baselineEvents) {
        const a = r.agentName as string;
        baselineByAgent[a] = (baselineByAgent[a] || 0) + 1;
      }

      for (const [agent, count] of Object.entries(recentByAgent)) {
        const baselineDaily = (baselineByAgent[agent] || 0) / 7;
        if (baselineDaily > 0 && (count < baselineDaily * 0.3 || count > baselineDaily * 5)) {
          await messageBus.publish('usage.anomaly_detected', {
            id: `anomaly-${agent}-${now}`,
            type: 'usage_anomaly_detected',
            payload: {
              agentName: agent,
              currentValue: count,
              baselineValue: Math.round(baselineDaily * 10) / 10,
              direction: count < baselineDaily ? 'drop' : 'spike',
            },
            timestamp: now,
            customerId: 'system',
          });
          anomaliesPublished++;
        }
      }
    }

    if (publishAdoption) {
      // Check for adoption changes by comparing 7d vs prior 7d user counts
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const recentCutoff = now - 7 * dayMs;
      const priorCutoff = now - 14 * dayMs;

      const recentEvents = await relationalStore.query(
        'usage_events',
        (row) => (row.timestamp as number) >= recentCutoff,
      );
      const priorEvents = await relationalStore.query(
        'usage_events',
        (row) => {
          const ts = row.timestamp as number;
          return ts >= priorCutoff && ts < recentCutoff;
        },
      );

      const recentUsers: Record<string, Set<string>> = {};
      const priorUsers: Record<string, Set<string>> = {};
      for (const r of recentEvents) {
        const a = r.agentName as string;
        if (!recentUsers[a]) recentUsers[a] = new Set();
        recentUsers[a].add(r.userId as string);
      }
      for (const r of priorEvents) {
        const a = r.agentName as string;
        if (!priorUsers[a]) priorUsers[a] = new Set();
        priorUsers[a].add(r.userId as string);
      }

      const allAgents = new Set([...Object.keys(recentUsers), ...Object.keys(priorUsers)]);
      for (const agent of allAgents) {
        const recentCount = recentUsers[agent]?.size ?? 0;
        const priorCount = priorUsers[agent]?.size ?? 0;
        if (priorCount > 0 && Math.abs(recentCount - priorCount) / priorCount > 0.3) {
          await messageBus.publish('usage.adoption_change', {
            id: `adoption-${agent}-${now}`,
            type: 'adoption_change',
            payload: {
              agentName: agent,
              currentUsers: recentCount,
              previousUsers: priorCount,
              direction: recentCount > priorCount ? 'growing' : 'declining',
            },
            timestamp: now,
            customerId: 'system',
          });
          adoptionPublished++;
        }
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ anomaliesPublished, adoptionPublished }, null, 2),
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
