/**
 * Benchmark Framework — Core Runner
 *
 * Executes benchmark scenarios against MCP agents, measuring latency,
 * completeness, consistency, correctness, and response quality.
 *
 * All agents use InMemory stubs — no external services required.
 */

import type { BenchmarkScenario, BenchmarkResult, BenchmarkRunOptions } from './types.js';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_RUNS = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Run a single scenario once against the given MCP server.
 * Returns a raw result with latency, field completeness, and error info.
 */
async function executeSingleRun(
  server: { callTool: (name: string, args: Record<string, unknown>) => Promise<any> },
  scenario: BenchmarkScenario,
  timeoutMs: number,
): Promise<{ latencyMs: number; response: any; success: boolean; error?: string; responseSize: number }> {
  const start = performance.now();

  try {
    const result = await Promise.race([
      server.callTool(scenario.tool, scenario.input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

    const latencyMs = performance.now() - start;

    if (result.isError) {
      const text = result.content?.[0]?.text ?? '';
      return {
        latencyMs,
        response: null,
        success: false,
        error: `Tool returned isError: ${text.slice(0, 200)}`,
        responseSize: text.length,
      };
    }

    const text = result.content?.[0]?.text ?? '';
    if (!text || text.length <= 2) {
      return {
        latencyMs,
        response: null,
        success: false,
        error: 'Empty or trivial response',
        responseSize: text.length,
      };
    }

    const parsed = JSON.parse(text);
    return {
      latencyMs,
      response: parsed,
      success: true,
      responseSize: text.length,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    return {
      latencyMs,
      response: null,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      responseSize: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Field completeness
// ---------------------------------------------------------------------------

/**
 * Calculate what fraction of `expectedFields` exist (and are non-empty) in the response.
 * Supports dot-notation for nested fields (e.g. "sla.id").
 * Supports array access via `[]` suffix (e.g. "results[]" means response.results is a non-empty array).
 */
function measureCompleteness(response: any, expectedFields: string[]): number {
  if (!response || expectedFields.length === 0) return 0;

  let present = 0;

  for (const field of expectedFields) {
    const isArray = field.endsWith('[]');
    const path = isArray ? field.slice(0, -2) : field;
    const parts = path.split('.');

    let cursor: any = response;
    let found = true;

    for (const part of parts) {
      if (cursor == null || typeof cursor !== 'object') {
        found = false;
        break;
      }
      cursor = cursor[part];
    }

    if (!found || cursor === undefined || cursor === null) continue;

    if (isArray) {
      if (Array.isArray(cursor) && cursor.length > 0) present++;
    } else if (typeof cursor === 'string') {
      if (cursor.length > 0) present++;
    } else {
      present++; // numbers, booleans, objects, non-empty arrays
    }
  }

  return expectedFields.length > 0 ? present / expectedFields.length : 1;
}

// ---------------------------------------------------------------------------
// Quality checks
// ---------------------------------------------------------------------------

export type QualityCheckFn = (response: any) => { passed: boolean; message: string };

/**
 * Built-in quality check: all specified fields are non-empty (not null, undefined, or "").
 */
export function nonEmptyCheck(fields: string[]): QualityCheckFn {
  return (response: any) => {
    const empty: string[] = [];
    for (const f of fields) {
      const val = getNestedValue(response, f);
      if (val === null || val === undefined || val === '') {
        empty.push(f);
      }
    }
    return {
      passed: empty.length === 0,
      message: empty.length === 0 ? 'All fields non-empty' : `Empty fields: ${empty.join(', ')}`,
    };
  };
}

/**
 * Built-in quality check: specified fields have expected types.
 */
export function typeCheck(fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>): QualityCheckFn {
  return (response: any) => {
    const mismatches: string[] = [];
    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      const val = getNestedValue(response, field);
      if (val === undefined || val === null) {
        mismatches.push(`${field}: expected ${expectedType}, got ${val}`);
        continue;
      }
      if (expectedType === 'array') {
        if (!Array.isArray(val)) mismatches.push(`${field}: expected array, got ${typeof val}`);
      } else if (typeof val !== expectedType) {
        mismatches.push(`${field}: expected ${expectedType}, got ${typeof val}`);
      }
    }
    return {
      passed: mismatches.length === 0,
      message: mismatches.length === 0 ? 'All types match' : `Type mismatches: ${mismatches.join('; ')}`,
    };
  };
}

/**
 * Built-in quality check: numeric fields are within a specified range.
 */
export function rangeCheck(fieldRanges: Record<string, { min?: number; max?: number }>): QualityCheckFn {
  return (response: any) => {
    const outOfRange: string[] = [];
    for (const [field, range] of Object.entries(fieldRanges)) {
      const val = getNestedValue(response, field);
      if (typeof val !== 'number') {
        outOfRange.push(`${field}: not a number (${typeof val})`);
        continue;
      }
      if (range.min !== undefined && val < range.min) {
        outOfRange.push(`${field}: ${val} < ${range.min}`);
      }
      if (range.max !== undefined && val > range.max) {
        outOfRange.push(`${field}: ${val} > ${range.max}`);
      }
    }
    return {
      passed: outOfRange.length === 0,
      message: outOfRange.length === 0 ? 'All values in range' : `Out of range: ${outOfRange.join('; ')}`,
    };
  };
}

/**
 * Built-in quality check: response matches expected regex patterns.
 */
export function patternCheck(field: string, patterns: RegExp[]): QualityCheckFn {
  return (response: any) => {
    const val = getNestedValue(response, field);
    const valStr = typeof val === 'string' ? val : JSON.stringify(val);
    const failed = patterns.filter((p) => !p.test(valStr));
    return {
      passed: failed.length === 0,
      message: failed.length === 0 ? 'All patterns match' : `${failed.length} pattern(s) did not match`,
    };
  };
}

// ---------------------------------------------------------------------------
// Consistency measurement
// ---------------------------------------------------------------------------

/**
 * Compare multiple run responses to compute a consistency score (0-1).
 * Uses a deterministic JSON key comparison — if the same fields are present
 * with similar structure across runs, consistency is high.
 */
function measureConsistency(responses: any[]): number {
  const valid = responses.filter((r) => r !== null);
  if (valid.length <= 1) return valid.length === 1 ? 1 : 0;

  // Compare the set of top-level keys across runs
  const keySets = valid.map((r) => {
    if (typeof r !== 'object' || Array.isArray(r)) {
      return JSON.stringify(typeof r);
    }
    return Object.keys(r).sort().join(',');
  });

  const baseline = keySets[0];
  const matching = keySets.filter((ks) => ks === baseline).length;

  // Also compare value types for consistency
  const typeSignatures = valid.map((r) => {
    if (typeof r !== 'object' || r === null) return typeof r;
    return Object.entries(r)
      .map(([k, v]) => `${k}:${Array.isArray(v) ? 'array' : typeof v}`)
      .sort()
      .join(',');
  });

  const baselineType = typeSignatures[0];
  const typeMatching = typeSignatures.filter((ts) => ts === baselineType).length;

  const keyConsistency = matching / keySets.length;
  const typeConsistency = typeMatching / typeSignatures.length;

  return (keyConsistency + typeConsistency) / 2;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let cursor = obj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ServerMap {
  [agentName: string]: { callTool: (name: string, args: Record<string, unknown>) => Promise<any> };
}

/**
 * Run all benchmark scenarios against the provided servers.
 */
export async function runBenchmarks(
  scenarios: BenchmarkScenario[],
  servers: ServerMap,
  options: BenchmarkRunOptions = {},
): Promise<BenchmarkResult[]> {
  const runs = options.runs ?? DEFAULT_RUNS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const results: BenchmarkResult[] = [];

  for (const scenario of scenarios) {
    const server = servers[scenario.agent];
    if (!server) {
      results.push({
        scenario: scenario.name,
        agent: scenario.agent,
        tool: scenario.tool,
        category: scenario.category,
        difficulty: scenario.difficulty,
        latencyMs: 0,
        latencyP50Ms: 0,
        latencyP95Ms: 0,
        success: false,
        completeness: 0,
        consistency: 0,
        responseSize: 0,
        qualityChecks: [],
        error: `No server registered for agent '${scenario.agent}'`,
      });
      continue;
    }

    // Execute multiple runs for consistency
    const runResults: Awaited<ReturnType<typeof executeSingleRun>>[] = [];

    for (let i = 0; i < runs; i++) {
      const runResult = await executeSingleRun(server, scenario, timeoutMs);
      runResults.push(runResult);
    }

    // Aggregate results
    const latencies = runResults.map((r) => r.latencyMs).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((s, v) => s + v, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1];

    const successCount = runResults.filter((r) => r.success).length;
    const allSucceeded = successCount === runs;

    // Use the first successful response for completeness/quality checks
    const firstSuccess = runResults.find((r) => r.success);
    const response = firstSuccess?.response ?? null;

    const completeness = response ? measureCompleteness(response, scenario.expectedFields) : 0;
    const consistency = measureConsistency(runResults.map((r) => r.response));

    // Run quality checks
    const qualityResults: { name: string; passed: boolean; message: string }[] = [];

    if (response && scenario.qualityChecks) {
      for (const check of scenario.qualityChecks) {
        const result = check.fn(response);
        qualityResults.push({ name: check.name, ...result });
      }
    }

    // Pattern checks
    if (response && scenario.expectedPatterns) {
      for (const pattern of scenario.expectedPatterns) {
        const responseStr = JSON.stringify(response);
        const passed = pattern.test(responseStr);
        qualityResults.push({
          name: `pattern:${pattern.source.slice(0, 40)}`,
          passed,
          message: passed ? 'Pattern matched' : 'Pattern did not match',
        });
      }
    }

    const avgResponseSize = runResults.reduce((s, r) => s + r.responseSize, 0) / runs;
    const firstError = runResults.find((r) => r.error)?.error;

    results.push({
      scenario: scenario.name,
      agent: scenario.agent,
      tool: scenario.tool,
      category: scenario.category,
      difficulty: scenario.difficulty,
      latencyMs: Math.round(avgLatency * 100) / 100,
      latencyP50Ms: Math.round(p50 * 100) / 100,
      latencyP95Ms: Math.round(p95 * 100) / 100,
      success: allSucceeded,
      completeness: Math.round(completeness * 1000) / 1000,
      consistency: Math.round(consistency * 1000) / 1000,
      responseSize: Math.round(avgResponseSize),
      qualityChecks: qualityResults,
      error: allSucceeded ? undefined : firstError,
    });
  }

  return results;
}
