/**
 * Benchmark Scenarios — dw-context-catalog (hero agent)
 *
 * 8 scenarios covering the breadth of catalog capabilities:
 * search, context retrieval, lineage, documentation, freshness,
 * impact analysis, cross-platform search, and business rules.
 */

import type { BenchmarkScenario } from '../types.js';
import { nonEmptyCheck, typeCheck } from '../framework.js';

const CID = 'test-customer-1';

export const catalogScenarios: BenchmarkScenario[] = [
  // ── 1. Basic dataset search ─────────────────────────────────────────────
  {
    name: 'catalog-search-basic',
    description: 'Search for datasets using a natural-language query',
    agent: 'dw-context-catalog',
    tool: 'search_datasets',
    input: { query: 'customer orders', customerId: CID },
    expectedFields: ['results'],
    expectedPatterns: [/results/],
    qualityChecks: [
      { name: 'results-is-array', fn: typeCheck({ results: 'array' }) },
    ],
    category: 'search',
    difficulty: 'basic',
  },

  // ── 2. Get asset context ────────────────────────────────────────────────
  {
    name: 'catalog-get-context',
    description: 'Retrieve full context for a specific asset',
    agent: 'dw-context-catalog',
    tool: 'get_context',
    input: { assetId: 'fact_orders', customerId: CID },
    expectedFields: ['assetId'],
    qualityChecks: [
      { name: 'asset-id-non-empty', fn: nonEmptyCheck(['assetId']) },
    ],
    category: 'search',
    difficulty: 'basic',
  },

  // ── 3. Get lineage ─────────────────────────────────────────────────────
  {
    name: 'catalog-get-lineage',
    description: 'Retrieve upstream/downstream lineage for an asset',
    agent: 'dw-context-catalog',
    tool: 'get_lineage',
    input: { assetId: 'fact_orders', customerId: CID },
    expectedFields: ['assetId'],
    qualityChecks: [
      { name: 'lineage-fields-present', fn: nonEmptyCheck(['assetId']) },
    ],
    category: 'analysis',
    difficulty: 'basic',
  },

  // ── 4. Check freshness ────────────────────────────────────────────────
  {
    name: 'catalog-check-freshness',
    description: 'Assess how stale a dataset is',
    agent: 'dw-context-catalog',
    tool: 'check_freshness',
    input: { assetId: 'fact_orders', customerId: CID },
    expectedFields: ['assetId'],
    category: 'monitoring',
    difficulty: 'basic',
  },

  // ── 5. Blast radius analysis ──────────────────────────────────────────
  {
    name: 'catalog-blast-radius',
    description: 'Analyze downstream impact if a dataset breaks',
    agent: 'dw-context-catalog',
    tool: 'blast_radius_analysis',
    input: { assetId: 'fact_orders', customerId: CID },
    expectedFields: ['assetId'],
    category: 'analysis',
    difficulty: 'intermediate',
  },

  // ── 6. Generate documentation ──────────────────────────────────────────
  {
    name: 'catalog-generate-docs',
    description: 'Auto-generate documentation for a dataset',
    agent: 'dw-context-catalog',
    tool: 'generate_documentation',
    input: { assetId: 'fact_orders', customerId: CID },
    expectedFields: ['assetId'],
    category: 'generation',
    difficulty: 'intermediate',
  },

  // ── 7. Cross-platform search ──────────────────────────────────────────
  {
    name: 'catalog-cross-platform-search',
    description: 'Search across multiple catalog platforms',
    agent: 'dw-context-catalog',
    tool: 'search_across_platforms',
    input: { query: 'customer orders', customerId: CID },
    expectedFields: ['results'],
    qualityChecks: [
      { name: 'results-is-array', fn: typeCheck({ results: 'array' }) },
    ],
    category: 'search',
    difficulty: 'advanced',
  },

  // ── 8. Define business rule ───────────────────────────────────────────
  {
    name: 'catalog-define-business-rule',
    description: 'Define a business rule for an asset',
    agent: 'dw-context-catalog',
    tool: 'define_business_rule',
    input: {
      assetId: 'fact_orders',
      ruleType: 'calculation',
      content: 'Total amount includes tax and shipping',
      customerId: CID,
    },
    expectedFields: ['ruleId'],
    qualityChecks: [
      { name: 'rule-id-present', fn: nonEmptyCheck(['ruleId']) },
    ],
    category: 'mutation',
    difficulty: 'intermediate',
  },
];
