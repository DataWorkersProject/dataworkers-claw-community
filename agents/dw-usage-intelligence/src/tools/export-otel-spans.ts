/**
 * export_otel_spans — OTel-compatible export for usage data.
 *
 * Exports usage events in OpenTelemetry span format for integration
 * with external observability platforms (Grafana, Datadog, etc.).
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { OTelSpan, OTelExportResult } from '../types.js';
import { relationalStore } from '../backends.js';

export const exportOtelSpansDefinition: ToolDefinition = {
  name: 'export_otel_spans',
  description:
    'Export usage events in OpenTelemetry span format. Converts internal usage events to OTel resource spans for external observability platform integration.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Filter by agent. Omit for all agents.' },
      period: { type: 'string', description: '"1d", "7d". Defaults to "1d".' },
      limit: { type: 'number', description: 'Max spans to export. Defaults to 100.' },
    },
    required: [],
  },
};

export const exportOtelSpansHandler: ToolHandler = async (args) => {
  const agentName = args.agentName as string | undefined;
  const period = (args.period as string) ?? '1d';
  const limit = (args.limit as number) ?? 100;

  try {
    const days = period === '7d' ? 7 : 1;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    let rows = await relationalStore.query(
      'usage_events',
      (row) => {
        if ((row.timestamp as number) < cutoff) return false;
        if (agentName && row.agentName !== agentName) return false;
        return true;
      },
    );

    // Sort by timestamp descending, take most recent
    rows.sort((a, b) => (b.timestamp as number) - (a.timestamp as number));
    if (rows.length > limit) rows = rows.slice(0, limit);

    const spans: OTelSpan[] = rows.map((row) => {
      const ts = row.timestamp as number;
      const dur = row.durationMs as number;
      return {
        traceId: row.sessionId as string,
        spanId: row.id as string,
        operationName: `${row.agentName}.${row.toolName}`,
        startTimeUnixNano: ts * 1e6,
        endTimeUnixNano: (ts + dur) * 1e6,
        attributes: {
          'dw.agent.name': row.agentName as string,
          'dw.tool.name': row.toolName as string,
          'dw.user.id': row.userId as string,
          'dw.team.id': row.teamId as string,
          'dw.session.id': row.sessionId as string,
          'dw.token.count': row.tokenCount as number,
          'dw.input.summary': row.inputSummary as string,
          'dw.duration.ms': dur,
        },
        status: {
          code: row.outcome === 'error' ? 'ERROR' : 'OK',
          message: row.outcome === 'error' ? 'Tool invocation failed' : undefined,
        },
      };
    });

    const result: OTelExportResult = {
      resourceSpans: [{
        resource: {
          attributes: {
            'service.name': 'dw-usage-intelligence',
            'service.version': '0.1.0',
          },
        },
        scopeSpans: [{
          scope: { name: 'dw-usage-intelligence', version: '0.1.0' },
          spans,
        }],
      }],
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
