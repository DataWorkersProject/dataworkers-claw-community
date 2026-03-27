/**
 * get_session_analytics — Session depth, duration, and power user identification.
 *
 * Reconstructs sessions from usage events (gap-based) and classifies users.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { UserSessionBreakdown, UserType, SessionAnalyticsResult } from '../types.js';
import { relationalStore, getCurrentTimestamp } from '../backends.js';

export const getSessionAnalyticsDefinition: ToolDefinition = {
  name: 'get_session_analytics',
  description:
    'Analyze practitioner interaction sessions: duration, depth (tools per session), agents per session, and user type classification (power_user, regular, occasional). Identifies who engages deeply vs. quick lookups.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'Specific user. Omit for all users.' },
      period: { type: 'string', description: '"7d", "30d". Defaults to "7d".' },
      sessionGapMinutes: { type: 'number', description: 'Minutes of inactivity before a new session starts. Defaults to 30.' },
    },
    required: [],
  },
};

interface SessionData {
  userId: string;
  startTs: number;
  endTs: number;
  toolCalls: number;
  agents: Set<string>;
  agentCounts: Record<string, number>;
}

export const getSessionAnalyticsHandler: ToolHandler = async (args) => {
  const userId = args.userId as string | undefined;
  const period = (args.period as string) ?? '7d';
  const sessionGapMinutes = (args.sessionGapMinutes as number) ?? 30;

  try {
    const days = period === '30d' ? 30 : 7;
    const now = getCurrentTimestamp();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const gapMs = sessionGapMinutes * 60 * 1000;

    const rows = await relationalStore.query(
      'usage_events',
      (row) => {
        if ((row.timestamp as number) < cutoff) return false;
        if (userId && row.userId !== userId) return false;
        return true;
      },
    );

    // Sort by userId then timestamp
    rows.sort((a, b) => {
      const userCmp = (a.userId as string).localeCompare(b.userId as string);
      if (userCmp !== 0) return userCmp;
      return (a.timestamp as number) - (b.timestamp as number);
    });

    // Reconstruct sessions
    const sessions: SessionData[] = [];
    let currentSession: SessionData | null = null;

    for (const row of rows) {
      const uid = row.userId as string;
      const ts = row.timestamp as number;
      const agent = row.agentName as string;

      if (!currentSession || currentSession.userId !== uid || ts - currentSession.endTs > gapMs) {
        // Start new session
        if (currentSession) sessions.push(currentSession);
        currentSession = {
          userId: uid,
          startTs: ts,
          endTs: ts,
          toolCalls: 1,
          agents: new Set([agent]),
          agentCounts: { [agent]: 1 },
        };
      } else {
        // Continue session
        currentSession.endTs = ts;
        currentSession.toolCalls++;
        currentSession.agents.add(agent);
        currentSession.agentCounts[agent] = (currentSession.agentCounts[agent] || 0) + 1;
      }
    }
    if (currentSession) sessions.push(currentSession);

    if (sessions.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          period,
          sessionGapMinutes,
          overview: { totalSessions: 0, avgSessionDurationMinutes: 0, avgToolCallsPerSession: 0, avgAgentsPerSession: 0, medianSessionDurationMinutes: 0 },
          userBreakdown: [],
          userTypeDistribution: { power_user: 0, regular: 0, occasional: 0 },
        }, null, 2) }],
      };
    }

    // Overall stats
    const durations = sessions.map((s) => (s.endTs - s.startTs) / 60000);
    const totalSessions = sessions.length;
    const avgDuration = durations.reduce((s, d) => s + d, 0) / totalSessions;
    const avgToolCalls = sessions.reduce((s, ses) => s + ses.toolCalls, 0) / totalSessions;
    const avgAgents = sessions.reduce((s, ses) => s + ses.agents.size, 0) / totalSessions;

    // Median duration
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianDuration = sortedDurations[Math.floor(sortedDurations.length / 2)];

    // Per-user breakdown
    const userSessions: Record<string, SessionData[]> = {};
    for (const session of sessions) {
      if (!userSessions[session.userId]) userSessions[session.userId] = [];
      userSessions[session.userId].push(session);
    }

    const userBreakdown: UserSessionBreakdown[] = [];
    const distribution = { power_user: 0, regular: 0, occasional: 0 };

    for (const [uid, userSess] of Object.entries(userSessions)) {
      const userTotalSessions = userSess.length;
      const userAvgDuration = userSess.reduce((s, ses) => s + (ses.endTs - ses.startTs) / 60000, 0) / userTotalSessions;
      const userAvgToolCalls = userSess.reduce((s, ses) => s + ses.toolCalls, 0) / userTotalSessions;
      const userAvgAgents = userSess.reduce((s, ses) => s + ses.agents.size, 0) / userTotalSessions;

      // Find most used agent across all sessions
      const agentTotals: Record<string, number> = {};
      for (const ses of userSess) {
        for (const [agent, count] of Object.entries(ses.agentCounts)) {
          agentTotals[agent] = (agentTotals[agent] || 0) + count;
        }
      }
      const mostUsedAgent = Object.entries(agentTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';

      // Classify user type based on sessions per week
      const sessionsPerWeek = userTotalSessions / (days / 7);
      let userType: UserType;
      if (sessionsPerWeek >= 15) {
        userType = 'power_user';
      } else if (sessionsPerWeek >= 5) {
        userType = 'regular';
      } else {
        userType = 'occasional';
      }

      distribution[userType]++;

      // Compute returnRate — fraction of weeks where user had at least 1 session
      const totalWeeks = Math.max(1, Math.ceil(days / 7));
      const weeksSeen = new Set<number>();
      for (const ses of userSess) {
        const weekIndex = Math.floor((now - ses.startTs) / (7 * 24 * 60 * 60 * 1000));
        if (weekIndex >= 0 && weekIndex < totalWeeks) {
          weeksSeen.add(weekIndex);
        }
      }
      const returnRate = Math.min(1, Math.round((weeksSeen.size / totalWeeks) * 100) / 100);

      // Compute churnRisk based on recency + returnRate
      const lastSessionTs = Math.max(...userSess.map((s) => s.endTs));
      const daysSinceLastSession = (now - lastSessionTs) / (24 * 60 * 60 * 1000);
      let churnRisk: 'low' | 'medium' | 'high';
      if (returnRate >= 0.75 && daysSinceLastSession < 3) {
        churnRisk = 'low';
      } else if (returnRate < 0.4 || daysSinceLastSession > 7) {
        churnRisk = 'high';
      } else {
        churnRisk = 'medium';
      }

      userBreakdown.push({
        userId: uid,
        totalSessions: userTotalSessions,
        avgDurationMinutes: Math.round(userAvgDuration * 10) / 10,
        avgToolCallsPerSession: Math.round(userAvgToolCalls * 10) / 10,
        avgAgentsPerSession: Math.round(userAvgAgents * 10) / 10,
        mostUsedAgent,
        userType,
        returnRate,
        churnRisk,
      });
    }

    // Sort: power users first, then by sessions descending
    const typeOrder: Record<string, number> = { power_user: 0, regular: 1, occasional: 2 };
    userBreakdown.sort((a, b) => {
      const typeCmp = typeOrder[a.userType] - typeOrder[b.userType];
      if (typeCmp !== 0) return typeCmp;
      return b.totalSessions - a.totalSessions;
    });

    const result: SessionAnalyticsResult = {
      period,
      sessionGapMinutes,
      overview: {
        totalSessions,
        avgSessionDurationMinutes: Math.round(avgDuration * 10) / 10,
        avgToolCallsPerSession: Math.round(avgToolCalls * 10) / 10,
        avgAgentsPerSession: Math.round(avgAgents * 10) / 10,
        medianSessionDurationMinutes: Math.round(medianDuration * 10) / 10,
      },
      userBreakdown,
      userTypeDistribution: distribution,
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
