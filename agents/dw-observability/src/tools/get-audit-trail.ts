/**
 * get_audit_trail — SHA-256 hash-chain audit log.
 *
 * Returns audit entries with cryptographic hash chain integrity.
 * Each entry's hash = SHA-256(content + previousHash).
 * NO LLM calls — purely deterministic.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { AuditEntry } from '../types.js';
import { relationalStore } from '../backends.js';

export const getAuditTrailDefinition: ToolDefinition = {
  name: 'get_audit_trail',
  description:
    'Retrieve SHA-256 hash-chain audit log entries. Each entry is cryptographically linked to the previous one. Supports filtering by agent name and limiting results.',
  inputSchema: {
    type: 'object',
    properties: {
      agentName: { type: 'string', description: 'Filter by agent name. Omit for all agents.' },
      limit: { type: 'number', description: 'Max entries to return. Defaults to 20.' },
    },
    required: [],
  },
};

export const getAuditTrailHandler: ToolHandler = async (args) => {
  const agentName = args.agentName as string | undefined;
  const limit = (args.limit as number) ?? 20;

  try {
    let rows = await relationalStore.query(
      'audit_trail',
      agentName ? (row) => row.agentName === agentName : undefined,
    );

    // Sort by timestamp ascending (chain order)
    rows.sort((a, b) => (a.timestamp as number) - (b.timestamp as number));

    if (limit && rows.length > limit) {
      rows = rows.slice(-limit); // most recent entries
    }

    const entries: AuditEntry[] = rows.map((row) => ({
      id: row.id as string,
      timestamp: row.timestamp as number,
      agentName: row.agentName as string,
      action: row.action as string,
      input: row.input as string,
      output: row.output as string,
      confidence: row.confidence as number,
      hash: row.hash as string,
      previousHash: row.previousHash as string,
    }));

    return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
