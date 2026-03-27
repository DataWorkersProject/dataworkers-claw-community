/**
 * Shared backend infrastructure for dw-incidents.
 * Initializes and seeds all in-memory stores used by the incident tools.
 */

import {
  createGraphDB,
  createVectorStore,
  createRelationalStore,
  createKeyValueStore,
  createMessageBus,
  createOrchestratorAPI,
  InMemoryGraphDB,
  InMemoryVectorStore,
  InMemoryRelationalStore,
  InMemoryOrchestratorAPI,
} from '@data-workers/infrastructure-stubs';
import { IncidentLogger } from './learning/incident-logger.js';
import { MTTRTracker } from './learning/mttr-tracker.js';
import { HistoryMatcher } from './rca/history-matcher.js';

// --- Instantiate stores ---

export const graphDB = await createGraphDB();
export const vectorStore = await createVectorStore();
export const relationalStore = await createRelationalStore();
export const kvStore = await createKeyValueStore();
export const messageBus = await createMessageBus();
export const orchestratorAPI = await createOrchestratorAPI();

// --- Seed graph DB with lineage data ---
if (graphDB instanceof InMemoryGraphDB) {
  graphDB.seed();
}

// --- Seed vector store with catalog assets ---
if (vectorStore instanceof InMemoryVectorStore) {
  vectorStore.seed();
}

// --- Seed relational store with quality metrics ---
if (relationalStore instanceof InMemoryRelationalStore) {
  relationalStore.seed();
}

// --- Seed orchestrator API ---
if (orchestratorAPI instanceof InMemoryOrchestratorAPI) {
  orchestratorAPI.seed();
}

// --- Seed relational store with 14 days of incident history ---

const INCIDENT_TYPES = [
  'schema_change',
  'source_delay',
  'resource_exhaustion',
  'code_regression',
  'infrastructure',
  'quality_degradation',
] as const;

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

if (relationalStore instanceof InMemoryRelationalStore && vectorStore instanceof InMemoryVectorStore) {
  await relationalStore.createTable('incidents');
  await relationalStore.createTable('incident_log');

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let day = 13; day >= 0; day--) {
    const detectedAt = now - day * dayMs - Math.floor(((day * 7 + 3) % 13) * 3600_000);
    const incType = INCIDENT_TYPES[day % INCIDENT_TYPES.length];
    const severity = SEVERITIES[day % SEVERITIES.length];
    const resolutionTimeMs = 300_000 + ((day * 11 + 5) % 17) * 60_000; // 5-22 min resolution
    const automated = day % 3 !== 0; // ~67% auto-resolved

    await relationalStore.insert('incidents', {
      id: `hist-inc-${day}`,
      customerId: 'cust-1',
      type: incType,
      severity,
      status: 'resolved',
      title: `Historical ${incType.replace(/_/g, ' ')} incident #${day}`,
      description: `Past ${incType.replace(/_/g, ' ')} incident affecting orders pipeline on day -${day}`,
      affectedResources: JSON.stringify([day % 2 === 0 ? 'orders' : 'customers']),
      detectedAt,
      resolvedAt: detectedAt + resolutionTimeMs,
      confidence: 0.85 + ((day * 3 + 1) % 10) / 100,
      resolution: automated ? 'automated' : 'manual',
      playbook: automated
        ? (['restart_task', 'scale_compute', 'apply_schema_migration', 'backfill_data'][day % 4])
        : null,
    });
  }

  // --- Seed vector store with past incident embeddings ---

  for (let day = 13; day >= 0; day--) {
    const incType = INCIDENT_TYPES[day % INCIDENT_TYPES.length];
    const description = `Past ${incType.replace(/_/g, ' ')} incident affecting orders pipeline on day -${day}`;
    const vector = await vectorStore.embed(description);

    await vectorStore.upsert(`hist-inc-${day}`, vector, {
      id: `hist-inc-${day}`,
      customerId: 'cust-1',
      type: incType,
      severity: SEVERITIES[day % SEVERITIES.length],
      description,
      affectedResources: [day % 2 === 0 ? 'orders' : 'customers'],
      resolution: day % 3 !== 0 ? 'automated' : 'manual',
    }, 'incidents');
  }
}

// --- Lazy singleton for IncidentLogger ---

let _incidentLogger: IncidentLogger | null = null;
export function getIncidentLogger(): IncidentLogger {
  if (!_incidentLogger) {
    _incidentLogger = new IncidentLogger(relationalStore, vectorStore);
  }
  return _incidentLogger;
}

// --- Lazy singleton for HistoryMatcher ---

let _historyMatcher: HistoryMatcher | null = null;
export function getHistoryMatcher(): HistoryMatcher {
  if (!_historyMatcher) {
    _historyMatcher = new HistoryMatcher(vectorStore, relationalStore);
  }
  return _historyMatcher;
}

// --- Lazy singleton for MTTRTracker ---

let _mttrTracker: MTTRTracker | null = null;
export function getMTTRTracker(): MTTRTracker {
  if (!_mttrTracker) {
    _mttrTracker = new MTTRTracker();
  }
  return _mttrTracker;
}
