/**
 * get_adoption_dashboard — Which tools/agents are adopted vs. shelfware.
 *
 * Computes adoption rates, growth trends, and identifies underused tools.
 * NO LLM calls — purely deterministic aggregation.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { AgentAdoption, AdoptionStatus, AdoptionDashboardResult } from '../types.js';
import { relationalStore, kvStore, getCurrentTimestamp } from '../backends.js';

export const getAdoptionDashboardDefinition: ToolDefinition = {
  name: 'get_adoption_dashboard',
  description:
    'Get platform adoption metrics: which agents and tools are being adopted, growing, underused, or shelfware. Shows adoption rates, week-over-week growth, and identifies tools that need attention.',
  inputSchema: {
    type: 'object',
    properties: {
      period: { type: 'string', description: 'Time period: "7d", "30d", "90d". Defaults to "30d".' },
      threshold: { type: 'number', description: 'Minimum calls per user to count as "adopted". Defaults to 5.' },
    },
    required: [],
  },
};

export const getAdoptionDashboardHandler: ToolHandler = async (args) => {
  const period = (args.period as string) ?? '30d';
  const threshold = (args.threshold as number) ?? 5;

  try {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = getCurrentTimestamp();
    const cutoff = now - days * dayMs;
    const priorCutoff = cutoff - days * dayMs;
    const weekCutoff = now - 7 * dayMs;
    const priorWeekCutoff = weekCutoff - 7 * dayMs;

    // Get all practitioners who have ever used the platform (cached via kvStore)
    const CACHE_KEY = 'adoption:all_practitioners';
    let allPractitioners: Set<string>;
    const cached = await kvStore.get(CACHE_KEY);
    if (cached) {
      allPractitioners = new Set(JSON.parse(cached) as string[]);
    } else {
      const allEvents = await relationalStore.query('usage_events');
      allPractitioners = new Set(allEvents.map((r) => r.userId as string));
      await kvStore.set(CACHE_KEY, JSON.stringify([...allPractitioners]));
    }

    const currentEvents = await relationalStore.query(
      'usage_events',
      (row) => (row.timestamp as number) >= cutoff,
    );

    const activePractitioners = new Set(currentEvents.map((r) => r.userId as string));

    // Group by agent
    const agentEvents: Record<string, typeof currentEvents> = {};
    for (const row of currentEvents) {
      const agent = row.agentName as string;
      if (!agentEvents[agent]) agentEvents[agent] = [];
      agentEvents[agent].push(row);
    }

    // Week-over-week data
    const thisWeekEvents = await relationalStore.query(
      'usage_events',
      (row) => (row.timestamp as number) >= weekCutoff,
    );
    const priorWeekEvents = await relationalStore.query(
      'usage_events',
      (row) => {
        const ts = row.timestamp as number;
        return ts >= priorWeekCutoff && ts < weekCutoff;
      },
    );

    const thisWeekByAgent: Record<string, number> = {};
    const priorWeekByAgent: Record<string, number> = {};
    for (const row of thisWeekEvents) {
      const a = row.agentName as string;
      thisWeekByAgent[a] = (thisWeekByAgent[a] || 0) + 1;
    }
    for (const row of priorWeekEvents) {
      const a = row.agentName as string;
      priorWeekByAgent[a] = (priorWeekByAgent[a] || 0) + 1;
    }

    const agents: AgentAdoption[] = [];
    let fastestGrowth = -Infinity;
    let fastestGrowingAgent = '';
    let lowestAdoption = Infinity;
    let needsAttentionAgent = '';

    for (const [agentName, events] of Object.entries(agentEvents)) {
      const totalCalls = events.length;
      const userCounts: Record<string, number> = {};
      const toolCounts: Record<string, number> = {};

      for (const event of events) {
        const uid = event.userId as string;
        const tool = event.toolName as string;
        userCounts[uid] = (userCounts[uid] || 0) + 1;
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }

      const totalUsers = Object.keys(userCounts).length;
      const activeUsers = Object.entries(userCounts).filter(([, count]) => count >= threshold).length;
      const adoptionRate = Math.round((activeUsers / allPractitioners.size) * 100) / 100;

      // Week-over-week growth
      const thisWeek = thisWeekByAgent[agentName] || 0;
      const priorWeek = priorWeekByAgent[agentName] || 1;
      const weekOverWeekGrowth = Math.round(((thisWeek - priorWeek) / priorWeek) * 100) / 100;

      // Top and underused tools
      const sortedTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);
      const topTools = sortedTools.slice(0, 2).map(([name]) => name);
      const underusedTools = sortedTools.slice(-2).filter(([, count]) => count < totalCalls * 0.1).map(([name]) => name);

      // Classify adoption status
      let status: AdoptionStatus;
      if (adoptionRate >= 0.5 && weekOverWeekGrowth >= -0.1) {
        status = 'fully_adopted';
      } else if (weekOverWeekGrowth > 0.1) {
        status = 'growing';
      } else if (adoptionRate >= 0.15) {
        status = 'underused';
      } else {
        status = 'shelfware';
      }

      agents.push({
        agentName,
        status,
        totalUsers,
        activeUsers,
        adoptionRate,
        totalCalls,
        weekOverWeekGrowth,
        topTools,
        underusedTools,
      });

      if (weekOverWeekGrowth > fastestGrowth) {
        fastestGrowth = weekOverWeekGrowth;
        fastestGrowingAgent = agentName;
      }
      if (adoptionRate < lowestAdoption) {
        lowestAdoption = adoptionRate;
        needsAttentionAgent = agentName;
      }
    }

    // Sort by adoption rate descending
    agents.sort((a, b) => b.adoptionRate - a.adoptionRate);

    const result: AdoptionDashboardResult = {
      period,
      agents,
      platformSummary: {
        totalPractitioners: allPractitioners.size,
        activePractitioners: activePractitioners.size,
        platformAdoptionRate: Math.round((activePractitioners.size / allPractitioners.size) * 100) / 100,
        fastestGrowingAgent,
        needsAttentionAgent,
      },
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
