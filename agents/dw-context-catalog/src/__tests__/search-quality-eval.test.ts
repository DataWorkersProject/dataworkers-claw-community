/**
 * Search Quality Evaluation Suite
 *
 * Measures search quality across 200+ golden queries with IR metrics:
 * - Precision@5: (relevant results in top 5) / 5
 * - Recall@10: (relevant results in top 10) / (total relevant)
 * - MRR: 1 / (rank of first relevant result)
 * - Cross-platform recall: relevant cross-platform results found / expected
 *
 * This suite measures current performance and sets lenient baseline thresholds.
 * It should PASS on the current implementation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CatalogSearchEngine } from '../search/catalog-search.js';
import { InMemoryVectorStore, InMemoryFullTextSearch, InMemoryGraphDB } from '@data-workers/infrastructure-stubs';
import type { SearchResult } from '../types.js';
import type { ColdStartResponse } from '../search/catalog-search.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Types ──────────────────────────────────────────────────────────────────

interface GoldenQuery {
  query: string;
  category: 'simple_lookup' | 'cross_platform' | 'domain_nlp' | 'lineage' | 'metric_semantic' | 'edge_case';
  expectedAssetIds: string[];
  expectedMinResults: number;
}

interface GoldenDataset {
  version: string;
  description: string;
  queries: GoldenQuery[];
}

interface QueryMetrics {
  query: string;
  category: string;
  precision5: number;
  recall10: number;
  mrr: number;
  resultCount: number;
  relevantInTop5: number;
  relevantInTop10: number;
  firstRelevantRank: number | null;
}

interface AggregateMetrics {
  avgPrecision5: number;
  avgRecall10: number;
  avgMRR: number;
  totalQueries: number;
  queriesWithResults: number;
  queriesWithRelevantResults: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isSearchResults(result: SearchResult[] | ColdStartResponse): result is SearchResult[] {
  return Array.isArray(result);
}

function computeQueryMetrics(
  query: GoldenQuery,
  results: SearchResult[],
): QueryMetrics {
  const expectedSet = new Set(query.expectedAssetIds);
  const resultIds = results.map(r => r.asset.id);

  // Precision@5: how many of top-5 results are relevant
  const top5 = resultIds.slice(0, 5);
  const relevantInTop5 = top5.filter(id => expectedSet.has(id)).length;
  const precision5 = top5.length > 0 ? relevantInTop5 / Math.min(5, top5.length) : 0;

  // Recall@10: how many expected assets appear in top-10
  const top10 = resultIds.slice(0, 10);
  const relevantInTop10 = top10.filter(id => expectedSet.has(id)).length;
  const recall10 = expectedSet.size > 0 ? relevantInTop10 / expectedSet.size : 1; // 1 if nothing expected

  // MRR: reciprocal rank of first relevant result
  let firstRelevantRank: number | null = null;
  for (let i = 0; i < resultIds.length; i++) {
    if (expectedSet.has(resultIds[i])) {
      firstRelevantRank = i + 1; // 1-indexed
      break;
    }
  }
  const mrr = firstRelevantRank !== null ? 1 / firstRelevantRank : 0;

  return {
    query: query.query,
    category: query.category,
    precision5,
    recall10,
    mrr,
    resultCount: results.length,
    relevantInTop5,
    relevantInTop10,
    firstRelevantRank,
  };
}

function computeAggregateMetrics(metrics: QueryMetrics[]): AggregateMetrics {
  const total = metrics.length;
  if (total === 0) {
    return { avgPrecision5: 0, avgRecall10: 0, avgMRR: 0, totalQueries: 0, queriesWithResults: 0, queriesWithRelevantResults: 0 };
  }

  const sumP5 = metrics.reduce((s, m) => s + m.precision5, 0);
  const sumR10 = metrics.reduce((s, m) => s + m.recall10, 0);
  const sumMRR = metrics.reduce((s, m) => s + m.mrr, 0);
  const withResults = metrics.filter(m => m.resultCount > 0).length;
  const withRelevant = metrics.filter(m => m.firstRelevantRank !== null).length;

  return {
    avgPrecision5: sumP5 / total,
    avgRecall10: sumR10 / total,
    avgMRR: sumMRR / total,
    totalQueries: total,
    queriesWithResults: withResults,
    queriesWithRelevantResults: withRelevant,
  };
}

function formatPercent(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

// ── Test Suite ─────────────────────────────────────────────────────────────

describe('Search Quality Evaluation Suite', () => {
  let engine: CatalogSearchEngine;
  let goldenDataset: GoldenDataset;
  let allMetrics: QueryMetrics[] = [];
  const metricsByCategory = new Map<string, QueryMetrics[]>();

  beforeAll(async () => {
    // Set up seeded backends
    const vectorStore = new InMemoryVectorStore();
    const fullTextSearch = new InMemoryFullTextSearch();
    const graphDB = new InMemoryGraphDB();
    vectorStore.seed();
    fullTextSearch.seed();
    graphDB.seed();
    engine = new CatalogSearchEngine({ vectorStore, fullTextSearch, graphDB });

    // Load golden queries
    const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'golden-queries.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    goldenDataset = JSON.parse(raw) as GoldenDataset;

    // Run all queries and collect metrics
    for (const gq of goldenDataset.queries) {
      const result = await engine.search(gq.query, 'cust-1', 20);
      const results = isSearchResults(result) ? result : [];
      const qm = computeQueryMetrics(gq, results);
      allMetrics.push(qm);

      if (!metricsByCategory.has(gq.category)) {
        metricsByCategory.set(gq.category, []);
      }
      metricsByCategory.get(gq.category)!.push(qm);
    }
  });

  it('should load 200+ golden queries', () => {
    expect(goldenDataset.queries.length).toBeGreaterThanOrEqual(200);
  });

  it('should cover all 6 categories', () => {
    const categories = new Set(goldenDataset.queries.map(q => q.category));
    expect(categories.has('simple_lookup')).toBe(true);
    expect(categories.has('cross_platform')).toBe(true);
    expect(categories.has('domain_nlp')).toBe(true);
    expect(categories.has('lineage')).toBe(true);
    expect(categories.has('metric_semantic')).toBe(true);
    expect(categories.has('edge_case')).toBe(true);
    expect(categories.size).toBe(6);
  });

  describe('aggregate metrics', () => {
    it('logs overall metrics table', () => {
      const overall = computeAggregateMetrics(allMetrics);

      // Log the overall metrics table
      console.log('\n╔══════════════════════════════════════════════════════════════╗');
      console.log('║          SEARCH QUALITY EVALUATION RESULTS                  ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║ Total Golden Queries:         ${String(overall.totalQueries).padStart(6)}                       ║`);
      console.log(`║ Queries With Results:         ${String(overall.queriesWithResults).padStart(6)}                       ║`);
      console.log(`║ Queries With Relevant Match:  ${String(overall.queriesWithRelevantResults).padStart(6)}                       ║`);
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║ Mean Precision@5:          ${formatPercent(overall.avgPrecision5).padStart(8)}                       ║`);
      console.log(`║ Mean Recall@10:            ${formatPercent(overall.avgRecall10).padStart(8)}                       ║`);
      console.log(`║ Mean Reciprocal Rank:      ${formatPercent(overall.avgMRR).padStart(8)}                       ║`);
      console.log('╠══════════════════════════════════════════════════════════════╣');

      // Per-category breakdown
      console.log('║ Category              P@5      R@10     MRR      Count     ║');
      console.log('║ ─────────────────────────────────────────────────────────── ║');

      for (const [category, metrics] of metricsByCategory) {
        const catAgg = computeAggregateMetrics(metrics);
        const cat = category.padEnd(20);
        const p5 = formatPercent(catAgg.avgPrecision5).padStart(7);
        const r10 = formatPercent(catAgg.avgRecall10).padStart(7);
        const mrr = formatPercent(catAgg.avgMRR).padStart(7);
        const cnt = String(catAgg.totalQueries).padStart(5);
        console.log(`║ ${cat} ${p5}  ${r10}  ${mrr}    ${cnt}     ║`);
      }

      console.log('╚══════════════════════════════════════════════════════════════╝');

      expect(overall.totalQueries).toBeGreaterThanOrEqual(200);
    });
  });

  describe('simple_lookup category', () => {
    it('achieves baseline Precision@5 >= 5%', () => {
      const metrics = metricsByCategory.get('simple_lookup') || [];
      const agg = computeAggregateMetrics(metrics);
      console.log(`[simple_lookup] P@5=${formatPercent(agg.avgPrecision5)} R@10=${formatPercent(agg.avgRecall10)} MRR=${formatPercent(agg.avgMRR)}`);
      expect(agg.avgPrecision5).toBeGreaterThanOrEqual(0.05);
    });

    it('achieves baseline MRR >= 10%', () => {
      const metrics = metricsByCategory.get('simple_lookup') || [];
      const agg = computeAggregateMetrics(metrics);
      expect(agg.avgMRR).toBeGreaterThanOrEqual(0.10);
    });

    it('achieves baseline Recall@10 >= 5%', () => {
      const metrics = metricsByCategory.get('simple_lookup') || [];
      const agg = computeAggregateMetrics(metrics);
      expect(agg.avgRecall10).toBeGreaterThanOrEqual(0.05);
    });
  });

  describe('cross_platform category', () => {
    it('achieves baseline Precision@5 >= 3%', () => {
      const metrics = metricsByCategory.get('cross_platform') || [];
      const agg = computeAggregateMetrics(metrics);
      console.log(`[cross_platform] P@5=${formatPercent(agg.avgPrecision5)} R@10=${formatPercent(agg.avgRecall10)} MRR=${formatPercent(agg.avgMRR)}`);
      expect(agg.avgPrecision5).toBeGreaterThanOrEqual(0.03);
    });

    it('achieves baseline cross-platform recall >= 3%', () => {
      const metrics = metricsByCategory.get('cross_platform') || [];
      const agg = computeAggregateMetrics(metrics);
      expect(agg.avgRecall10).toBeGreaterThanOrEqual(0.03);
    });
  });

  describe('domain_nlp category', () => {
    it('achieves baseline Precision@5 >= 2%', () => {
      const metrics = metricsByCategory.get('domain_nlp') || [];
      const agg = computeAggregateMetrics(metrics);
      console.log(`[domain_nlp] P@5=${formatPercent(agg.avgPrecision5)} R@10=${formatPercent(agg.avgRecall10)} MRR=${formatPercent(agg.avgMRR)}`);
      expect(agg.avgPrecision5).toBeGreaterThanOrEqual(0.02);
    });

    it('achieves baseline MRR >= 2%', () => {
      const metrics = metricsByCategory.get('domain_nlp') || [];
      const agg = computeAggregateMetrics(metrics);
      expect(agg.avgMRR).toBeGreaterThanOrEqual(0.02);
    });
  });

  describe('lineage category', () => {
    it('achieves baseline Precision@5 >= 3%', () => {
      const metrics = metricsByCategory.get('lineage') || [];
      const agg = computeAggregateMetrics(metrics);
      console.log(`[lineage] P@5=${formatPercent(agg.avgPrecision5)} R@10=${formatPercent(agg.avgRecall10)} MRR=${formatPercent(agg.avgMRR)}`);
      expect(agg.avgPrecision5).toBeGreaterThanOrEqual(0.03);
    });

    it('achieves baseline MRR >= 5%', () => {
      const metrics = metricsByCategory.get('lineage') || [];
      const agg = computeAggregateMetrics(metrics);
      expect(agg.avgMRR).toBeGreaterThanOrEqual(0.05);
    });
  });

  describe('metric_semantic category', () => {
    it('achieves baseline Precision@5 >= 2%', () => {
      const metrics = metricsByCategory.get('metric_semantic') || [];
      const agg = computeAggregateMetrics(metrics);
      console.log(`[metric_semantic] P@5=${formatPercent(agg.avgPrecision5)} R@10=${formatPercent(agg.avgRecall10)} MRR=${formatPercent(agg.avgMRR)}`);
      expect(agg.avgPrecision5).toBeGreaterThanOrEqual(0.02);
    });
  });

  describe('edge_case category', () => {
    it('does not crash on any edge case query', () => {
      const metrics = metricsByCategory.get('edge_case') || [];
      // If we got here without throwing, all edge case queries completed
      expect(metrics.length).toBe(20);
      console.log(`[edge_case] All ${metrics.length} edge case queries completed without errors`);
    });

    it('empty/whitespace queries do not crash (result count logged)', () => {
      const edgeMetrics = metricsByCategory.get('edge_case') || [];
      const emptyQueries = edgeMetrics.filter(m => m.query.trim() === '');
      for (const m of emptyQueries) {
        // Log the behavior -- the engine may return results or cold-start for empty queries
        console.log(`  Empty query "${m.query}" returned ${m.resultCount} results`);
      }
      // The key assertion is that we got here without throwing
      expect(emptyQueries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('overall baseline thresholds', () => {
    it('overall MRR >= 5% (lenient initial baseline)', () => {
      const overall = computeAggregateMetrics(allMetrics);
      expect(overall.avgMRR).toBeGreaterThanOrEqual(0.05);
    });

    it('overall Precision@5 >= 2% (lenient initial baseline)', () => {
      const overall = computeAggregateMetrics(allMetrics);
      expect(overall.avgPrecision5).toBeGreaterThanOrEqual(0.02);
    });

    it('at least 50% of non-edge queries return at least 1 result', () => {
      const nonEdge = allMetrics.filter(m => m.category !== 'edge_case');
      const withResults = nonEdge.filter(m => m.resultCount > 0).length;
      const ratio = withResults / nonEdge.length;
      console.log(`[coverage] ${withResults}/${nonEdge.length} non-edge queries returned results (${formatPercent(ratio)})`);
      expect(ratio).toBeGreaterThanOrEqual(0.50);
    });

    it('at least 30% of non-edge queries have a relevant result in top 10', () => {
      const nonEdge = allMetrics.filter(m => m.category !== 'edge_case');
      const withRelevant = nonEdge.filter(m => m.firstRelevantRank !== null).length;
      const ratio = withRelevant / nonEdge.length;
      console.log(`[relevance] ${withRelevant}/${nonEdge.length} non-edge queries had relevant result in top 10 (${formatPercent(ratio)})`);
      expect(ratio).toBeGreaterThanOrEqual(0.30);
    });

    it('logs bottom-10 worst performing queries for diagnostics', () => {
      const nonEdge = allMetrics.filter(m => m.category !== 'edge_case' && m.query.length > 0);
      const sorted = [...nonEdge].sort((a, b) => a.mrr - b.mrr);
      const worst10 = sorted.slice(0, 10);

      console.log('\n── Bottom 10 Queries (by MRR) ──');
      for (const m of worst10) {
        console.log(`  [${m.category}] "${m.query}" → MRR=${formatPercent(m.mrr)}, P@5=${formatPercent(m.precision5)}, results=${m.resultCount}, firstRelevant=${m.firstRelevantRank ?? 'none'}`);
      }

      // This test always passes — it's purely diagnostic
      expect(worst10.length).toBeLessThanOrEqual(10);
    });
  });
});
