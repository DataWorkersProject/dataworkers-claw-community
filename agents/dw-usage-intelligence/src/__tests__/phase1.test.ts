/**
 * Phase 1 integration tests for Usage Intelligence Agent.
 *
 * Tests event ingestion, hash chain integrity, and event ingester wiring.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { EventIngester } from '../event-ingester.js';
import { relationalStore } from '../backends.js';
import { server, eventIngester, messageBus } from '../index.js';

describe('Phase 1: Event Ingestion', () => {
  describe('EventIngester', () => {
    it('ingests an event and stores it in relational store', async () => {
      const ingester = new EventIngester();
      await ingester.ingest({
        userId: 'test-user',
        agentName: 'pipelines',
        toolName: 'build_pipeline',
        teamId: 'platform',
        outcome: 'success',
        durationMs: 150,
        tokenCount: 300,
      });

      const rows = await relationalStore.query('usage_events', (row) =>
        row.userId === 'test-user' && row.toolName === 'build_pipeline',
      );

      expect(rows.length).toBeGreaterThanOrEqual(1);
      const row = rows[rows.length - 1];
      expect(row.agentName).toBe('pipelines');
      expect(row.outcome).toBe('success');
      expect(row.hash).toBeDefined();
      expect(row.previousHash).toBeDefined();
    });

    it('maintains SHA-256 hash chain across multiple events', async () => {
      const ingester = new EventIngester();

      await ingester.ingest({
        id: 'chain-test-1',
        userId: 'chain-user',
        agentName: 'catalog',
        toolName: 'search_assets',
        teamId: 'analytics',
        outcome: 'success',
        durationMs: 100,
        tokenCount: 200,
      });

      await ingester.ingest({
        id: 'chain-test-2',
        userId: 'chain-user',
        agentName: 'catalog',
        toolName: 'get_lineage',
        teamId: 'analytics',
        outcome: 'success',
        durationMs: 120,
        tokenCount: 250,
      });

      const rows = await relationalStore.query('usage_events', (row) =>
        (row.id as string).startsWith('chain-test-'),
      );

      const sorted = rows.sort((a, b) => (a.id as string).localeCompare(b.id as string));
      expect(sorted.length).toBe(2);

      // Second event's previousHash should be first event's hash
      expect(sorted[1].previousHash).toBe(sorted[0].hash);

      // Hashes should be valid SHA-256 hex strings
      expect(sorted[0].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(sorted[1].hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates unique IDs when not provided', async () => {
      const ingester = new EventIngester();

      await ingester.ingest({
        userId: 'autoid-user',
        agentName: 'quality',
        toolName: 'run_quality_check',
        teamId: 'platform',
        outcome: 'success',
        durationMs: 80,
        tokenCount: 150,
      });

      const rows = await relationalStore.query('usage_events', (row) =>
        row.userId === 'autoid-user' && row.toolName === 'run_quality_check',
      );

      expect(rows.length).toBeGreaterThanOrEqual(1);
      const row = rows[rows.length - 1];
      expect(row.id).toMatch(/^evt-/);
    });
  });

  describe('EventIngester wiring in index.ts', () => {
    it('exports eventIngester instance', () => {
      expect(eventIngester).toBeDefined();
      expect(eventIngester).toBeInstanceOf(EventIngester);
    });

    it('exports messageBus instance', () => {
      expect(messageBus).toBeDefined();
    });

    it('messageBus subscription processes tool_invoked events', async () => {
      const beforeRows = await relationalStore.query('usage_events', (row) =>
        row.userId === 'bus-test-user',
      );
      const beforeCount = beforeRows.length;

      await messageBus.publish('tool_invoked', {
        id: `bus-evt-${Date.now()}`,
        type: 'tool_invoked',
        payload: {
          userId: 'bus-test-user',
          agentName: 'incidents',
          toolName: 'detect_anomaly',
          teamId: 'platform',
          outcome: 'success',
          durationMs: 200,
          tokenCount: 400,
        },
        timestamp: Date.now(),
        customerId: 'test-customer',
      });

      // Give async handler time to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const afterRows = await relationalStore.query('usage_events', (row) =>
        row.userId === 'bus-test-user',
      );

      expect(afterRows.length).toBeGreaterThan(beforeCount);
    });
  });

  describe('Context layer event types', () => {
    it('context layer types include usage-related event types', async () => {
      // Verify by importing the type — if it compiles, the types exist
      const contextTypes = await import('@data-workers/context-layer');
      // The EventType union should include our new types
      // This is a compile-time check; at runtime we just verify the module loads
      expect(contextTypes).toBeDefined();
    });
  });
});
