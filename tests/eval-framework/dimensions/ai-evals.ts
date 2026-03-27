/**
 * Eval Framework — AI Evals Dimension
 *
 * Measures: hallucination, correctness, consistency, error handling, schema compliance.
 * Each evaluator returns a 0-1 rate that gets scaled to its rubric point allocation.
 */

import type { MCPServer, RawToolResult, DimensionScore, SubScore } from '../types.js';
import { AI_EVALS_WEIGHTS } from '../scoring/rubrics.js';
import { buildDimensionScore, makeSubScore } from '../scoring/aggregator.js';
import { getToolArgs } from '../config.js';

// ---------------------------------------------------------------------------
// Known seed data values — used for hallucination detection
// ---------------------------------------------------------------------------

const KNOWN_TABLE_NAMES = new Set([
  'fact_orders', 'dim_customers', 'stg_orders', 'orders', 'daily_sales',
  'analytics', 'public', 'raw_events', 'products', 'customers',
]);

const KNOWN_IDS = new Set([
  'test-customer-1', 'cust-1', 'inc-001', 'mig-001', 'chg-001',
  'fact_orders', 'src-raw-orders', 'stg-orders', 'user-1',
  'ds-churn', 'exp-001', 'model-001',
]);

const KNOWN_METRICS = new Set([
  'row_count', 'null_rate', 'revenue', 'completeness', 'freshness',
  'freshness_hours', 'total_charges', 'monthly_charges',
]);

// ---------------------------------------------------------------------------
// Helper: parse tool result text
// ---------------------------------------------------------------------------

function parseResultText(result: RawToolResult): { text: string; parsed: any; isError: boolean } {
  if (result.isError) {
    const text = result.content?.[0]?.text ?? '';
    return { text, parsed: null, isError: true };
  }
  const text = result.content?.[0]?.text ?? '';
  if (!text) return { text: '', parsed: null, isError: false };
  try {
    return { text, parsed: JSON.parse(text), isError: false };
  } catch {
    return { text, parsed: null, isError: false };
  }
}

// ---------------------------------------------------------------------------
// Hallucination rate (0-1): fraction of entities that look fabricated
// ---------------------------------------------------------------------------

export function measureHallucinationRate(
  _agent: string,
  _tool: string,
  result: RawToolResult,
): number {
  const { parsed } = parseResultText(result);
  if (!parsed || typeof parsed !== 'object') return 0;

  const text = JSON.stringify(parsed);
  let totalEntities = 0;
  let suspiciousEntities = 0;

  // Extract strings that look like identifiers from the response
  const idPatterns = text.match(/"[a-z_]+(?:_[a-z]+)+"/g) ?? [];
  const tablePatterns = text.match(/"[a-z_]+(?:_[a-z]+)*"/g) ?? [];
  const candidateSet = new Set([...idPatterns, ...tablePatterns]);
  const candidates = Array.from(candidateSet);

  for (const raw of candidates) {
    const val = raw.replace(/"/g, '');
    // Skip very short values or common JSON keys
    if (val.length < 3) continue;
    if (['true', 'false', 'null', 'string', 'number', 'object', 'array'].includes(val)) continue;

    // Check if the value looks like a table name or ID
    if (val.includes('_') && val.length > 5) {
      totalEntities++;
      // If it's not in our known seed data, flag as potentially hallucinated
      if (!KNOWN_TABLE_NAMES.has(val) && !KNOWN_IDS.has(val) && !KNOWN_METRICS.has(val)) {
        // Allow values that are clearly descriptive or structural
        if (!val.startsWith('dw_') && !val.startsWith('test_') && !val.includes('status') && !val.includes('type')) {
          suspiciousEntities++;
        }
      }
    }
  }

  if (totalEntities === 0) return 0; // No entities to hallucinate about
  return suspiciousEntities / totalEntities;
}

// ---------------------------------------------------------------------------
// Consistency (0-1): structural similarity across N runs
// ---------------------------------------------------------------------------

export function measureConsistency(results: RawToolResult[]): number {
  const parsed = results.map((r) => parseResultText(r));
  const valid = parsed.filter((r) => !r.isError && r.parsed !== null);

  if (valid.length <= 1) return valid.length === 1 ? 1 : 0;

  // Compare top-level keys across runs
  const keySets = valid.map((r) => {
    if (typeof r.parsed !== 'object' || Array.isArray(r.parsed)) {
      return JSON.stringify(typeof r.parsed);
    }
    return Object.keys(r.parsed).sort().join(',');
  });

  const baseline = keySets[0];
  const keyMatch = keySets.filter((ks) => ks === baseline).length / keySets.length;

  // Compare value types
  const typeSignatures = valid.map((r) => {
    if (typeof r.parsed !== 'object' || r.parsed === null) return typeof r.parsed;
    return Object.entries(r.parsed)
      .map(([k, v]) => `${k}:${Array.isArray(v) ? 'array' : typeof v}`)
      .sort()
      .join(',');
  });

  const baselineType = typeSignatures[0];
  const typeMatch = typeSignatures.filter((ts) => ts === baselineType).length / typeSignatures.length;

  // Compare deterministic values (numbers, booleans that should be stable)
  let detMatch = 1;
  if (valid.length >= 2 && typeof valid[0].parsed === 'object' && !Array.isArray(valid[0].parsed)) {
    const baseKeys = Object.keys(valid[0].parsed);
    let stableCount = 0;
    let totalComparisons = 0;

    for (const key of baseKeys) {
      const baseVal = valid[0].parsed[key];
      if (typeof baseVal === 'number' || typeof baseVal === 'boolean' || typeof baseVal === 'string') {
        totalComparisons++;
        const allMatch = valid.every((v) => v.parsed?.[key] === baseVal);
        if (allMatch) stableCount++;
      }
    }
    if (totalComparisons > 0) {
      detMatch = stableCount / totalComparisons;
    }
  }

  return (keyMatch + typeMatch + detMatch) / 3;
}

// ---------------------------------------------------------------------------
// Schema compliance (0-1): check response has expected fields with correct types
// ---------------------------------------------------------------------------

export function measureSchemaCompliance(
  result: RawToolResult,
  expectedFields: string[],
): number {
  const { parsed } = parseResultText(result);
  if (!parsed || typeof parsed !== 'object' || expectedFields.length === 0) return 0;

  let present = 0;
  for (const field of expectedFields) {
    const parts = field.split('.');
    let cursor: any = parsed;
    let found = true;

    for (const part of parts) {
      if (cursor == null || typeof cursor !== 'object') {
        found = false;
        break;
      }
      cursor = cursor[part];
    }

    if (found && cursor !== undefined && cursor !== null) {
      present++;
    }
  }

  return present / expectedFields.length;
}

// ---------------------------------------------------------------------------
// Error handling (0-1): call with bad inputs, check for graceful errors
// ---------------------------------------------------------------------------

export async function measureErrorHandling(
  agent: string,
  tool: string,
  server: MCPServer,
): Promise<number> {
  const badInputs: Array<{ label: string; args: Record<string, unknown> }> = [
    { label: 'empty-input', args: {} },
    { label: 'wrong-types', args: { customerId: 12345, query: true, datasetId: null } },
    { label: 'missing-required', args: { irrelevantField: 'hello' } },
  ];

  let gracefulCount = 0;

  for (const { args } of badInputs) {
    try {
      const result = await server.callTool(tool, args);

      // A graceful error response: isError flag set with structured message
      if (result.isError) {
        const text = result.content?.[0]?.text ?? '';
        // Check the error is structured (not just a raw stack trace)
        if (text.length > 0 && text.length < 2000) {
          gracefulCount++;
        }
      } else {
        // Tool handled bad input without crashing — also acceptable
        gracefulCount++;
      }
    } catch {
      // Unhandled exception = not graceful
    }
  }

  return gracefulCount / badInputs.length;
}

// ---------------------------------------------------------------------------
// Edge case testing: boundary conditions
// ---------------------------------------------------------------------------

export interface EdgeCaseResult {
  label: string;
  passed: boolean;
  detail: string;
}

export async function measureEdgeCases(
  agent: string,
  tool: string,
  server: MCPServer,
): Promise<EdgeCaseResult[]> {
  const cases: EdgeCaseResult[] = [];

  // Case 1: Very long string input
  const longString = 'a'.repeat(10_000);
  try {
    const result = await server.callTool(tool, { query: longString, customerId: 'test-customer-1' });
    cases.push({
      label: 'long-string-input',
      passed: !!(result && !result.isError) || !!(result?.isError && result.content?.[0]?.text),
      detail: result?.isError ? 'Graceful error on long input' : 'Handled long input',
    });
  } catch (err: any) {
    cases.push({ label: 'long-string-input', passed: false, detail: `Crashed: ${err.message?.slice(0, 80)}` });
  }

  // Case 2: Special characters
  try {
    const result = await server.callTool(tool, { query: '<script>alert("xss")</script>', customerId: 'test-customer-1' });
    cases.push({
      label: 'special-chars',
      passed: !!(result && !result.isError) || !!(result?.isError && result.content?.[0]?.text),
      detail: result?.isError ? 'Graceful error on special chars' : 'Handled special chars',
    });
  } catch (err: any) {
    cases.push({ label: 'special-chars', passed: false, detail: `Crashed: ${err.message?.slice(0, 80)}` });
  }

  // Case 3: Unicode input
  try {
    const result = await server.callTool(tool, { query: 'orders \u00e9\u00e0\u00fc \ud83d\ude80', customerId: 'test-customer-1' });
    cases.push({
      label: 'unicode-input',
      passed: !!(result && !result.isError) || !!(result?.isError && result.content?.[0]?.text),
      detail: result?.isError ? 'Graceful error on unicode' : 'Handled unicode',
    });
  } catch (err: any) {
    cases.push({ label: 'unicode-input', passed: false, detail: `Crashed: ${err.message?.slice(0, 80)}` });
  }

  return cases;
}

// ---------------------------------------------------------------------------
// Correctness (0-1): does the tool return a meaningful, non-empty result?
// ---------------------------------------------------------------------------

export function measureCorrectness(result: RawToolResult): number {
  const { parsed, isError } = parseResultText(result);
  if (isError) return 0;
  if (!parsed) return 0;

  let score = 0;

  // Has content at all
  if (parsed !== null && parsed !== undefined) score += 0.25;

  // Is structured (object or array)
  if (typeof parsed === 'object') score += 0.25;

  // Has non-trivial content
  const text = JSON.stringify(parsed);
  if (text.length > 10) score += 0.25;

  // Has multiple keys or array items (not just a wrapper)
  if (Array.isArray(parsed)) {
    if (parsed.length > 0) score += 0.25;
  } else if (typeof parsed === 'object') {
    if (Object.keys(parsed).length >= 2) score += 0.25;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Full AI Evals dimension evaluator
// ---------------------------------------------------------------------------

export async function evaluateAIEvals(
  agent: string,
  tool: string,
  server: MCPServer,
  runs: number = 3,
): Promise<DimensionScore> {
  const args = getToolArgs(tool, agent);
  const evidence: string[] = [];

  // 1. Collect multiple runs for consistency
  const results: RawToolResult[] = [];
  for (let i = 0; i < runs; i++) {
    try {
      const result = await server.callTool(tool, args);
      results.push(result);
    } catch (err: any) {
      results.push({ isError: true, content: [{ type: 'text', text: err.message ?? String(err) }] });
    }
  }

  const firstResult = results[0];

  // 2. Hallucination
  const hallRate = measureHallucinationRate(agent, tool, firstResult);
  const hallScore = (1 - hallRate) * AI_EVALS_WEIGHTS.hallucination;
  evidence.push(`Hallucination rate: ${(hallRate * 100).toFixed(1)}%`);

  // 3. Correctness
  const correctness = measureCorrectness(firstResult);
  const correctScore = correctness * AI_EVALS_WEIGHTS.correctness;
  evidence.push(`Correctness: ${(correctness * 100).toFixed(1)}%`);

  // 4. Consistency
  const consistency = measureConsistency(results);
  const consistScore = consistency * AI_EVALS_WEIGHTS.consistency;
  evidence.push(`Consistency across ${runs} runs: ${(consistency * 100).toFixed(1)}%`);

  // 5. Error handling
  const errorHandling = await measureErrorHandling(agent, tool, server);
  const errorScore = errorHandling * AI_EVALS_WEIGHTS.errorHandling;
  evidence.push(`Error handling: ${(errorHandling * 100).toFixed(1)}%`);

  // 6. Schema compliance (check for common expected fields)
  const commonFields = ['status', 'data', 'result', 'results', 'id', 'name', 'message'];
  const schemaComp = measureSchemaCompliance(firstResult, commonFields);
  const schemaScore = schemaComp * AI_EVALS_WEIGHTS.schemaCompliance;
  evidence.push(`Schema compliance: ${(schemaComp * 100).toFixed(1)}%`);

  const subscores: SubScore[] = [
    makeSubScore('hallucination', hallScore, AI_EVALS_WEIGHTS.hallucination, AI_EVALS_WEIGHTS.hallucination * 0.7, `Rate: ${(hallRate * 100).toFixed(1)}%`),
    makeSubScore('correctness', correctScore, AI_EVALS_WEIGHTS.correctness, AI_EVALS_WEIGHTS.correctness * 0.7, `Score: ${(correctness * 100).toFixed(1)}%`),
    makeSubScore('consistency', consistScore, AI_EVALS_WEIGHTS.consistency, AI_EVALS_WEIGHTS.consistency * 0.7, `Score: ${(consistency * 100).toFixed(1)}%`),
    makeSubScore('errorHandling', errorScore, AI_EVALS_WEIGHTS.errorHandling, AI_EVALS_WEIGHTS.errorHandling * 0.7, `Score: ${(errorHandling * 100).toFixed(1)}%`),
    makeSubScore('schemaCompliance', schemaScore, AI_EVALS_WEIGHTS.schemaCompliance, AI_EVALS_WEIGHTS.schemaCompliance * 0.7, `Score: ${(schemaComp * 100).toFixed(1)}%`),
  ];

  return buildDimensionScore('ai-evals', subscores, evidence);
}
