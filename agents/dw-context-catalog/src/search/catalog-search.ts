/**
 * Catalog Search Engine (REQ-CTX-AG-004, REQ-RAG-003).
 *
 * Hybrid retrieval combining:
 * 1. Vector similarity (semantic search)
 * 2. BM25 keyword matching
 * 3. Graph-based retrieval (lineage-aware)
 * 4. Reciprocal Rank Fusion (RRF) reranking
 *
 * Target: query results <2s, search time 30min -> 30s.
 */

import type { IVectorStore, IFullTextSearch, IGraphDB } from '@data-workers/infrastructure-stubs';
import type { TableInfo } from '@data-workers/connector-shared';
import type { CatalogRegistry } from '@data-workers/connector-shared';
import type { DataAsset, SearchResult, AssetType } from '../types.js';
import { Reranker } from './reranker.js';

export interface SearchBackends {
  vectorStore: IVectorStore;
  fullTextSearch: IFullTextSearch;
  graphDB: IGraphDB;
}

export interface SearchConfig {
  vectorWeight: number;
  bm25Weight: number;
  graphWeight: number;
  connectorWeight: number;
  minScore: number;
  /** Boost multiplier for exact name matches. */
  exactNameBoost: number;
  /** Boost multiplier for tag matches. */
  tagMatchBoost: number;
}

export interface ColdStartResponse {
  coldStart: true;
  message: string;
}

const RRF_K = 60; // Standard RRF constant
const PER_BACKEND_TIMEOUT_MS = 500;
const CONNECTOR_TIMEOUT_MS = 2000;

/** TTL values by query type (milliseconds). */
const CACHE_TTL_SEARCH = 300_000;   // 5 minutes
const CACHE_TTL_LINEAGE = 900_000;  // 15 minutes
const CACHE_TTL_FRESHNESS = 60_000; // 1 minute

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Tenant-isolated result cache with per-query-type TTL.
 */
export class ResultCache {
  private store = new Map<string, CacheEntry<unknown>>();

  /** Build a cache key that includes tenant isolation. */
  static key(query: string, customerId: string, options?: Record<string, unknown>): string {
    return `${query}:${customerId}:${JSON.stringify(options ?? {})}`;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export class CatalogSearchEngine {
  private config: SearchConfig;
  private backends: SearchBackends | null;
  private catalogRegistry: CatalogRegistry | null;
  private cache: ResultCache;

  constructor(backends?: SearchBackends, config?: Partial<SearchConfig>, catalogRegistry?: CatalogRegistry) {
    this.backends = backends || null;
    this.catalogRegistry = catalogRegistry || null;
    this.cache = new ResultCache();
    this.config = {
      vectorWeight: 0.45,
      bm25Weight: 0.25,
      graphWeight: 0.15,
      connectorWeight: 0.15,
      minScore: 0.1,
      exactNameBoost: 2.0,
      tagMatchBoost: 1.5,
      ...config,
    };
  }

  /** Clear the result cache. */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Determine the cache TTL based on query content.
   */
  private getCacheTTL(query: string): number {
    const q = query.toLowerCase();
    if (/\blineage\b|\bupstream\b|\bdownstream\b|\bdepends?\b|\bderived?\b/.test(q)) {
      return CACHE_TTL_LINEAGE;
    }
    if (/\bfresh(ness)?\b|\bstale\b|\bsla\b|\bupdated\b|\brefresh\b|\blag\b|\blatency\b/.test(q)) {
      return CACHE_TTL_FRESHNESS;
    }
    return CACHE_TTL_SEARCH;
  }

  /**
   * Perform hybrid search across the catalog.
   */
  async search(
    query: string,
    customerId: string,
    limit = 20,
    platforms?: string[],
  ): Promise<SearchResult[] | ColdStartResponse> {
    if (!this.backends) {
      return [];
    }

    // Check cache
    const cacheKey = ResultCache.key(query, customerId, { limit, platforms });
    const cached = this.cache.get<SearchResult[] | ColdStartResponse>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const [vectorResults, bm25Results, graphResults, connectorResults] = await Promise.all([
      this.withTimeout(this.vectorSearch(query, customerId, limit), []),
      this.withTimeout(this.bm25Search(query, customerId, limit), []),
      this.withTimeout(this.graphSearch(query, customerId, limit), []),
      this.withTimeout(this.connectorSearch(query, customerId, limit, platforms), [], CONNECTOR_TIMEOUT_MS),
    ]);

    // Cold-start detection
    if (vectorResults.length === 0 && bm25Results.length === 0 && graphResults.length === 0 && connectorResults.length === 0) {
      const coldStartResult: ColdStartResponse = { coldStart: true, message: 'Catalog not yet indexed. Run a crawler to populate the catalog.' };
      this.cache.set(cacheKey, coldStartResult, CACHE_TTL_SEARCH);
      return coldStartResult;
    }

    // Merge with RRF
    const merged = this.mergeResults(vectorResults, bm25Results, graphResults, connectorResults);

    // Rerank (pass-through for now) — reranker normalizes scores to 0-1 range
    const reranked = await this.rerank(query, merged);

    // Apply relevance boosts for exact name matches and tag matches
    const boosted = this.applyRelevanceBoosts(query, reranked);

    // Re-sort after boosting and apply minimum relevance threshold
    // The threshold is applied after reranking (scores are normalized 0-1) rather
    // than on raw RRF scores which are typically very small (1/(k+rank)).
    boosted.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const aboveThreshold = this.config.minScore > 0
      ? boosted.filter(r => r.relevanceScore >= this.config.minScore)
      : boosted;

    const finalResults = aboveThreshold.slice(0, limit);

    // Store in cache with query-type-appropriate TTL
    this.cache.set(cacheKey, finalResults, this.getCacheTTL(query));

    return finalResults;
  }

  private async vectorSearch(query: string, customerId: string, limit: number): Promise<SearchResult[]> {
    const queryVector = await this.backends!.vectorStore.embed(query);
    const results = await this.backends!.vectorStore.query(
      queryVector,
      limit,
      'catalog',
      (metadata) => metadata.customerId === customerId,
    );

    return results.map(r => ({
      asset: this.metadataToAsset(r.id, r.metadata),
      relevanceScore: r.score,
      matchedFields: ['embedding'],
    }));
  }

  private async bm25Search(query: string, customerId: string, limit: number): Promise<SearchResult[]> {
    const results = await this.backends!.fullTextSearch.search(query, customerId, limit);

    return results.map(r => ({
      asset: this.metadataToAsset(r.id, r.metadata),
      relevanceScore: r.score,
      matchedFields: this.getMatchedFields(query, r.metadata),
    }));
  }

  private async graphSearch(query: string, customerId: string, limit: number): Promise<SearchResult[]> {
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Use findByName for each term + 2-hop neighbor expansion (replaces O(n) getAllNodes scan)
    const candidateIds = new Set<string>();
    for (const term of queryTerms) {
      const nameMatches = await this.backends!.graphDB.findByName(term, customerId);
      for (const node of nameMatches) {
        candidateIds.add(node.id);
        // 2-hop neighbor expansion
        const upstream = await this.backends!.graphDB.traverseUpstream(node.id, 2);
        const downstream = await this.backends!.graphDB.traverseDownstream(node.id, 2);
        for (const u of upstream) candidateIds.add(u.node.id);
        for (const d of downstream) candidateIds.add(d.node.id);
      }
    }

    // Score candidates by term match quality
    const results: SearchResult[] = [];
    for (const id of candidateIds) {
      const node = await this.backends!.graphDB.getNode(id);
      if (!node || node.customerId !== customerId) continue;
      const searchable = `${node.name} ${(node.properties.description as string) || ''}`.toLowerCase();
      const matchCount = queryTerms.filter(term => searchable.includes(term)).length;
      if (matchCount > 0) {
        results.push({
          asset: this.graphNodeToAsset(node),
          relevanceScore: matchCount / queryTerms.length,
          matchedFields: ['graph'],
        });
      }
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results.slice(0, limit);
  }

  /**
   * Search across registered CatalogRegistry providers via searchTables().
   * Each provider that supports the 'search' capability is queried in parallel.
   * Results are converted to SearchResult format for RRF fusion.
   */
  private async connectorSearch(
    query: string,
    _customerId: string,
    limit: number,
    platforms?: string[],
  ): Promise<SearchResult[]> {
    if (!this.catalogRegistry) return [];

    const registeredTypes = this.catalogRegistry.list();
    if (registeredTypes.length === 0) return [];

    // Filter to requested platforms if specified
    const targetTypes = platforms && platforms.length > 0
      ? registeredTypes.filter(t => platforms.map(p => p.toLowerCase()).includes(t.toLowerCase()))
      : registeredTypes;

    if (targetTypes.length === 0) return [];

    const allResults: SearchResult[] = [];

    const providerPromises = targetTypes.map(async (type) => {
      try {
        const provider = this.catalogRegistry!.create(type);
        if (!provider.searchTables) return [];

        const tables: TableInfo[] = await Promise.resolve(provider.searchTables(query));
        return tables.map((table): SearchResult => ({
          asset: this.tableInfoToAsset(table, type, _customerId),
          relevanceScore: 1.0, // Connector results are pre-filtered; RRF handles ranking
          matchedFields: ['connector'],
        }));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[CatalogSearchEngine] Connector '${type}' search failed (degraded): ${msg}`);
        return [];
      }
    });

    const results = await Promise.all(providerPromises);
    for (const batch of results) {
      allResults.push(...batch);
    }

    return allResults.slice(0, limit);
  }

  /** Convert a TableInfo from a connector into a DataAsset. */
  private tableInfoToAsset(table: TableInfo, platform: string, customerId: string): DataAsset {
    return {
      id: `${platform}://${table.namespace.join('.')}.${table.name}`,
      customerId,
      name: table.name,
      type: (table.tableType as AssetType) || 'table',
      platform,
      description: table.properties?.description || '',
      tags: [],
      owner: table.properties?.owner || '',
      qualityScore: 0,
      freshnessScore: 0,
      lastUpdated: Date.now(),
      lastCrawled: Date.now(),
      metadata: { namespace: table.namespace, ...table.properties },
    };
  }

  /**
   * Reciprocal Rank Fusion (RRF) merging.
   * RRF_score(asset) = sum over all result_sets of: weight * (1 / (k + rank))
   */
  private mergeResults(
    vectorResults: SearchResult[],
    bm25Results: SearchResult[],
    graphResults: SearchResult[],
    connectorResults: SearchResult[] = [],
  ): SearchResult[] {
    const resultSets: Array<{ results: SearchResult[]; weight: number }> = [
      { results: vectorResults, weight: this.config.vectorWeight },
      { results: bm25Results, weight: this.config.bm25Weight },
      { results: graphResults, weight: this.config.graphWeight },
      { results: connectorResults, weight: this.config.connectorWeight },
    ];
    const scores = new Map<string, { result: SearchResult; score: number; matchedFields: Set<string> }>();

    for (const { results, weight } of resultSets) {

      for (let rank = 0; rank < results.length; rank++) {
        const result = results[rank];
        const rrfScore = weight * (1 / (RRF_K + rank + 1)); // rank is 0-indexed, +1 for 1-indexed

        const existing = scores.get(result.asset.id);
        if (existing) {
          existing.score += rrfScore;
          for (const field of result.matchedFields) {
            existing.matchedFields.add(field);
          }
        } else {
          scores.set(result.asset.id, {
            result: { ...result },
            score: rrfScore,
            matchedFields: new Set(result.matchedFields),
          });
        }
      }
    }

    return Array.from(scores.values())
      .map(entry => ({
        ...entry.result,
        relevanceScore: entry.score,
        matchedFields: Array.from(entry.matchedFields),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private async rerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    if (!this.backends) return results;
    const reranker = new Reranker();
    return await reranker.rerank(query, results, this.backends.graphDB);
  }

  /**
   * Apply relevance boosts for exact name matches and tag matches.
   *
   * - Exact name match (query === asset.name, case-insensitive): 2x score multiplier
   * - Prefix name match (asset.name starts with query): 1.5x score multiplier
   * - Tag match (any asset tag contains a query term): 1.5x score multiplier
   */
  private applyRelevanceBoosts(query: string, results: SearchResult[]): SearchResult[] {
    const queryLower = query.toLowerCase().trim();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

    return results.map(result => {
      let boost = 1.0;
      const assetNameLower = result.asset.name.toLowerCase();

      // Exact name match — highest boost
      if (assetNameLower === queryLower) {
        boost *= this.config.exactNameBoost;
      }
      // Prefix match — partial boost
      else if (assetNameLower.startsWith(queryLower) || queryLower.startsWith(assetNameLower)) {
        boost *= (this.config.exactNameBoost + 1.0) / 2; // halfway between 1x and full boost
      }

      // Tag match boost
      const assetTags = (result.asset.tags ?? []).map(t => t.toLowerCase());
      if (assetTags.length > 0) {
        const tagMatchCount = queryTerms.filter(term =>
          assetTags.some(tag => tag.includes(term) || term.includes(tag)),
        ).length;
        if (tagMatchCount > 0) {
          boost *= this.config.tagMatchBoost;
        }
      }

      return {
        ...result,
        relevanceScore: result.relevanceScore * boost,
      };
    });
  }

  /** Race a backend call against a timeout; on error or timeout, return the fallback value. */
  private async withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs: number = PER_BACKEND_TIMEOUT_MS): Promise<T> {
    let timerId: ReturnType<typeof setTimeout>;
    return Promise.race([
      promise.then(result => { clearTimeout(timerId); return result; }).catch((error: unknown) => {
        clearTimeout(timerId);
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[CatalogSearchEngine] Backend error (degraded): ${msg}`);
        return fallback;
      }),
      new Promise<T>((resolve) => {
        timerId = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  }

  private metadataToAsset(id: string, metadata: Record<string, unknown>): DataAsset {
    return {
      id,
      customerId: (metadata.customerId as string) || '',
      name: (metadata.name as string) || '',
      type: (metadata.type as AssetType) || 'table',
      platform: (metadata.platform as string) || '',
      description: (metadata.description as string) || '',
      tags: (metadata.tags as string[]) || [],
      owner: (metadata.owner as string) || '',
      qualityScore: (metadata.qualityScore as number) || 0,
      freshnessScore: (metadata.freshnessScore as number) || 0,
      lastUpdated: Date.now() - 3600000,
      lastCrawled: Date.now(),
      metadata: {},
    };
  }

  private graphNodeToAsset(node: { id: string; type: string; name: string; platform: string; properties: Record<string, unknown>; customerId: string }): DataAsset {
    return {
      id: node.id,
      customerId: node.customerId,
      name: node.name,
      type: node.type as AssetType,
      platform: node.platform,
      description: (node.properties.description as string) || '',
      tags: [],
      owner: '',
      qualityScore: 0,
      freshnessScore: 0,
      lastUpdated: Date.now() - 3600000,
      lastCrawled: Date.now(),
      metadata: {},
    };
  }

  private getMatchedFields(query: string, metadata: Record<string, unknown>): string[] {
    const fields: string[] = [];
    const words = query.toLowerCase().split(/\s+/);
    const name = ((metadata.name as string) || '').toLowerCase();
    const description = ((metadata.description as string) || '').toLowerCase();
    const tags = ((metadata.tags as string[]) || []).map(t => t.toLowerCase());

    for (const word of words) {
      if (name.includes(word) && !fields.includes('name')) fields.push('name');
      if (description.includes(word) && !fields.includes('description')) fields.push('description');
      if (tags.some(t => t.includes(word)) && !fields.includes('tags')) fields.push('tags');
    }
    return fields;
  }
}
