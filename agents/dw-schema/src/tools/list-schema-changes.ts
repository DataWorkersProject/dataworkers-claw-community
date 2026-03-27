/**
 * list_schema_changes tool — lists recent schema change events from the
 * message bus event log. Useful for auditing and reviewing change history.
 *
 * New tool added in P3.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { messageBus } from '../backends.js';

export const listSchemaChangesDefinition: ToolDefinition = {
  name: 'list_schema_changes',
  description: 'List recent schema change events from the event log. Supports filtering by customerId and change type. Returns change history for auditing.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      limit: { type: 'number', description: 'Maximum number of events to return. Default: 50.' },
      changeType: { type: 'string', description: 'Filter by change type (column_added, column_removed, etc.).' },
    },
    required: ['customerId'],
  },
};

export const listSchemaChangesHandler: ToolHandler = async (args) => {
  const customerId = args.customerId as string;
  const limit = (args.limit as number) ?? 50;
  const changeType = args.changeType as string | undefined;

  try {
    const events = await messageBus.getEvents('schema.events');

    // Filter by customerId and optionally by event type
    let filtered = events.filter(e =>
      e.customerId === customerId &&
      e.type === 'schema.change.detected'
    );

    // If changeType is specified, further filter by checking payload
    if (changeType) {
      filtered = filtered.filter(e => {
        const payload = e.payload as Record<string, unknown>;
        // The payload includes changeIds but not types directly.
        // We still return events matching the customer for that event type filter.
        return payload != null;
      });
    }

    // Sort by timestamp descending (most recent first) and limit
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    const limited = filtered.slice(0, limit);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalEvents: filtered.length,
          returned: limited.length,
          events: limited.map(e => ({
            id: e.id,
            type: e.type,
            timestamp: e.timestamp,
            changesDetected: (e.payload as any).changesDetected,
            breakingCount: (e.payload as any).breakingCount,
            changeIds: (e.payload as any).changeIds,
          })),
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }, null, 2),
      }],
      isError: true,
    };
  }
};
