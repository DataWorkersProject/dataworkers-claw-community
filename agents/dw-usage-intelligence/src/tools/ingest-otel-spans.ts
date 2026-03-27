/**
 * ingest_otel_spans — OpenTelemetry-compatible event ingestion.
 *
 * Accepts OTel span format and converts to UsageEvent records.
 * NO LLM calls — purely deterministic.
 */

import { createHash } from 'crypto';
import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { OTelSpan } from '../types.js';
import { relationalStore } from '../backends.js';

export const ingestOtelSpansDefinition: ToolDefinition = {
  name: 'ingest_otel_spans',
  description:
    'Ingest OpenTelemetry-compatible spans as usage events. Converts OTel span format (traceId, spanId, attributes) to internal usage event records.',
  inputSchema: {
    type: 'object',
    properties: {
      spans: {
        type: 'array',
        description: 'Array of OTel spans to ingest.',
        items: { type: 'object' },
      },
    },
    required: ['spans'],
  },
};

export const ingestOtelSpansHandler: ToolHandler = async (args) => {
  try {
    const spans = (args.spans as OTelSpan[]) ?? [];
    let ingested = 0;
    let skipped = 0;

    for (const span of spans) {
      const agentName = (span.attributes?.['dw.agent.name'] as string) ?? 'unknown';
      const toolName = (span.attributes?.['dw.tool.name'] as string) ?? span.operationName ?? 'unknown';
      const userId = (span.attributes?.['dw.user.id'] as string) ?? 'unknown';
      const teamId = (span.attributes?.['dw.team.id'] as string) ?? 'unknown';
      const sessionId = (span.attributes?.['dw.session.id'] as string) ?? span.traceId ?? `otel-${Date.now()}`;
      const tokenCount = Number(span.attributes?.['dw.token.count'] ?? 0);
      const inputSummary = (span.attributes?.['dw.input.summary'] as string) ?? '';

      if (!span.spanId || !span.startTimeUnixNano) {
        skipped++;
        continue;
      }

      const timestamp = Math.floor(span.startTimeUnixNano / 1e6); // nano to ms
      const endMs = Math.floor((span.endTimeUnixNano ?? span.startTimeUnixNano) / 1e6);
      const durationMs = endMs - timestamp;
      const outcome = span.status?.code === 'ERROR' ? 'error' : 'success';

      const eventId = `otel-${span.spanId}`;
      const previousHash = '0'.repeat(64);
      const content = JSON.stringify({ id: eventId, timestamp, userId, agentName, toolName });
      const hash = createHash('sha256').update(content + previousHash).digest('hex');

      await relationalStore.insert('usage_events', {
        id: eventId,
        timestamp,
        userId,
        teamId,
        agentName,
        toolName,
        inputSummary,
        outcome,
        durationMs: Math.max(1, durationMs),
        tokenCount,
        sessionId,
        sequenceIndex: 0,
        hash,
        previousHash,
      });

      ingested++;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ ingested, skipped, total: spans.length }, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
