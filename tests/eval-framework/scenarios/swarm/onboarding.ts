/**
 * Eval Framework — Swarm Scenario: New Data Engineer Onboarding
 *
 * Simulates a new data engineer discovering revenue metrics, understanding
 * table structure, checking access policies, and assessing data quality.
 *
 * Flow:
 * 1. search_across_platforms -> find revenue metrics
 * 2. explain_table -> understand the table from step 1
 * 3. check_policy -> verify read access to the table
 * 4. get_quality_score -> assess data quality
 */

import type { SwarmScenario, SwarmStep, SwarmStepResult } from './types.js';

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

export const onboardingScenario: SwarmScenario = {
  name: 'new-engineer-onboarding',
  description: 'New data engineer discovers revenue metrics, understands tables, checks access, and assesses quality',
  steps: [
    {
      id: 'search-revenue',
      agent: 'dw-context-catalog',
      tool: 'search_across_platforms',
      inputTemplate: {
        query: 'revenue metrics',
        customerId: 'test-customer-1',
      },
      extractFields: {
        tableName: 'results[0].name',
        tableId: 'results[0].id',
        assetId: 'results[0].assetId',
      },
      expectedFields: ['results'],
    },
    {
      id: 'explain-table',
      agent: 'dw-context-catalog',
      tool: 'explain_table',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      dynamicInputs: {
        tableIdentifier: { fromStep: 'search-revenue', field: 'tableName', fallback: 'fact_orders' },
      },
      extractFields: {
        tableDescription: 'description',
        columns: 'columns',
      },
      expectedFields: ['description'],
    },
    {
      id: 'check-access',
      agent: 'dw-governance',
      tool: 'check_policy',
      inputTemplate: {
        action: 'read',
        agentId: 'dw-insights',
        customerId: 'test-customer-1',
      },
      dynamicInputs: {
        resource: { fromStep: 'search-revenue', field: 'tableName', fallback: 'table:analytics.public.fact_orders', transform: (v: string) => `table:analytics.public.${v}` },
      },
      extractFields: {
        allowed: 'allowed',
        reason: 'reason',
      },
      expectedFields: ['allowed'],
    },
    {
      id: 'quality-check',
      agent: 'dw-quality',
      tool: 'get_quality_score',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      dynamicInputs: {
        datasetId: { fromStep: 'search-revenue', field: 'tableName', fallback: 'fact_orders' },
      },
      extractFields: {
        qualityScore: 'score',
        dimensions: 'dimensions',
      },
      expectedFields: ['score'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function runOnboardingScenario(
  servers: Record<string, { callTool: (name: string, args: Record<string, unknown>) => Promise<any> }>,
): Promise<{ scenario: string; steps: SwarmStepResult[]; success: boolean; totalLatencyMs: number }> {
  return runSwarmScenario(onboardingScenario, servers);
}

// ---------------------------------------------------------------------------
// Generic swarm runner (shared across scenarios)
// ---------------------------------------------------------------------------

export async function runSwarmScenario(
  scenario: SwarmScenario,
  servers: Record<string, { callTool: (name: string, args: Record<string, unknown>) => Promise<any> }>,
): Promise<{ scenario: string; steps: SwarmStepResult[]; success: boolean; totalLatencyMs: number }> {
  const stepResults: SwarmStepResult[] = [];
  const extractedData: Record<string, Record<string, unknown>> = {};
  let totalLatencyMs = 0;
  let allSucceeded = true;

  for (const step of scenario.steps) {
    const server = servers[step.agent];
    if (!server) {
      stepResults.push({
        stepId: step.id,
        agent: step.agent,
        tool: step.tool,
        success: false,
        latencyMs: 0,
        error: `No server registered for agent '${step.agent}'`,
        handoffSuccess: false,
        output: null,
      });
      allSucceeded = false;
      continue;
    }

    // Build input: start with template, then apply dynamic inputs from previous steps
    const input = { ...step.inputTemplate };

    if (step.dynamicInputs) {
      for (const [targetField, source] of Object.entries(step.dynamicInputs)) {
        const sourceData = extractedData[source.fromStep];
        let value: unknown = sourceData?.[source.field];

        if (value === undefined || value === null) {
          value = source.fallback;
        }

        if (value !== undefined && source.transform) {
          value = source.transform(value as string);
        }

        if (value !== undefined) {
          input[targetField] = value;
        }
      }
    }

    // Execute the tool call
    const start = performance.now();
    let result: any;
    let success = false;
    let error: string | undefined;
    let parsed: any = null;

    try {
      result = await Promise.race([
        server.callTool(step.tool, input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 30000ms')), 30_000),
        ),
      ]);

      if (result.isError) {
        const text = result.content?.[0]?.text ?? '';
        error = `Tool returned error: ${text.slice(0, 200)}`;
      } else {
        const text = result.content?.[0]?.text ?? '';
        if (text && text.length > 2) {
          try {
            parsed = JSON.parse(text);
            success = true;
          } catch {
            error = 'Response is not valid JSON';
          }
        } else {
          error = 'Empty or trivial response';
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = performance.now() - start;
    totalLatencyMs += latencyMs;

    // Extract fields for downstream steps
    if (success && parsed && step.extractFields) {
      const extracted: Record<string, unknown> = {};
      for (const [alias, path] of Object.entries(step.extractFields)) {
        extracted[alias] = getNestedValue(parsed, path);
      }
      extractedData[step.id] = extracted;
    }

    // Check handoff: did we successfully resolve dynamic inputs?
    let handoffSuccess = true;
    if (step.dynamicInputs) {
      for (const [targetField, source] of Object.entries(step.dynamicInputs)) {
        if (input[targetField] === source.fallback) {
          // Had to use fallback — means upstream didn't provide the data
          handoffSuccess = false;
        }
      }
    }

    if (!success) {
      allSucceeded = false;
    }

    stepResults.push({
      stepId: step.id,
      agent: step.agent,
      tool: step.tool,
      success,
      latencyMs: Math.round(latencyMs * 100) / 100,
      error,
      handoffSuccess,
      output: parsed,
    });
  }

  return {
    scenario: scenario.name,
    steps: stepResults,
    success: allSucceeded,
    totalLatencyMs: Math.round(totalLatencyMs * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a nested value using dot-notation and array indexing.
 * Supports "results[0].name" style paths.
 */
function getNestedValue(obj: any, path: string): unknown {
  const parts = path.split('.');
  let cursor: any = obj;

  for (const part of parts) {
    if (cursor == null) return undefined;

    // Handle array indexing like "results[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      cursor = cursor[arrayMatch[1]];
      if (Array.isArray(cursor)) {
        cursor = cursor[parseInt(arrayMatch[2], 10)];
      } else {
        return undefined;
      }
    } else {
      cursor = cursor[part];
    }
  }

  return cursor;
}
