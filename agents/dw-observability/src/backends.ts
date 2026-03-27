/**
 * Shared backend instances for the dw-observability agent.
 *
 * Initializes and seeds the infrastructure stubs so all tools
 * share the same in-memory state. Provides:
 * - InMemoryRelationalStore: agent_metrics (7 days x 6 agents), audit_trail (20 entries), evaluation_scores
 * - InMemoryKeyValueStore: real-time health cache
 *
 * CRITICAL: All data is deterministic. NO LLM calls anywhere.
 */

import { createHash } from 'crypto';
import { createRelationalStore, InMemoryRelationalStore, createKeyValueStore, InMemoryKeyValueStore } from '@data-workers/infrastructure-stubs';

// ── Relational store ─────────────────────────────────────────────────

export const relationalStore = await createRelationalStore();

// ── Key-value store for real-time health cache ──────────────────────

export const kvStore = await createKeyValueStore();

// ── Seed data ────────────────────────────────────────────────────────

if (relationalStore instanceof InMemoryRelationalStore) {
  await relationalStore.createTable('agent_metrics');
  await relationalStore.createTable('audit_trail');
  await relationalStore.createTable('evaluation_scores');

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  const AGENTS = ['pipelines', 'incidents', 'catalog', 'schema', 'quality', 'governance'];

  // ── 7 days of metrics for 6 agents ──────────────────────────────────

  for (const agentName of AGENTS) {
    for (let day = 0; day < 7; day++) {
      const timestamp = now - day * dayMs;
      // Deterministic seed based on agent name and day
      const seed = agentName.length * 17 + day * 13;
      const baseLatency = 50 + (seed % 100);

      await relationalStore.insert('agent_metrics', {
        agentName,
        timestamp,
        day,
        p50: baseLatency,
        p95: baseLatency * 2.5,
        p99: baseLatency * 4,
        errorRate: agentName === 'governance' ? 0.08 : 0.02 + (day * 0.002),
        totalInvocations: 1000 + seed * 10,
        avgTokens: 500 + (seed % 300),
        avgConfidence: 0.85 + (seed % 10) * 0.01,
        escalationRate: 0.05 + (seed % 5) * 0.01,
      });
    }
  }

  // ── SHA-256 hash-chain audit trail (20 entries) ─────────────────────

  function computeHash(content: string, previousHash: string): string {
    return createHash('sha256').update(content + previousHash).digest('hex');
  }

  const auditActions = [
    'pipeline_executed', 'schema_validated', 'incident_detected', 'catalog_updated',
    'quality_check_passed', 'governance_review', 'pipeline_failed', 'schema_migrated',
    'incident_resolved', 'catalog_enriched', 'quality_check_failed', 'governance_approved',
    'pipeline_retried', 'schema_rollback', 'incident_escalated', 'catalog_deprecated',
    'quality_anomaly', 'governance_denied', 'pipeline_optimized', 'schema_published',
  ];

  let previousHash = '0'.repeat(64); // genesis hash

  for (let i = 0; i < 20; i++) {
    const agentName = AGENTS[i % AGENTS.length];
    const action = auditActions[i];
    const timestamp = now - (20 - i) * hourMs;
    const entryId = `audit-${String(i + 1).padStart(3, '0')}`;
    const input = `input_for_${action}`;
    const output = `result_of_${action}`;
    const confidence = 0.80 + (i % 10) * 0.02;

    const content = JSON.stringify({ id: entryId, timestamp, agentName, action, input, output, confidence });
    const hash = computeHash(content, previousHash);

    await relationalStore.insert('audit_trail', {
      id: entryId,
      timestamp,
      agentName,
      action,
      input,
      output,
      confidence,
      hash,
      previousHash,
    });

    previousHash = hash;
  }

  // ── Evaluation scores ───────────────────────────────────────────────

  for (const agentName of AGENTS) {
    const seed = agentName.length * 7;
    for (let i = 0; i < 5; i++) {
      await relationalStore.insert('evaluation_scores', {
        agentName,
        evaluatedAt: now - i * dayMs,
        accuracy: 0.75 + ((seed + i) % 20) * 0.01,
        completeness: 0.70 + ((seed + i * 3) % 25) * 0.01,
        safety: 0.90 + ((seed + i * 2) % 10) * 0.01,
        helpfulness: 0.72 + ((seed + i * 5) % 22) * 0.01,
      });
    }
  }

  // ── KV store health cache ─────────────────────────────────────────

  if (kvStore instanceof InMemoryKeyValueStore) {
    for (const agentName of AGENTS) {
      const errorRate = agentName === 'governance' ? 0.08 : 0.02;
      const status = errorRate > 0.20 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy';

      await kvStore.set(`health:${agentName}`, JSON.stringify({
        agentName,
        status,
        lastHeartbeat: now - 10_000, // 10 seconds ago
        startedAt: now - 3 * dayMs,
        errorRateLast5m: errorRate,
      }));
    }
  }
}
