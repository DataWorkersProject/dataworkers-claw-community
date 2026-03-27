/**
 * Benchmark Framework — Shared Types
 */

import type { QualityCheckFn } from './framework.js';

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

export interface QualityCheck {
  name: string;
  fn: QualityCheckFn;
}

export interface BenchmarkScenario {
  /** Unique scenario name, e.g. "catalog-search-basic" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Agent name, e.g. "dw-context-catalog" */
  agent: string;
  /** MCP tool name, e.g. "search_datasets" */
  tool: string;
  /** Input arguments passed to callTool */
  input: Record<string, unknown>;
  /** Fields that MUST be present in the response (supports dot-notation and [] for arrays) */
  expectedFields: string[];
  /** Regex patterns the JSON response should match */
  expectedPatterns?: RegExp[];
  /** Custom validation functions */
  qualityChecks?: QualityCheck[];
  /** Functional category */
  category: 'search' | 'analysis' | 'generation' | 'mutation' | 'monitoring';
  /** Difficulty level */
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface QualityCheckResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface BenchmarkResult {
  scenario: string;
  agent: string;
  tool: string;
  category: string;
  difficulty: string;
  latencyMs: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  success: boolean;
  completeness: number;   // 0-1: fraction of expectedFields present
  consistency: number;    // 0-1: same structure across repeated runs
  responseSize: number;   // avg bytes
  qualityChecks: QualityCheckResult[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BenchmarkRunOptions {
  /** Number of times to run each scenario (default 3) */
  runs?: number;
  /** Per-tool timeout in ms (default 30000) */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Aggregated metrics
// ---------------------------------------------------------------------------

export interface AgentMetrics {
  agent: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  passRate: number;
  avgLatencyMs: number;
  avgCompleteness: number;
  avgConsistency: number;
  avgResponseSize: number;
  qualityPassRate: number;
}

export interface CategoryMetrics {
  category: string;
  totalScenarios: number;
  passed: number;
  passRate: number;
  avgLatencyMs: number;
  avgCompleteness: number;
}

export interface OverallMetrics {
  timestamp: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  passRate: number;
  avgLatencyMs: number;
  avgCompleteness: number;
  avgConsistency: number;
  byAgent: AgentMetrics[];
  byCategory: CategoryMetrics[];
  byDifficulty: Record<string, { total: number; passed: number; passRate: number }>;
  results: BenchmarkResult[];
}
