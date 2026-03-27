/**
 * Eval Framework — Product Quality Dimension
 *
 * Measures: response structure, error messages, input validation, latency, documentation match.
 * Each evaluator returns a 0-1 rate that gets scaled to its rubric point allocation.
 */

import type { MCPServer, RawToolResult, DimensionScore, SubScore } from '../types.js';
import { PRODUCT_QUALITY_WEIGHTS, scoreLatency } from '../scoring/rubrics.js';
import { buildDimensionScore, makeSubScore } from '../scoring/aggregator.js';
import { getToolArgs } from '../config.js';

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
// Response structure (0-1): valid JSON? consistent casing? no junk values?
// ---------------------------------------------------------------------------

export function measureResponseStructure(result: RawToolResult): number {
  const { text, parsed, isError } = parseResultText(result);
  if (isError || !parsed) return 0;

  let checks = 0;
  let passed = 0;

  // Check 1: Valid JSON
  checks++;
  if (parsed !== null) passed++;

  // Check 2: Consistent camelCase or snake_case keys (not mixed)
  checks++;
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed);
    const camelCount = keys.filter((k) => /^[a-z][a-zA-Z0-9]*$/.test(k)).length;
    const snakeCount = keys.filter((k) => /^[a-z][a-z0-9_]*$/.test(k)).length;
    // Allow either convention as long as it's mostly consistent
    if (keys.length === 0 || camelCount >= keys.length * 0.7 || snakeCount >= keys.length * 0.7) {
      passed++;
    }
  } else {
    passed++; // Arrays and primitives don't need key checks
  }

  // Check 3: No undefined/NaN/null string leaks in JSON text
  checks++;
  const hasJunk = /\bundefined\b|\bNaN\b|"null"/.test(text);
  if (!hasJunk) passed++;

  // Check 4: Response is not trivially empty
  checks++;
  if (text.length > 5) passed++;

  // Check 5: No raw stack traces in response
  checks++;
  const hasStackTrace = /at\s+\w+\s*\(/.test(text) || /Error:.*\n\s+at/.test(text);
  if (!hasStackTrace) passed++;

  return passed / checks;
}

// ---------------------------------------------------------------------------
// Error messages (0-1): quality of error responses
// ---------------------------------------------------------------------------

export function measureErrorMessages(errorResult: RawToolResult): number {
  const text = errorResult.content?.[0]?.text ?? '';
  if (!text) return 0;

  let points = 0;
  const maxPoints = 5;

  // 1. Has an error code or error type identifier
  if (/error[_\s]?code|errorType|error_type|"code"/i.test(text)) points++;

  // 2. Identifies the problem clearly
  if (text.length > 20 && text.length < 5000) points++;

  // 3. Suggests a fix or action (e.g., "please provide", "try", "ensure", "required")
  if (/please|try|ensure|required|must|should|expected|provide|specify|check/i.test(text)) points++;

  // 4. Includes context (mentions field name, tool name, or parameter)
  if (/param|field|input|argument|property|column|table|dataset/i.test(text)) points++;

  // 5. Is structured (parseable as JSON)
  try {
    JSON.parse(text);
    points++;
  } catch {
    // Not JSON — could still be a decent error message
  }

  return points / maxPoints;
}

// ---------------------------------------------------------------------------
// Input validation (0-1): fraction of bad-input calls that produce structured errors
// ---------------------------------------------------------------------------

export async function measureInputValidation(
  agent: string,
  tool: string,
  server: MCPServer,
): Promise<number> {
  const testCases: Array<{ label: string; args: Record<string, unknown> }> = [
    { label: 'missing-params', args: {} },
    { label: 'wrong-types', args: { customerId: 99999, query: false } },
    { label: 'extra-params', args: { ...getToolArgs(tool, agent), __extraField: 'unexpected', _debug: true } },
  ];

  let structuredErrorCount = 0;

  for (const { args } of testCases) {
    try {
      const result = await server.callTool(tool, args);

      if (result.isError) {
        // Got an error response — check if it's structured
        const text = result.content?.[0]?.text ?? '';
        if (text.length > 5 && text.length < 5000) {
          structuredErrorCount++;
        }
      } else {
        // Tool handled gracefully without error (still okay for extra params case)
        structuredErrorCount++;
      }
    } catch {
      // Unhandled exception — no points
    }
  }

  return structuredErrorCount / testCases.length;
}

// ---------------------------------------------------------------------------
// Latency (points out of 20): based on P95 latency
// ---------------------------------------------------------------------------

export async function measureLatency(
  agent: string,
  tool: string,
  server: MCPServer,
  runs: number = 3,
): Promise<{ p95Ms: number; points: number }> {
  const args = getToolArgs(tool, agent);
  const latencies: number[] = [];

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    try {
      await server.callTool(tool, args);
    } catch {
      // Include failed calls in latency measurement
    }
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p95Index = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1);
  const p95Ms = latencies[p95Index];

  return {
    p95Ms: Math.round(p95Ms * 100) / 100,
    points: scoreLatency(p95Ms),
  };
}

// ---------------------------------------------------------------------------
// Documentation match (0-1): does the tool do what its description says?
// ---------------------------------------------------------------------------

export function measureDocumentationMatch(
  toolDescription: string | undefined,
  result: RawToolResult,
): number {
  if (!toolDescription) return 0;

  const { parsed, isError } = parseResultText(result);
  if (isError) return 0;

  let score = 0;
  const maxChecks = 4;

  // 1. Tool has a description at all
  if (toolDescription.length > 10) score++;

  // 2. Response is not empty (tool did something)
  if (parsed !== null && parsed !== undefined) score++;

  // 3. Description mentions keywords that appear in response
  const descWords = toolDescription.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const responseText = JSON.stringify(parsed ?? '').toLowerCase();
  const matchingWords = descWords.filter((w) => responseText.includes(w));
  if (matchingWords.length > 0) score++;

  // 4. If description says "list" or "search", response should have an array
  const isList = /list|search|find|get.*all/i.test(toolDescription);
  if (isList) {
    const hasArray = Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null &&
      Object.values(parsed).some((v) => Array.isArray(v)));
    if (hasArray) score++;
  } else {
    score++; // Non-list tools get this point by default
  }

  return score / maxChecks;
}

// ---------------------------------------------------------------------------
// Full Product Quality dimension evaluator
// ---------------------------------------------------------------------------

export async function evaluateProductQuality(
  agent: string,
  tool: string,
  server: MCPServer,
  toolDescription?: string,
  runs: number = 3,
): Promise<DimensionScore> {
  const args = getToolArgs(tool, agent);
  const evidence: string[] = [];

  // 1. Get a normal result for structure/doc checks
  let normalResult: RawToolResult;
  try {
    normalResult = await server.callTool(tool, args);
  } catch (err: any) {
    normalResult = { isError: true, content: [{ type: 'text', text: err.message ?? String(err) }] };
  }

  // 2. Get an error result for error message quality
  let errorResult: RawToolResult;
  try {
    errorResult = await server.callTool(tool, {});
  } catch (err: any) {
    errorResult = { isError: true, content: [{ type: 'text', text: err.message ?? String(err) }] };
  }

  // 3. Response structure
  const structureRate = measureResponseStructure(normalResult);
  const structureScore = structureRate * PRODUCT_QUALITY_WEIGHTS.responseStructure;
  evidence.push(`Response structure: ${(structureRate * 100).toFixed(1)}%`);

  // 4. Error messages
  const errorMsgRate = measureErrorMessages(errorResult);
  const errorMsgScore = errorMsgRate * PRODUCT_QUALITY_WEIGHTS.errorMessages;
  evidence.push(`Error message quality: ${(errorMsgRate * 100).toFixed(1)}%`);

  // 5. Input validation
  const validationRate = await measureInputValidation(agent, tool, server);
  const validationScore = validationRate * PRODUCT_QUALITY_WEIGHTS.inputValidation;
  evidence.push(`Input validation: ${(validationRate * 100).toFixed(1)}%`);

  // 6. Latency
  const { p95Ms, points: latencyPoints } = await measureLatency(agent, tool, server, runs);
  evidence.push(`P95 latency: ${p95Ms.toFixed(0)}ms (${latencyPoints}/${PRODUCT_QUALITY_WEIGHTS.latency} pts)`);

  // 7. Documentation match
  const docMatchRate = measureDocumentationMatch(toolDescription, normalResult);
  const docMatchScore = docMatchRate * PRODUCT_QUALITY_WEIGHTS.documentationMatch;
  evidence.push(`Documentation match: ${(docMatchRate * 100).toFixed(1)}%`);

  const subscores: SubScore[] = [
    makeSubScore('responseStructure', structureScore, PRODUCT_QUALITY_WEIGHTS.responseStructure,
      PRODUCT_QUALITY_WEIGHTS.responseStructure * 0.7, `Rate: ${(structureRate * 100).toFixed(1)}%`),
    makeSubScore('errorMessages', errorMsgScore, PRODUCT_QUALITY_WEIGHTS.errorMessages,
      PRODUCT_QUALITY_WEIGHTS.errorMessages * 0.7, `Rate: ${(errorMsgRate * 100).toFixed(1)}%`),
    makeSubScore('inputValidation', validationScore, PRODUCT_QUALITY_WEIGHTS.inputValidation,
      PRODUCT_QUALITY_WEIGHTS.inputValidation * 0.7, `Rate: ${(validationRate * 100).toFixed(1)}%`),
    makeSubScore('latency', latencyPoints, PRODUCT_QUALITY_WEIGHTS.latency,
      PRODUCT_QUALITY_WEIGHTS.latency * 0.5, `P95: ${p95Ms.toFixed(0)}ms`),
    makeSubScore('documentationMatch', docMatchScore, PRODUCT_QUALITY_WEIGHTS.documentationMatch,
      PRODUCT_QUALITY_WEIGHTS.documentationMatch * 0.7, `Rate: ${(docMatchRate * 100).toFixed(1)}%`),
  ];

  return buildDimensionScore('product-quality', subscores, evidence);
}
