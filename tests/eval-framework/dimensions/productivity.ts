/**
 * Eval Framework — Productivity Dimension
 *
 * Measures how effectively agents complete tasks, reduce manual steps,
 * hand off between each other, and automate end-to-end workflows.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskCompletionResult {
  completed: boolean;
  score: 0 | 1;
  reason: string;
}

export interface StepsSavedResult {
  tool: string;
  manualSteps: number;
  automatedSteps: number;
  ratio: number;
  description: string;
}

export interface HandoffResult {
  compatible: boolean;
  score: 0 | 1;
  matchedFields: string[];
  missingFields: string[];
  transformationsNeeded: { field: string; from: string; to: string }[];
}

export interface AutomationCoverageResult {
  totalSteps: number;
  automatedSteps: number;
  failedSteps: number;
  coverage: number; // 0-1
}

// ---------------------------------------------------------------------------
// Manual-step definitions per tool
// ---------------------------------------------------------------------------

/**
 * For each tool, how many manual steps it replaces and what those steps are.
 * Used by measureStepsSaved to compute the automation ratio.
 */
const MANUAL_STEPS: Record<string, { count: number; steps: string[] }> = {
  generate_pipeline: {
    count: 5,
    steps: ['Write YAML config', 'Configure data sources', 'Add transform steps', 'Set schedule/triggers', 'Validate pipeline spec'],
  },
  validate_pipeline: {
    count: 3,
    steps: ['Review YAML syntax', 'Check source/sink compatibility', 'Verify transform logic'],
  },
  deploy_pipeline: {
    count: 4,
    steps: ['Package pipeline artifact', 'Push to target environment', 'Configure runtime params', 'Run smoke test'],
  },
  diagnose_incident: {
    count: 6,
    steps: ['Collect anomaly signals', 'Query monitoring dashboards', 'Correlate across metrics', 'Identify affected tables', 'Determine severity', 'Draft initial assessment'],
  },
  get_root_cause: {
    count: 4,
    steps: ['Trace upstream dependencies', 'Check recent changes', 'Analyze error patterns', 'Determine root cause'],
  },
  remediate: {
    count: 5,
    steps: ['Identify remediation options', 'Assess risk of each option', 'Select safest action', 'Execute remediation', 'Verify fix'],
  },
  search_across_platforms: {
    count: 4,
    steps: ['Query each catalog individually', 'Normalize result schemas', 'Deduplicate results', 'Rank by relevance'],
  },
  explain_table: {
    count: 3,
    steps: ['Look up table schema', 'Gather usage statistics', 'Write human-readable summary'],
  },
  detect_schema_change: {
    count: 3,
    steps: ['Snapshot current schema', 'Compare with previous snapshot', 'Classify change type'],
  },
  generate_migration: {
    count: 4,
    steps: ['Analyze schema diff', 'Write forward migration SQL', 'Write rollback SQL', 'Validate compatibility'],
  },
  run_quality_check: {
    count: 4,
    steps: ['Define quality rules', 'Execute checks against data', 'Aggregate results', 'Generate report'],
  },
  get_quality_score: {
    count: 3,
    steps: ['Collect quality metrics', 'Weight by importance', 'Compute composite score'],
  },
  check_policy: {
    count: 3,
    steps: ['Look up policy rules', 'Evaluate against request context', 'Return decision with reasoning'],
  },
  generate_audit_report: {
    count: 5,
    steps: ['Collect audit events', 'Filter by scope/period', 'Categorize by type', 'Compute statistics', 'Format report'],
  },
  get_cost_dashboard: {
    count: 4,
    steps: ['Query billing APIs', 'Aggregate by service/resource', 'Compute trends', 'Format dashboard data'],
  },
  find_unused_data: {
    count: 3,
    steps: ['Scan access logs', 'Identify tables with no recent queries', 'Estimate storage cost'],
  },
  estimate_savings: {
    count: 3,
    steps: ['Identify optimization opportunities', 'Calculate potential savings', 'Prioritize recommendations'],
  },
  recommend_archival: {
    count: 3,
    steps: ['Identify cold data', 'Assess archival candidates', 'Generate archival plan'],
  },
  generate_insight: {
    count: 4,
    steps: ['Analyze query results', 'Identify patterns/anomalies', 'Generate natural language summary', 'Suggest next steps'],
  },
  generate_documentation: {
    count: 4,
    steps: ['Gather schema metadata', 'Collect usage context', 'Write documentation', 'Add lineage references'],
  },
  get_tool_usage_metrics: {
    count: 3,
    steps: ['Collect usage telemetry', 'Aggregate by tool/period', 'Compute adoption metrics'],
  },
  check_agent_health: {
    count: 3,
    steps: ['Ping agent endpoints', 'Check error rates', 'Assess overall health status'],
  },
};

// ---------------------------------------------------------------------------
// measureTaskCompletion
// ---------------------------------------------------------------------------

/**
 * Did the tool complete the task end-to-end?
 *
 * Checks:
 * 1. Response has a success-like status (status: 'success', or no isError)
 * 2. Response contains expected output fields (non-empty)
 * 3. Response is a valid non-trivial object
 *
 * @returns 0 (failed) or 1 (completed)
 */
export function measureTaskCompletion(
  _agent: string,
  _tool: string,
  result: { isError?: boolean; content?: Array<{ text?: string }> } | null,
): TaskCompletionResult {
  if (!result) {
    return { completed: false, score: 0, reason: 'No result returned' };
  }

  if (result.isError) {
    const text = result.content?.[0]?.text ?? '';
    return { completed: false, score: 0, reason: `Tool returned error: ${text.slice(0, 100)}` };
  }

  const text = result.content?.[0]?.text ?? '';
  if (!text || text.length <= 2) {
    return { completed: false, score: 0, reason: 'Empty or trivial response' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { completed: false, score: 0, reason: 'Response is not valid JSON' };
  }

  // Check for explicit failure status
  if (parsed.status === 'error' || parsed.status === 'failed' || parsed.error) {
    return { completed: false, score: 0, reason: `Response indicates failure: ${parsed.error || parsed.status}` };
  }

  // Check that response has at least some meaningful content
  const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [];
  if (keys.length === 0 && !Array.isArray(parsed)) {
    return { completed: false, score: 0, reason: 'Response is an empty object' };
  }

  return { completed: true, score: 1, reason: 'Task completed successfully' };
}

// ---------------------------------------------------------------------------
// measureStepsSaved
// ---------------------------------------------------------------------------

/**
 * For a given tool, calculate how many manual steps it replaces.
 *
 * Returns the ratio of automated steps to total manual steps.
 * If the tool completed successfully, all manual steps are considered automated.
 * If it failed, 0 steps are automated.
 */
export function measureStepsSaved(
  tool: string,
  result: { isError?: boolean; content?: Array<{ text?: string }> } | null,
): StepsSavedResult {
  const manualDef = MANUAL_STEPS[tool];

  if (!manualDef) {
    return {
      tool,
      manualSteps: 1,
      automatedSteps: 0,
      ratio: 0,
      description: `No manual-step definition for tool '${tool}'`,
    };
  }

  const completion = measureTaskCompletion('', tool, result);
  const automatedSteps = completion.completed ? manualDef.count : 0;

  return {
    tool,
    manualSteps: manualDef.count,
    automatedSteps,
    ratio: automatedSteps / manualDef.count,
    description: completion.completed
      ? `Automated ${manualDef.count} steps: ${manualDef.steps.join(', ')}`
      : `Failed to automate: ${completion.reason}`,
  };
}

// ---------------------------------------------------------------------------
// measureCrossAgentHandoff
// ---------------------------------------------------------------------------

/**
 * Can output of tool A be directly passed as input to tool B?
 *
 * Checks whether the output from agent A contains the fields that agent B
 * expects in its input schema. Returns compatibility score and details
 * about what needs transformation.
 *
 * @param outputFromAgentA - Parsed JSON output from tool A
 * @param inputSchemaAgentB - Map of field names to whether they are required
 * @param fieldMappings - Optional mappings from A's field names to B's field names
 */
export function measureCrossAgentHandoff(
  outputFromAgentA: Record<string, unknown> | null,
  inputSchemaAgentB: Record<string, { required: boolean; type?: string }>,
  fieldMappings?: Record<string, string>,
): HandoffResult {
  if (!outputFromAgentA) {
    return {
      compatible: false,
      score: 0,
      matchedFields: [],
      missingFields: Object.keys(inputSchemaAgentB),
      transformationsNeeded: [],
    };
  }

  const matchedFields: string[] = [];
  const missingFields: string[] = [];
  const transformationsNeeded: { field: string; from: string; to: string }[] = [];

  // Flatten output for deep field access
  const flatOutput = flattenObject(outputFromAgentA);

  for (const [fieldName, spec] of Object.entries(inputSchemaAgentB)) {
    // Check direct match
    if (fieldName in outputFromAgentA) {
      matchedFields.push(fieldName);
      continue;
    }

    // Check mapped field name
    const mappedName = fieldMappings?.[fieldName];
    if (mappedName && mappedName in outputFromAgentA) {
      matchedFields.push(fieldName);
      transformationsNeeded.push({
        field: fieldName,
        from: mappedName,
        to: fieldName,
      });
      continue;
    }

    // Check flattened (nested) field access
    const flatMatch = Object.keys(flatOutput).find(
      (k) => k.endsWith(`.${fieldName}`) || k === fieldName,
    );
    if (flatMatch) {
      matchedFields.push(fieldName);
      if (flatMatch !== fieldName) {
        transformationsNeeded.push({
          field: fieldName,
          from: flatMatch,
          to: fieldName,
        });
      }
      continue;
    }

    if (spec.required) {
      missingFields.push(fieldName);
    }
  }

  const requiredFields = Object.entries(inputSchemaAgentB)
    .filter(([, spec]) => spec.required)
    .map(([name]) => name);

  const allRequiredPresent = requiredFields.every((f) => matchedFields.includes(f));

  return {
    compatible: allRequiredPresent,
    score: allRequiredPresent ? 1 : 0,
    matchedFields,
    missingFields,
    transformationsNeeded,
  };
}

// ---------------------------------------------------------------------------
// measureAutomationCoverage
// ---------------------------------------------------------------------------

/**
 * What fraction of a workflow's steps were automated successfully?
 *
 * Given a scenario with multiple steps and their results, compute
 * what percentage completed without manual intervention.
 */
export function measureAutomationCoverage(
  scenario: { name: string; steps: string[] },
  results: Array<{ step: string; success: boolean }>,
): AutomationCoverageResult {
  const totalSteps = scenario.steps.length;
  const automatedSteps = results.filter((r) => r.success).length;
  const failedSteps = results.filter((r) => !r.success).length;

  return {
    totalSteps,
    automatedSteps,
    failedSteps,
    coverage: totalSteps > 0 ? automatedSteps / totalSteps : 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a nested object into dot-notation keys.
 * E.g., { a: { b: 1 } } -> { 'a.b': 1 }
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}
