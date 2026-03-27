/**
 * EventIngester — Ingests usage events from message bus and stores in relational store.
 *
 * Maintains SHA-256 hash chain for audit integrity.
 * NO LLM calls — purely deterministic.
 */

import { createHash } from 'crypto';
import { relationalStore } from './backends.js';
import type { UsageEvent } from './types.js';

export class EventIngester {
  private lastHash = '0'.repeat(64);

  async ingest(event: Partial<UsageEvent>): Promise<void> {
    const record = {
      ...event,
      id: event.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: event.timestamp ?? Date.now(),
      previousHash: this.lastHash,
    };

    // Compute SHA-256 hash for chain integrity
    const content = JSON.stringify({
      id: record.id,
      timestamp: record.timestamp,
      userId: record.userId,
      agentName: record.agentName,
      toolName: record.toolName,
    });
    this.lastHash = createHash('sha256').update(content + record.previousHash).digest('hex');

    await relationalStore.insert('usage_events', { ...record, hash: this.lastHash });
  }
}
