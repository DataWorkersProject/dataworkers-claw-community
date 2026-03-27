/**
 * Shared backend instances for the catalog agent.
 * Seeded once, reused across all tools.
 */

import { createVectorStore, createFullTextSearch, createGraphDB, createKeyValueStore, createMessageBus, InMemoryVectorStore, InMemoryFullTextSearch, InMemoryGraphDB, type IGraphDB } from '@data-workers/infrastructure-stubs';
import { CatalogRegistry } from '@data-workers/connector-shared';
import { MetricStore } from './search/metric-store.js';
import { GraphPersister } from './crawlers/graph-persister.js';
import { DbtLineageParser } from './search/dbt-lineage-parser.js';
import { OpenLineageConsumer } from './search/openlineage-consumer.js';
import { ColumnLineageExpander } from './search/column-lineage-expander.js';

// Shared backend instances (seeded once, reused across tools)
export const vectorStore = await createVectorStore();
export const fullTextSearch = await createFullTextSearch();
export const graphDB = await createGraphDB();
export const metricStore = new MetricStore();

// Seed all backends
if (vectorStore instanceof InMemoryVectorStore) {
  vectorStore.seed();
}
if (fullTextSearch instanceof InMemoryFullTextSearch) {
  fullTextSearch.seed();
}
if (graphDB instanceof InMemoryGraphDB) {
  graphDB.seed();
}

// GraphPersister wired to shared graphDB for crawler → graph persistence
export const graphPersister = new GraphPersister(graphDB as IGraphDB);

// DbtLineageParser for manifest + SQL lineage extraction
export const dbtLineageParser = new DbtLineageParser();

// OpenLineageConsumer wired to shared graphDB for event ingestion
export const openLineageConsumer = new OpenLineageConsumer(graphDB as IGraphDB, 'default');

// ColumnLineageExpander for column-level lineage with confidence scoring
export const columnLineageExpander = new ColumnLineageExpander();

// + CatalogRegistry singleton with auto-discovery of 15 connectors
import { discoverAndRegisterConnectors, getConnectorHealth, withGracefulDegradation } from './connector-discovery.js';

const catalogRegistrySingleton = new CatalogRegistry();

// Auto-discover and register all available connectors with graceful degradation
await discoverAndRegisterConnectors(catalogRegistrySingleton);

/** Get the shared CatalogRegistry singleton. */
export function getCatalogRegistry(): CatalogRegistry {
  return catalogRegistrySingleton;
}

export { catalogRegistrySingleton as catalogRegistry };
export { getConnectorHealth, withGracefulDegradation };

// ── Key-value store & message bus for cross-agent subscriptions ──
export const kvStore = await createKeyValueStore();
export const messageBus = await createMessageBus();

// ── Subscribe to schema.changed events for staleness detection ──
await messageBus.subscribe('schema.changed', (event) => {
  // When a schema change is detected, mark the asset context as potentially stale.
  // In production, this would trigger a re-evaluation of documentation and business rules.
  const payload = event.payload as Record<string, unknown> | undefined;
  if (payload?.assetId) {
    const assetId = payload.assetId as string;
    const customerId = (payload.customerId as string) || 'cust-1';
    // Fire-and-forget: publish a context.stale event
    void messageBus.publish('context.stale', {
      id: `ctx-stale-${Date.now()}`,
      type: 'context.stale',
      timestamp: Date.now(),
      customerId,
      payload: {
        assetId,
        source: 'dw-context-catalog',
        reason: 'Schema change detected — context may be stale.',
        flaggedBy: 'schema.changed-subscription',
      },
    });
  }
});

// ── /897: Business Rule Store & Context Feedback Store ──
import { InMemoryBusinessRuleStore, InMemoryContextFeedbackStore } from '@data-workers/infrastructure-stubs';
import type { BusinessRuleRecord, ContextFeedbackRecord } from '@data-workers/infrastructure-stubs';

export const businessRuleStore = new InMemoryBusinessRuleStore();
export const contextFeedbackStore = new InMemoryContextFeedbackStore();

// Seed business rules
const seedRules: BusinessRuleRecord[] = [
  {
    id: 'rule-1',
    customerId: 'cust-1',
    assetId: 'orders',
    columnName: 'total_amount',
    ruleType: 'calculation',
    content: 'Total amount must include tax and shipping. Exclude refunds unless marked as net_total.',
    author: 'data-team',
    confidence: 0.95,
    source: 'tribal_knowledge',
    conditions: [{ field: 'region', operator: 'eq', value: 'US' }],
    createdAt: Date.now() - 86_400_000 * 30,
    lastConfirmedAt: Date.now() - 86_400_000 * 5,
    deprecated: false,
  },
  {
    id: 'rule-2',
    customerId: 'cust-1',
    assetId: 'customers',
    ruleType: 'definition',
    content: 'Active customer = at least one order in the last 90 days. Do NOT use last_login for activity.',
    author: 'analytics-lead',
    confidence: 0.90,
    source: 'documentation',
    conditions: [],
    createdAt: Date.now() - 86_400_000 * 60,
    lastConfirmedAt: Date.now() - 86_400_000 * 10,
    deprecated: false,
  },
  {
    id: 'rule-3',
    customerId: 'cust-1',
    assetId: 'revenue_daily',
    ruleType: 'freshness',
    content: 'Revenue daily table must be refreshed by 6am UTC. Stale data after 6am is an incident.',
    author: 'sre-team',
    confidence: 1.0,
    source: 'runbook',
    conditions: [{ field: 'schedule', operator: 'eq', value: 'daily' }],
    createdAt: Date.now() - 86_400_000 * 90,
    lastConfirmedAt: Date.now() - 86_400_000 * 2,
    deprecated: false,
  },
];

for (const rule of seedRules) {
  await businessRuleStore.addRule(rule);
}

// Seed context feedback
const seedFeedback: ContextFeedbackRecord[] = [
  {
    id: 'fb-1',
    assetId: 'orders',
    userId: 'user-alice',
    feedbackType: 'positive',
    content: 'Documentation accurately describes the total_amount calculation.',
    timestamp: Date.now() - 86_400_000 * 3,
  },
  {
    id: 'fb-2',
    assetId: 'orders',
    userId: 'user-bob',
    feedbackType: 'correction',
    content: 'The description says total_amount excludes tax, but it actually includes tax since Q2 2024.',
    timestamp: Date.now() - 86_400_000 * 1,
  },
  {
    id: 'fb-3',
    assetId: 'customers',
    userId: 'user-carol',
    feedbackType: 'positive',
    content: 'Active customer definition is correct and well documented.',
    timestamp: Date.now() - 86_400_000 * 7,
  },
];

for (const fb of seedFeedback) {
  await contextFeedbackStore.recordFeedback(fb);
}
