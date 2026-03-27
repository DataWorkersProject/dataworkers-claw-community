/**
 * Multi-signal Reranker for catalog search results.
 * Combines 6 signals with configurable weights to produce a final relevance score.
 */

import type { IGraphDB } from '@data-workers/infrastructure-stubs';
import type { SearchResult } from '../types.js';

export interface RerankerSignals {
  textRelevance: number;
  popularity: number;
  freshnessScore: number;
  qualityScore: number;
  userAffinity: number;
  graphCentrality: number;
  /** Query history signal — normalized 0-1 based on query count. */
  queryHistory: number;
}

export interface RerankerWeights {
  textRelevance: number;
  popularity: number;
  freshnessScore: number;
  qualityScore: number;
  userAffinity: number;
  graphCentrality: number;
  /** Weight for query history signal. */
  queryHistory: number;
}

const DEFAULT_WEIGHTS: RerankerWeights = {
  textRelevance: 0.35,
  popularity: 0.15,
  freshnessScore: 0.10,
  qualityScore: 0.10,
  userAffinity: 0.10,
  graphCentrality: 0.10,
  queryHistory: 0.10,
};

export class Reranker {
  private weights: RerankerWeights;

  constructor(weights?: Partial<RerankerWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Rerank search results using multi-signal weighted scoring.
   */
  async rerank(query: string, results: SearchResult[], graphDB: IGraphDB): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    // Compute max downstream for normalization
    let maxDownstream = 1;
    const downstreamCounts = new Map<string, number>();
    for (const result of results) {
      const downstream = await graphDB.traverseDownstream(result.asset.id, 1);
      const count = downstream.length;
      downstreamCounts.set(result.asset.id, count);
      if (count > maxDownstream) maxDownstream = count;
    }

    // Compute max edges for centrality normalization
    let maxEdges = 1;
    const edgeCounts = new Map<string, number>();
    for (const result of results) {
      const upstream = await graphDB.traverseUpstream(result.asset.id, 1);
      const downstream = downstreamCounts.get(result.asset.id) ?? 0;
      const totalEdges = upstream.length + downstream;
      edgeCounts.set(result.asset.id, totalEdges);
      if (totalEdges > maxEdges) maxEdges = totalEdges;
    }

    // Normalize text relevance to 0-1 range
    const maxRelevance = Math.max(...results.map(r => r.relevanceScore), 0.001);

    const reranked = results.map(result => {
      // Query history signal from asset metadata (normalized 0-1)
      const queryCount = (result.asset.metadata?.queryCount as number) ?? 0;
      const queryHistorySignal = Math.min(queryCount / 500, 1.0);

      const signals: RerankerSignals = {
        textRelevance: result.relevanceScore / maxRelevance,
        popularity: (downstreamCounts.get(result.asset.id) ?? 0) / maxDownstream,
        freshnessScore: (result.asset.freshnessScore ?? 0) / 100,
        qualityScore: (result.asset.qualityScore ?? 0) / 100,
        userAffinity: 0.5, // Default — no user tracking yet
        graphCentrality: (edgeCounts.get(result.asset.id) ?? 0) / maxEdges,
        queryHistory: queryHistorySignal,
      };

      const score =
        this.weights.textRelevance * signals.textRelevance +
        this.weights.popularity * signals.popularity +
        this.weights.freshnessScore * signals.freshnessScore +
        this.weights.qualityScore * signals.qualityScore +
        this.weights.userAffinity * signals.userAffinity +
        this.weights.graphCentrality * signals.graphCentrality +
        this.weights.queryHistory * signals.queryHistory;

      return {
        ...result,
        relevanceScore: score,
      };
    });

    reranked.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return reranked;
  }

  /**
   * Compute signals for a single result (for debugging/transparency).
   */
  async computeSignals(result: SearchResult, graphDB: IGraphDB): Promise<RerankerSignals> {
    const downstream = await graphDB.traverseDownstream(result.asset.id, 1);
    const upstream = await graphDB.traverseUpstream(result.asset.id, 1);
    const queryCount = (result.asset.metadata?.queryCount as number) ?? 0;
    return {
      textRelevance: result.relevanceScore,
      popularity: downstream.length / 10, // Normalize against typical max
      freshnessScore: (result.asset.freshnessScore ?? 0) / 100,
      qualityScore: (result.asset.qualityScore ?? 0) / 100,
      userAffinity: 0.5,
      graphCentrality: (upstream.length + downstream.length) / 20,
      queryHistory: Math.min(queryCount / 500, 1.0),
    };
  }
}
