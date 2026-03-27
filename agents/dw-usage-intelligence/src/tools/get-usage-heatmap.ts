/**
 * get_usage_heatmap — Usage distribution by time, day, or user.
 *
 * Returns multi-dimensional usage data for visualization.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { HeatmapCell, UsageHeatmapResult } from '../types.js';
import { relationalStore, getCurrentTimestamp } from '../backends.js';

export const getUsageHeatmapDefinition: ToolDefinition = {
  name: 'get_usage_heatmap',
  description:
    'Get usage heatmap data showing when and where practitioners interact with the platform. Supports hourly (by hour of day), daily (by day of week), and agent_x_user (agent vs user matrix) dimensions.',
  inputSchema: {
    type: 'object',
    properties: {
      dimension: { type: 'string', description: '"hourly", "daily", or "agent_x_user". Defaults to "hourly".' },
      period: { type: 'string', description: '"7d", "30d". Defaults to "7d".' },
      agentName: { type: 'string', description: 'Filter by agent. Omit for all agents.' },
    },
    required: [],
  },
};

export const getUsageHeatmapHandler: ToolHandler = async (args) => {
  const dimension = (args.dimension as string) ?? 'hourly';
  const period = (args.period as string) ?? '7d';
  const agentName = args.agentName as string | undefined;

  try {
    const days = period === '30d' ? 30 : 7;
    const cutoff = getCurrentTimestamp() - days * 24 * 60 * 60 * 1000;

    const rows = await relationalStore.query(
      'usage_events',
      (row) => {
        if ((row.timestamp as number) < cutoff) return false;
        if (agentName && row.agentName !== agentName) return false;
        return true;
      },
    );

    let heatmap: HeatmapCell[] = [];
    let peakBucket: number | string = 0;
    let quietBucket: number | string = 0;
    let peakCount = 0;
    let quietCount = Infinity;

    if (dimension === 'hourly') {
      // Group by hour of day (0-23)
      const buckets: Record<number, { count: number; users: Set<string>; agents: Record<string, number> }> = {};

      for (let h = 0; h < 24; h++) {
        buckets[h] = { count: 0, users: new Set(), agents: {} };
      }

      for (const row of rows) {
        const hour = new Date(row.timestamp as number).getHours();
        buckets[hour].count++;
        buckets[hour].users.add(row.userId as string);
        const agent = row.agentName as string;
        buckets[hour].agents[agent] = (buckets[hour].agents[agent] || 0) + 1;
      }

      for (let h = 0; h < 24; h++) {
        const b = buckets[h];
        const topAgent = Object.entries(b.agents).sort((a, b2) => b2[1] - a[1])[0]?.[0] ?? 'none';
        heatmap.push({
          bucket: h,
          totalCalls: b.count,
          uniqueUsers: b.users.size,
          topAgent,
        });

        if (b.count > peakCount) { peakCount = b.count; peakBucket = h; }
        if (b.count < quietCount) { quietCount = b.count; quietBucket = h; }
      }
    } else if (dimension === 'daily') {
      // Group by day of week (0=Sun, 6=Sat)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const buckets: Record<number, { count: number; users: Set<string>; agents: Record<string, number> }> = {};

      for (let d = 0; d < 7; d++) {
        buckets[d] = { count: 0, users: new Set(), agents: {} };
      }

      for (const row of rows) {
        const dayOfWeek = new Date(row.timestamp as number).getDay();
        buckets[dayOfWeek].count++;
        buckets[dayOfWeek].users.add(row.userId as string);
        const agent = row.agentName as string;
        buckets[dayOfWeek].agents[agent] = (buckets[dayOfWeek].agents[agent] || 0) + 1;
      }

      for (let d = 0; d < 7; d++) {
        const b = buckets[d];
        const topAgent = Object.entries(b.agents).sort((a, b2) => b2[1] - a[1])[0]?.[0] ?? 'none';
        heatmap.push({
          bucket: dayNames[d],
          totalCalls: b.count,
          uniqueUsers: b.users.size,
          topAgent,
        });

        if (b.count > peakCount) { peakCount = b.count; peakBucket = dayNames[d]; }
        if (b.count < quietCount) { quietCount = b.count; quietBucket = dayNames[d]; }
      }
    } else if (dimension === 'agent_x_user') {
      // True agent × user matrix — each cell is an agent:user pair
      const buckets: Record<string, { count: number }> = {};

      for (const row of rows) {
        const agent = row.agentName as string;
        const user = row.userId as string;
        const key = `${agent}:${user}`;
        if (!buckets[key]) buckets[key] = { count: 0 };
        buckets[key].count++;
      }

      for (const [key, b] of Object.entries(buckets)) {
        const [agent] = key.split(':');
        heatmap.push({
          bucket: key,
          totalCalls: b.count,
          uniqueUsers: 1,
          topAgent: agent,
        });

        if (b.count > peakCount) { peakCount = b.count; peakBucket = key; }
        if (b.count < quietCount) { quietCount = b.count; quietBucket = key; }
      }

      // Sort by totalCalls descending
      heatmap.sort((a, b) => b.totalCalls - a.totalCalls);
    }

    // Weekday vs weekend comparison
    let weekdayVsWeekend: { weekdayAvgCalls: number; weekendAvgCalls: number } | undefined;
    if (dimension === 'hourly' || dimension === 'daily') {
      let weekdayCount = 0;
      let weekendCount = 0;
      let weekdayDays = 0;
      let weekendDays = 0;

      // Count actual weekday/weekend days in period
      for (let d = 0; d < days; d++) {
        const dayDate = new Date(getCurrentTimestamp() - d * 24 * 60 * 60 * 1000);
        const dow = dayDate.getDay();
        if (dow === 0 || dow === 6) weekendDays++;
        else weekdayDays++;
      }

      for (const row of rows) {
        const dow = new Date(row.timestamp as number).getDay();
        if (dow === 0 || dow === 6) weekendCount++;
        else weekdayCount++;
      }

      weekdayVsWeekend = {
        weekdayAvgCalls: weekdayDays > 0 ? Math.round(weekdayCount / weekdayDays) : 0,
        weekendAvgCalls: weekendDays > 0 ? Math.round(weekendCount / weekendDays) : 0,
      };
    }

    const result: UsageHeatmapResult = {
      dimension,
      period,
      heatmap,
      peakBucket,
      quietBucket,
      weekdayVsWeekend,
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
