/**
 * Persona-based AI Eval Benchmark — Runner
 *
 * Executes persona scenarios against MCP agent servers, collects responses,
 * and runs the scoring functions on each result.
 *
 * Iteration 3 additions:
 *   - Dynamic multi-step execution with output→input chaining
 *   - Latency compliance scoring
 *   - Handoff success tracking for multi-step scenarios
 *
 * Import pattern matches tests/e2e/agent-report-card.test.ts — all servers
 * are in-memory stubs with no external dependencies.
 */

import type { PersonaScenario, PersonaResult, PersonaScore, SeedDataset, MultiStepRoute } from './types.js';
import { SEED_ENTITIES } from './seed-configs.js';
import {
  scoreCompleteness,
  scoreFactualGrounding,
  scoreActionability,
  scoreSeedSpecificity,
  scoreNegativeHandling,
  scoreResponseStructure,
  scoreLatencyCompliance,
  computeComposite,
} from './scoring.js';

// ─── MCP Agent Servers ──────────────────────────────────────────────────────
// Same import pattern as tests/e2e/agent-report-card.test.ts

import { server as pipelinesServer } from '../../../agents/dw-pipelines/src/index.js';
import { server as incidentsServer } from '../../../agents/dw-incidents/src/index.js';
import { server as catalogServer } from '../../../agents/dw-context-catalog/src/index.js';
import { server as schemaServer } from '../../../agents/dw-schema/src/index.js';
import { server as qualityServer } from '../../../agents/dw-quality/src/index.js';
import { server as governanceServer } from '../../../agents/dw-governance/src/index.js';
import { server as usageIntelServer } from '../../../agents/dw-usage-intelligence/src/index.js';
import { server as observabilityServer } from '../../../agents/dw-observability/src/index.js';
import { server as connectorsServer } from '../../../agents/dw-connectors/src/index.js';
import { server as mlServer } from '../../../agents/dw-ml/src/index.js';

// ─── Server registry ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SERVER_MAP: Record<string, any> = {
  'dw-pipelines': pipelinesServer,
  'dw-incidents': incidentsServer,
  'dw-context-catalog': catalogServer,
  'dw-schema': schemaServer,
  'dw-quality': qualityServer,
  'dw-governance': governanceServer,
  'dw-usage-intelligence': usageIntelServer,
  'dw-observability': observabilityServer,
  'dw-connectors': connectorsServer,
  'dw-ml': mlServer,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse tool response into a usable value.
 * MCP callTool returns { content: [{ type, text }] } — unwrap it.
 */
function parseToolResponse(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw !== 'object') return raw;

  const obj = raw as Record<string, unknown>;

  // MCP response shape: { content: [{ type: 'text', text: '...' }] }
  if (Array.isArray(obj.content)) {
    const texts: string[] = [];
    for (const item of obj.content) {
      if (item && typeof item === 'object' && 'text' in item) {
        texts.push(String((item as Record<string, unknown>).text));
      }
    }
    if (texts.length === 1) {
      // Try to parse as JSON
      try {
        return JSON.parse(texts[0]);
      } catch {
        return texts[0];
      }
    }
    if (texts.length > 1) {
      // Multiple text blocks — try to parse each
      return texts.map((t) => {
        try { return JSON.parse(t); } catch { return t; }
      });
    }
  }

  return raw;
}

/**
 * Get a nested value using dot-notation and array indexing.
 * Supports "results[0].name" and "impactedAssets.length" style paths.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = obj;

  for (const part of parts) {
    if (cursor == null) return undefined;

    // Handle .length
    if (part === 'length' && Array.isArray(cursor)) {
      return cursor.length;
    }

    // Handle array indexing like "results[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      cursor = (cursor as Record<string, unknown>)[arrayMatch[1]];
      if (Array.isArray(cursor)) {
        cursor = cursor[parseInt(arrayMatch[2], 10)];
      } else {
        return undefined;
      }
    } else {
      cursor = (cursor as Record<string, unknown>)[part];
    }
  }

  return cursor;
}

/**
 * Apply a transform expression to a value.
 * Supports simple ${value} interpolation.
 */
function applyTransform(value: unknown, transform: string): unknown {
  if (typeof value !== 'string' && typeof value !== 'number') return value;
  return transform.replace('${value}', String(value));
}

// ─── Multi-Step Dynamic Runner ──────────────────────────────────────────────

interface MultiStepResult {
  response: unknown;
  handoffSuccessCount: number;
  handoffTotalCount: number;
  stepResponses: unknown[];
}

/**
 * Execute multi-step scenarios with dynamic output→input chaining.
 *
 * For each step:
 *   1. Build args from template + dynamic inputs from previous step outputs
 *   2. Call the tool
 *   3. Parse response
 *   4. Extract specified fields for downstream steps
 *   5. Track handoff success (did dynamic input resolve from real data or fallback?)
 */
async function executeMultiSteps(
  multiSteps: MultiStepRoute[],
  servers: Record<string, unknown>,
): Promise<MultiStepResult> {
  const extractedData: Record<string, Record<string, unknown>> = {};
  const stepResponses: unknown[] = [];
  let handoffSuccessCount = 0;
  let handoffTotalCount = 0;

  for (const step of multiSteps) {
    const server = servers[step.agent] as
      | { callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }
      | undefined;

    if (!server) {
      throw new Error(`Unknown agent: ${step.agent}`);
    }

    // Build input: start with static args, then overlay dynamic inputs
    const input: Record<string, unknown> = JSON.parse(JSON.stringify(step.args));

    if (step.dynamicInputs) {
      for (const [targetField, source] of Object.entries(step.dynamicInputs)) {
        handoffTotalCount++;

        const sourceData = extractedData[source.fromStep];
        let value: unknown = sourceData?.[source.field];

        if (value === undefined || value === null) {
          // Fallback — handoff failed
          value = source.fallback;
        } else {
          // Dynamic input resolved from real data — handoff succeeded
          handoffSuccessCount++;
        }

        if (value !== undefined && source.transform) {
          value = applyTransform(value, source.transform);
        }

        // Support nested target fields like "change.table"
        if (targetField.includes('.')) {
          const parts = targetField.split('.');
          let cursor: Record<string, unknown> = input;
          for (let i = 0; i < parts.length - 1; i++) {
            if (cursor[parts[i]] === undefined || typeof cursor[parts[i]] !== 'object') {
              cursor[parts[i]] = {};
            }
            cursor = cursor[parts[i]] as Record<string, unknown>;
          }
          cursor[parts[parts.length - 1]] = value;
        } else {
          input[targetField] = value;
        }
      }
    }

    // Execute tool call
    const raw = await server.callTool(step.tool, input);
    const parsed = parseToolResponse(raw);
    stepResponses.push(parsed);

    // Extract fields for downstream steps
    if (step.extractFields && parsed !== null && typeof parsed === 'object') {
      const extracted: Record<string, unknown> = {};
      for (const [alias, path] of Object.entries(step.extractFields)) {
        extracted[alias] = getNestedValue(parsed, path);
      }
      extractedData[step.id] = extracted;
    }
  }

  // Merge all step responses into a combined object for scoring
  const merged: Record<string, unknown> = {};
  for (const resp of stepResponses) {
    if (resp !== null && typeof resp === 'object' && !Array.isArray(resp)) {
      Object.assign(merged, resp as Record<string, unknown>);
    }
  }
  merged._stepResponses = stepResponses;
  merged._handoffSuccess = handoffTotalCount > 0
    ? handoffSuccessCount / handoffTotalCount
    : 1;

  return {
    response: Object.keys(merged).length > 1 ? merged : stepResponses,
    handoffSuccessCount,
    handoffTotalCount,
    stepResponses,
  };
}

// ─── Runner ─────────────────────────────────────────────────────────────────

/**
 * Run all applicable persona scenarios for a given seed dataset.
 *
 * For each scenario:
 *   1. Resolve the server from the route's agent name
 *   2. For multi-step with multiSteps[]: execute with dynamic chaining
 *      For multi-step with steps[]: execute sequentially (legacy)
 *      For single-tool: call directly
 *   3. Collect responses
 *   4. Run all 8 scoring functions
 *   5. Return PersonaResult[]
 */
export async function runPersonaBenchmark(
  scenarios: PersonaScenario[],
  servers: Record<string, unknown> = SERVER_MAP,
  seed: SeedDataset,
): Promise<PersonaResult[]> {
  const results: PersonaResult[] = [];
  const seedEntities = SEED_ENTITIES[seed];

  for (const scenario of scenarios) {
    // Skip if this seed is not applicable
    if (!scenario.applicableSeeds.includes(seed)) continue;

    const expected = scenario.expectedResponses[seed];
    const startMs = performance.now();
    let response: unknown = null;
    let error: string | undefined;

    try {
      // Determine execution mode
      if (scenario.isMultiStep && scenario.multiSteps && scenario.multiSteps.length > 0) {
        // New dynamic multi-step execution
        const result = await executeMultiSteps(scenario.multiSteps, servers);
        response = result.response;
      } else if (scenario.isMultiStep && scenario.steps && scenario.steps.length > 0) {
        // Legacy multi-step execution (sequential, no chaining)
        const routeResponses: unknown[] = [];

        for (const route of scenario.steps) {
          const server = servers[route.agent] as
            | { callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }
            | undefined;

          if (!server) {
            throw new Error(`Unknown agent: ${route.agent}`);
          }

          const raw = await server.callTool(route.tool, route.args);
          routeResponses.push(parseToolResponse(raw));
        }

        // Merge step responses
        const merged: Record<string, unknown> = {};
        for (const resp of routeResponses) {
          if (resp !== null && typeof resp === 'object' && !Array.isArray(resp)) {
            Object.assign(merged, resp as Record<string, unknown>);
          }
        }
        merged._stepResponses = routeResponses;
        response = Object.keys(merged).length > 1 ? merged : routeResponses;
      } else {
        // Single tool execution
        const routeResponses: unknown[] = [];

        for (const route of scenario.routes) {
          const server = servers[route.agent] as
            | { callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }
            | undefined;

          if (!server) {
            throw new Error(`Unknown agent: ${route.agent}`);
          }

          const raw = await server.callTool(route.tool, route.args);
          routeResponses.push(parseToolResponse(raw));
        }

        if (routeResponses.length === 1) {
          response = routeResponses[0];
        } else {
          const merged: Record<string, unknown> = {};
          for (const resp of routeResponses) {
            if (resp !== null && typeof resp === 'object' && !Array.isArray(resp)) {
              Object.assign(merged, resp as Record<string, unknown>);
            }
          }
          merged._stepResponses = routeResponses;
          response = Object.keys(merged).length > 1 ? merged : routeResponses;
        }
      }
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = Math.round(performance.now() - startMs);

    // ── Scoring ──────────────────────────────────────────────────────────

    // Routing accuracy: in direct mode we're calling the exact tool, so always 1.0
    const routingAccuracy = error ? 0 : 1.0;

    const responseCompleteness = expected
      ? scoreCompleteness(response, expected)
      : (response !== null ? 0.5 : 0);

    const factualGrounding = scoreFactualGrounding(
      response,
      seedEntities,
      expected?.forbiddenEntities,
    );

    const actionability = scoreActionability(response);

    const seedSpecificity = expected
      ? scoreSeedSpecificity(response, expected, seedEntities)
      : 0;

    const negativeHandling = scoreNegativeHandling(response, error, scenario);
    const responseStructure = scoreResponseStructure(response, scenario);
    const latencyCompliance = scoreLatencyCompliance(latencyMs, scenario.maxLatencyMs);

    const partialScores: Omit<PersonaScore, 'composite'> = {
      routingAccuracy,
      responseCompleteness,
      factualGrounding,
      actionability,
      seedSpecificity,
      negativeHandling,
      responseStructure,
      latencyCompliance,
    };

    const composite = computeComposite(partialScores, scenario.difficulty);

    results.push({
      scenario,
      seed,
      response,
      scores: { ...partialScores, composite },
      latencyMs,
      error,
    });
  }

  return results;
}

/**
 * Convenience: get the default server map for use in test files.
 */
export function getDefaultServers(): Record<string, unknown> {
  return { ...SERVER_MAP };
}
