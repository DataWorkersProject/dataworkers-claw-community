/**
 * Backend infrastructure instances for dw-pipelines.
 * Provides message bus, LLM client, and catalog search capabilities.
 */

import {
  createMessageBus,
  createLLMClient,
  createVectorStore,
  createFullTextSearch,
  InMemoryMessageBus,
  InMemoryLLMClient,
  InMemoryVectorStore,
  InMemoryFullTextSearch,
} from '@data-workers/infrastructure-stubs';
import type { FTSResult } from '@data-workers/infrastructure-stubs';

/** Shared message bus instance for pipeline events. */
export const messageBus = await createMessageBus();

/** Shared LLM client instance for NL parsing fallback. */
export const llmClient = await createLLMClient();

/** Vector store seeded with catalog data for cross-agent queries. */
const vectorStore = await createVectorStore();
if (vectorStore instanceof InMemoryVectorStore) {
  vectorStore.seed();
}

/** Full-text search index seeded with catalog data. */
const ftsIndex = await createFullTextSearch();
if (ftsIndex instanceof InMemoryFullTextSearch) {
  ftsIndex.seed();
}

/**
 * Search the catalog for reusable assets matching a query.
 * Combines vector similarity and full-text search results.
 *
 * @param query - Search query string (e.g., "stg_orders", "orders staging model")
 * @param customerId - Customer ID for tenant isolation
 * @param limit - Max results to return (default: 5)
 * @returns Array of matching catalog assets with scores
 */
export async function catalogSearch(
  query: string,
  customerId: string,
  limit = 5,
): Promise<FTSResult[]> {
  // Use FTS for exact name matches (more reliable for asset lookup)
  const ftsResults = await ftsIndex.search(query, customerId, limit);

  // Also try vector similarity for semantic matches
  const queryVector = await vectorStore.embed(query);
  const vectorResults = await vectorStore.query(queryVector, limit, 'catalog', (meta) => {
    return meta.customerId === customerId;
  });

  // Merge results, preferring FTS for exact matches
  const seen = new Set<string>();
  const merged: FTSResult[] = [];

  for (const r of ftsResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  for (const r of vectorResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push({ id: r.id, score: r.score, metadata: r.metadata });
    }
  }

  return merged.slice(0, limit);
}

/** Connector bridge for Iceberg / Polaris integration. */
export { ConnectorBridge } from './connectors/connector-bridge.js';

import { ConnectorBridge } from './connectors/connector-bridge.js';

/** Singleton ConnectorBridge instance wired to the shared message bus. */
export const connectorBridge = new ConnectorBridge();
connectorBridge.setMessageBus(messageBus);
