/**
 * get_workflow_patterns — Common multi-tool sequences and cross-agent flows.
 *
 * Identifies frequent tool call sequences by analyzing session data.
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { WorkflowPattern, CrossAgentFlow, WorkflowPatternsResult } from '../types.js';
import { relationalStore, getCurrentTimestamp } from '../backends.js';

export const getWorkflowPatternsDefinition: ToolDefinition = {
  name: 'get_workflow_patterns',
  description:
    'Identify common multi-tool and multi-agent workflow sequences. Reveals how practitioners chain tools together, which agent transitions are most common, and what percentage of usage is standalone vs. part of workflows.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'Analyze workflows for a specific user. Omit for all users.' },
      minSequenceLength: { type: 'number', description: 'Minimum tools in a sequence. Defaults to 2.' },
      period: { type: 'string', description: 'Time period: "7d", "30d". Defaults to "30d".' },
      topN: { type: 'number', description: 'Return top N patterns. Defaults to 10.' },
    },
    required: [],
  },
};

/**
 * Dynamically generate workflow description from the sequence data.
 * Extracts agent names, tool actions, and flow shape to produce a human-readable summary.
 */
function generateWorkflowDescription(sequence: string[]): string {
  const agents = new Set<string>();
  const actions: string[] = [];
  for (const step of sequence) {
    const [agent, tool] = step.split(':');
    agents.add(agent);
    // Convert tool_name to readable form: "validate_schema" → "validate schema"
    actions.push(tool.replace(/_/g, ' '));
  }
  const agentList = [...agents];
  const agentLabel = agentList.length === 1
    ? `${agentList[0]}-only`
    : `cross-agent (${agentList.join(', ')})`;
  return `${sequence.length}-step ${agentLabel} workflow: ${actions.join(' → ')}`;
}

export const getWorkflowPatternsHandler: ToolHandler = async (args) => {
  const userId = args.userId as string | undefined;
  const minSequenceLength = (args.minSequenceLength as number) ?? 2;
  const period = (args.period as string) ?? '30d';
  const topN = (args.topN as number) ?? 10;

  try {
    const days = period === '7d' ? 7 : 30;
    const cutoff = getCurrentTimestamp() - days * 24 * 60 * 60 * 1000;

    const rows = await relationalStore.query(
      'usage_events',
      (row) => {
        if ((row.timestamp as number) < cutoff) return false;
        if (userId && row.userId !== userId) return false;
        return true;
      },
    );

    // Group by sessionId
    const sessions: Record<string, typeof rows> = {};
    for (const row of rows) {
      const sid = row.sessionId as string;
      if (!sessions[sid]) sessions[sid] = [];
      sessions[sid].push(row);
    }

    // Extract sequences from sessions
    const sequenceCounts: Record<string, { count: number; users: Set<string>; totalDurationMs: number }> = {};
    const totalEvents = rows.length;
    let isolatedEvents = 0;

    // Cross-agent flow tracking
    const crossAgentCounts: Record<string, number> = {};

    for (const [, sessionEvents] of Object.entries(sessions)) {
      // Sort by sequenceIndex
      sessionEvents.sort((a, b) => (a.sequenceIndex as number) - (b.sequenceIndex as number));

      if (sessionEvents.length < minSequenceLength) {
        isolatedEvents += sessionEvents.length;
        continue;
      }

      // Build sequence key
      const seqKey = sessionEvents
        .map((e) => `${e.agentName}:${e.toolName}`)
        .join('→');

      const uid = sessionEvents[0].userId as string;
      const firstTs = sessionEvents[0].timestamp as number;
      const lastTs = sessionEvents[sessionEvents.length - 1].timestamp as number;
      const durationMs = lastTs - firstTs + (sessionEvents[sessionEvents.length - 1].durationMs as number);

      if (!sequenceCounts[seqKey]) {
        sequenceCounts[seqKey] = { count: 0, users: new Set(), totalDurationMs: 0 };
      }
      sequenceCounts[seqKey].count++;
      sequenceCounts[seqKey].users.add(uid);
      sequenceCounts[seqKey].totalDurationMs += durationMs;

      // Track cross-agent transitions
      for (let i = 1; i < sessionEvents.length; i++) {
        const fromAgent = sessionEvents[i - 1].agentName as string;
        const toAgent = sessionEvents[i].agentName as string;
        if (fromAgent !== toAgent) {
          const flowKey = `${fromAgent}→${toAgent}`;
          crossAgentCounts[flowKey] = (crossAgentCounts[flowKey] || 0) + 1;
        }
      }
    }

    // Build ranked patterns
    const patterns: WorkflowPattern[] = Object.entries(sequenceCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, topN)
      .map(([seqKey, data], idx) => {
        const sequence = seqKey.split('→');
        return {
          rank: idx + 1,
          sequence,
          frequency: data.count,
          uniqueUsers: data.users.size,
          avgDurationMinutes: Math.round((data.totalDurationMs / data.count / 60000) * 10) / 10,
          description: generateWorkflowDescription(sequence),
        };
      });

    // Build cross-agent flows
    const crossAgentFlows: CrossAgentFlow[] = Object.entries(crossAgentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([key, frequency]) => {
        const [from, to] = key.split('→');
        return { from, to, frequency };
      });

    const isolatedPercentage = totalEvents > 0
      ? Math.round((isolatedEvents / totalEvents) * 100) / 100
      : 0;

    const result: WorkflowPatternsResult = {
      patterns,
      crossAgentFlows,
      isolatedToolUsage: {
        percentage: isolatedPercentage,
        description: `${Math.round(isolatedPercentage * 100)}% of tool calls are standalone (not part of a multi-tool workflow)`,
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
