/**
 * Persona-based AI Eval Benchmark -- Scoring Functions
 *
 * Seven scoring axes, each returning 0-1:
 *   1. responseCompleteness  -- required entities & fields present
 *   2. factualGrounding      -- no hallucinated entities
 *   3. actionability         -- action verbs, specific values, recommendations,
 *                               structured data, and contextual specificity
 *   4. seedSpecificity       -- seed-specific entities appear in response;
 *                               penalises responses that are identical across seeds
 *   5. negativeHandling      -- graceful error handling for negative test scenarios
 *   6. responseStructure     -- response matches expected tool output schema
 *   7. composite             -- difficulty-weighted average across all axes
 *                               (routing accuracy is the implicit axis)
 */

import type { ExpectedResponse, PersonaScore, PersonaScenario } from './types.js';
import type { SeedEntityMap } from './seed-configs.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deep-stringify any value so we can do substring searches. */
function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Extract all keys from a value if it is an object / array. */
function extractFields(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== 'object') return [];

  const fields: string[] = [];
  const queue: unknown[] = [value];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
    } else {
      for (const key of Object.keys(current as Record<string, unknown>)) {
        fields.push(key);
        queue.push((current as Record<string, unknown>)[key]);
      }
    }
  }
  return fields;
}

/**
 * Extract "entity-like" strings from a response.
 * Captures snake_case identifiers, CamelCase words, and quoted strings
 * that look like table/column/pipeline names.
 */
function extractEntityLikeStrings(value: unknown): string[] {
  const text = stringify(value);
  const entities = new Set<string>();

  // snake_case identifiers (at least one underscore or all-lowercase word >= 3 chars)
  const snakePattern = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
  for (const m of text.matchAll(snakePattern)) {
    entities.add(m[0]);
  }

  // Quoted strings that look like identifiers
  const quotedPattern = /["']([a-zA-Z][a-zA-Z0-9_ ]+)["']/g;
  for (const m of text.matchAll(quotedPattern)) {
    entities.add(m[1]);
  }

  // CamelCase words (e.g., "Revenue Dashboard")
  const camelPattern = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g;
  for (const m of text.matchAll(camelPattern)) {
    entities.add(m[0]);
  }

  return [...entities];
}

// ---------------------------------------------------------------------------
// 1. Completeness
// ---------------------------------------------------------------------------

/**
 * Score how many required entities and fields are present in the response.
 * Returns 0-1 (fraction of required items found).
 *
 * Improvements over v0:
 * - Checks nested field paths (e.g., "data.results") not just top-level keys.
 * - Validates minResultCount against deeply nested arrays.
 */
export function scoreCompleteness(
  response: unknown,
  expected: ExpectedResponse,
): number {
  const text = stringify(response).toLowerCase();
  const fields = extractFields(response);
  const fieldSet = new Set(fields.map((f) => f.toLowerCase()));

  let totalRequired = 0;
  let found = 0;

  // Check required entities
  for (const entity of expected.requiredEntities) {
    totalRequired++;
    if (text.includes(entity.toLowerCase())) {
      found++;
    }
  }

  // Check required fields -- support dotted paths (e.g., "data.results")
  for (const field of expected.requiredFields) {
    totalRequired++;
    const parts = field.split('.');
    if (parts.length === 1) {
      if (fieldSet.has(field.toLowerCase())) {
        found++;
      }
    } else {
      // Walk the nested path
      let current: unknown = response;
      let pathFound = true;
      for (const part of parts) {
        if (current !== null && typeof current === 'object' && !Array.isArray(current)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          pathFound = false;
          break;
        }
      }
      if (pathFound && current !== undefined) {
        found++;
      } else if (fieldSet.has(parts[parts.length - 1].toLowerCase())) {
        // Fallback: leaf field name exists somewhere in the response
        found++;
      }
    }
  }

  // Check minimum result count if specified
  if (expected.minResultCount !== undefined) {
    totalRequired++;
    if (countArrayItems(response) >= expected.minResultCount) {
      found++;
    }
  }

  if (totalRequired === 0) return 1;
  return found / totalRequired;
}

/** Recursively find the largest array in a response. */
function countArrayItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value === null || value === undefined || typeof value !== 'object') return 0;
  let max = 0;
  for (const val of Object.values(value as Record<string, unknown>)) {
    const count = countArrayItems(val);
    if (count > max) max = count;
  }
  return max;
}

// ---------------------------------------------------------------------------
// 2. Factual Grounding
// ---------------------------------------------------------------------------

/**
 * Common structural field names, status values, and framework-generated
 * identifiers that should never count as hallucinated entities.
 */
const GROUNDING_SKIP_LIST = new Set([
  // Boolean/null
  'true', 'false', 'null', 'undefined',
  // Status values
  'success', 'error', 'warning', 'info', 'debug', 'pass', 'fail',
  'pending', 'running', 'completed', 'failed', 'active', 'inactive',
  // Common JSON field names
  'is_error', 'content', 'type', 'text', 'name', 'value', 'data',
  'result', 'results', 'status', 'message', 'description',
  'timestamp', 'created_at', 'updated_at', 'last_updated',
  // Common test IDs
  'customer_id', 'test_customer', 'cust_1', 'test_customer_1',
  // Common framework strings
  'not_found', 'no_data', 'unknown_error', 'access_denied',
  'column_added', 'column_removed', 'column_modified',
  'add_column', 'drop_column', 'rename_column',
  // Common metric names (not entity-like)
  'row_count', 'null_rate', 'quality_score', 'freshness_score',
]);

/**
 * Parse entity-like strings from the response and check how many are
 * grounded in the known seed entities. Returns 1 - (hallucinated / total).
 *
 * A score of 1.0 means zero hallucinated entities.
 *
 * Improvements over v0:
 * - Expanded skip list to reduce false-positive hallucination flags.
 * - Partial matching: "stg_orders" matches even if seed has "stg_orders".
 * - Substring grounding: an extracted entity like "fact_orders_v2" is
 *   considered partially grounded if "fact_orders" is known.
 */
export function scoreFactualGrounding(
  response: unknown,
  seedEntities: SeedEntityMap,
  forbiddenEntities?: string[],
): number {
  const text = stringify(response).toLowerCase();

  // Immediate penalty if forbidden entities appear
  if (forbiddenEntities && forbiddenEntities.length > 0) {
    for (const forbidden of forbiddenEntities) {
      if (text.includes(forbidden.toLowerCase())) {
        return 0;
      }
    }
  }

  // Build full set of known entity names (lowercase)
  const knownSet = new Set<string>();
  for (const t of seedEntities.tables) knownSet.add(t.toLowerCase());
  for (const m of seedEntities.metrics) knownSet.add(m.toLowerCase());
  for (const p of seedEntities.pipelines) knownSet.add(p.toLowerCase());
  for (const cols of Object.values(seedEntities.columns)) {
    for (const c of cols) knownSet.add(c.toLowerCase());
  }

  const extracted = extractEntityLikeStrings(response);
  if (extracted.length === 0) return 1;

  let total = 0;
  let grounded = 0;

  for (const entity of extracted) {
    const lower = entity.toLowerCase();
    if (GROUNDING_SKIP_LIST.has(lower)) continue;
    // Skip very short strings (likely not real entity names)
    if (lower.length < 3) continue;

    total++;

    // Exact match
    if (knownSet.has(lower)) {
      grounded++;
      continue;
    }

    // Substring grounding: if the extracted entity contains a known entity
    // name, or a known entity name contains the extracted entity, count it
    // as partially grounded (0.5).
    let partiallyGrounded = false;
    for (const known of knownSet) {
      if (known.length >= 3 && (lower.includes(known) || known.includes(lower))) {
        partiallyGrounded = true;
        break;
      }
    }
    if (partiallyGrounded) {
      grounded += 0.5;
    }
  }

  if (total === 0) return 1;
  return Math.min(grounded / total, 1);
}

// ---------------------------------------------------------------------------
// 3. Actionability
// ---------------------------------------------------------------------------

/** Action verbs that signal actionable recommendations. */
const ACTION_VERBS = [
  'fix', 'run', 'add', 'check', 'migrate', 'update', 'remove',
  'create', 'configure', 'deploy', 'monitor', 'validate', 'test',
  'investigate', 'resolve', 'enable', 'disable', 'schedule',
  'alert', 'notify', 'recommend', 'should', 'consider',
  'review', 'optimize', 'refactor', 'archive', 'deprecate',
];

/** Patterns that indicate specific values (numbers, IDs, dates). */
const VALUE_PATTERNS = [
  /\b\d+(\.\d+)?%?\b/,          // numbers and percentages
  /\b\d{4}-\d{2}-\d{2}\b/,      // ISO dates
  /\b[a-z]+-\d{3,}\b/i,         // IDs like inc-001, run_003
  /\b0\.\d+\b/,                  // decimal scores
  /\b\d+\s*(ms|seconds?|minutes?|hours?|days?)\b/i, // durations
  /\$\d+/,                       // dollar amounts
  /\b\d+\s*(GB|MB|TB|KB)\b/i,   // storage sizes
];

/**
 * Patterns indicating structured, actionable output beyond simple keywords.
 * Grouped into categories for more robust scoring.
 */
const STRUCTURED_ACTION_PATTERNS = {
  /** Recommendation language */
  recommendations: [
    /recommend/i,
    /suggest/i,
    /should/i,
    /consider/i,
    /action.*required/i,
    /next\s*step/i,
    /impact/i,
    /priority/i,
    /severity/i,
    /remediat/i,
    /mitigat/i,
    /workaround/i,
  ],
  /** Structured data indicators (JSON keys that imply actionable structure) */
  structuredData: [
    /\"steps\"/i,
    /\"actions\"/i,
    /\"recommendations\"/i,
    /\"checks\"/i,
    /\"rules\"/i,
    /\"pipeline\"/i,
    /\"diagnosis\"/i,
    /\"possibleCauses\"/i,
    /\"impactedAssets\"/i,
    /\"score\":\s*\d/i,
    /\"status\":\s*\"/i,
  ],
  /** Contextual specificity -- references to actual data entities */
  contextualRef: [
    /table[:\s]+\w+/i,
    /column[:\s]+\w+/i,
    /model[:\s]+\w+/i,
    /pipeline[:\s]+\w+/i,
    /dataset[:\s]+\w+/i,
    /schema[:\s]+\w+/i,
  ],
};

/**
 * Score whether the response contains actionable content.
 *
 * Four components (each 0-1, averaged):
 *   1. Action verbs
 *   2. Specific values (numbers, dates, IDs, dollar amounts)
 *   3. Recommendation / severity language
 *   4. Structured data indicators + contextual references
 *
 * Returns 0-1.
 */
export function scoreActionability(response: unknown): number {
  const text = stringify(response).toLowerCase();
  if (text.length === 0) return 0;

  let score = 0;
  const maxComponents = 4;

  // Component 1: Action verbs (up to 1.0)
  let verbHits = 0;
  for (const verb of ACTION_VERBS) {
    if (text.includes(verb)) verbHits++;
  }
  score += Math.min(verbHits / 3, 1.0);

  // Component 2: Specific values (up to 1.0)
  let valueHits = 0;
  for (const pattern of VALUE_PATTERNS) {
    if (pattern.test(text)) valueHits++;
  }
  score += Math.min(valueHits / 2, 1.0);

  // Component 3: Recommendation language (up to 1.0)
  let recHits = 0;
  for (const pattern of STRUCTURED_ACTION_PATTERNS.recommendations) {
    if (pattern.test(text)) recHits++;
  }
  score += Math.min(recHits / 2, 1.0);

  // Component 4: Structured data + contextual references (up to 1.0)
  let structHits = 0;
  for (const pattern of STRUCTURED_ACTION_PATTERNS.structuredData) {
    if (pattern.test(text)) structHits++;
  }
  let contextHits = 0;
  for (const pattern of STRUCTURED_ACTION_PATTERNS.contextualRef) {
    if (pattern.test(text)) contextHits++;
  }
  score += Math.min((structHits + contextHits) / 3, 1.0);

  return Math.min(score / maxComponents, 1.0);
}

// ---------------------------------------------------------------------------
// 4. Seed Specificity
// ---------------------------------------------------------------------------

/**
 * Score whether the response contains entities specific to the seed dataset.
 *
 * Improvements over v0:
 * - Checks not just requiredEntities but also extracts entity-like strings
 *   and matches them against the full seed entity catalogue.
 * - This means a response that mentions "stg_orders" (a jaffle-shop entity)
 *   when running against jaffle-shop scores higher even if stg_orders
 *   is not explicitly listed in requiredEntities.
 */
export function scoreSeedSpecificity(
  response: unknown,
  expected: ExpectedResponse,
  seedEntities?: SeedEntityMap,
): number {
  if (expected.requiredEntities.length === 0 && !seedEntities) return 1;

  const text = stringify(response).toLowerCase();
  let found = 0;
  let totalRequired = expected.requiredEntities.length;

  // Check explicitly required entities
  for (const entity of expected.requiredEntities) {
    if (text.includes(entity.toLowerCase())) {
      found++;
    }
  }

  // Bonus: if we have the full seed entity map, check for additional
  // seed-specific entities in the response for a richer signal.
  if (seedEntities) {
    const allSeedNames = [
      ...seedEntities.tables,
      ...seedEntities.metrics,
      ...seedEntities.pipelines,
    ].map((n) => n.toLowerCase());

    const extracted = extractEntityLikeStrings(response);
    let seedHits = 0;
    let extractedCount = 0;

    for (const e of extracted) {
      const lower = e.toLowerCase();
      if (lower.length < 3) continue;
      if (GROUNDING_SKIP_LIST.has(lower)) continue;
      extractedCount++;
      if (allSeedNames.some((s) => s === lower || s.includes(lower) || lower.includes(s))) {
        seedHits++;
      }
    }

    // Blend: 70% from required entities, 30% from extracted entity matching
    if (totalRequired === 0 && extractedCount === 0) return 1;
    const requiredScore = totalRequired > 0 ? found / totalRequired : 1;
    const extractedScore = extractedCount > 0 ? seedHits / extractedCount : 1;
    return requiredScore * 0.7 + extractedScore * 0.3;
  }

  if (totalRequired === 0) return 1;
  return found / totalRequired;
}

// ---------------------------------------------------------------------------
// 5. Negative Test Handling
// ---------------------------------------------------------------------------

/**
 * Score whether the agent handles a negative/adversarial scenario gracefully.
 *
 * For negative test scenarios, we check that the response:
 *   - Contains error/not-found/access-denied language (not a crash)
 *   - Does NOT contain fabricated data (no hallucinated results)
 *   - Matches the expectedErrorPattern if provided
 *   - Returns structured error (JSON with error/message fields) rather than raw text
 *
 * For non-negative scenarios, returns 1.0 (not applicable).
 */
export function scoreNegativeHandling(
  response: unknown,
  error: string | undefined,
  scenario: PersonaScenario,
): number {
  if (!scenario.isNegativeTest) return 1.0;

  const text = stringify(response).toLowerCase();
  const errorText = (error ?? '').toLowerCase();
  const combined = text + ' ' + errorText;

  let score = 0;
  const maxComponents = 4;

  // Component 1: Did we get a response at all (not a crash/timeout)?
  // An error that contains meaningful text is acceptable for negative tests.
  if (response !== null || (error && error.length > 5)) {
    score += 1.0;
  }

  // Component 2: Does the response contain graceful error language?
  const errorPatterns = [
    /not\s*found/i,
    /does\s*not\s*exist/i,
    /no\s*(results?|data|records?|match)/i,
    /access\s*denied/i,
    /permission\s*denied/i,
    /unauthorized/i,
    /forbidden/i,
    /invalid/i,
    /error/i,
    /unable\s*to/i,
    /cannot/i,
    /empty/i,
  ];
  let errorLanguageHits = 0;
  for (const pattern of errorPatterns) {
    if (pattern.test(combined)) errorLanguageHits++;
  }
  score += Math.min(errorLanguageHits / 2, 1.0);

  // Component 3: Does NOT contain fabricated positive results
  // (negative tests should not return large result sets)
  const resultArraySize = countArrayItems(response);
  if (resultArraySize <= 1) {
    score += 1.0;
  } else if (resultArraySize <= 3) {
    score += 0.5;
  }

  // Component 4: Matches expected error pattern if provided
  if (scenario.expectedErrorPattern) {
    const pattern = new RegExp(scenario.expectedErrorPattern, 'i');
    if (pattern.test(combined)) {
      score += 1.0;
    }
  } else {
    // No specific pattern required, give full credit
    score += 1.0;
  }

  return Math.min(score / maxComponents, 1.0);
}

// ---------------------------------------------------------------------------
// 6. Response Structure Validation
// ---------------------------------------------------------------------------

/**
 * Expected output schemas per tool family.
 * Each entry maps a tool name prefix to the JSON keys that MUST appear
 * in a valid response. This prevents gaming by returning generic helpful text
 * with seed entity names sprinkled in.
 */
const TOOL_SCHEMA_EXPECTATIONS: Record<string, string[]> = {
  'search_datasets': ['results'],
  'search_across_platforms': ['results'],
  'explain_table': ['columns'],
  'get_lineage': ['upstream', 'downstream'],
  'check_freshness': ['freshnessScore', 'lastUpdated'],
  'blast_radius_analysis': ['impactedAssets'],
  'generate_pipeline': ['pipeline', 'steps'],
  'validate_pipeline': ['valid'],
  'run_quality_check': ['checks', 'status'],
  'get_quality_score': ['score'],
  'set_sla': ['sla', 'rules'],
  'get_anomalies': ['anomalies'],
  'detect_schema_change': ['changes'],
  'validate_schema_compatibility': ['compatible', 'analysis'],
  'scan_pii': ['piiColumns', 'riskLevel'],
  'generate_audit_report': ['report', 'entries'],
  'check_policy': ['allowed', 'policy'],
  'enforce_rbac': ['enforced'],
  'provision_access': ['granted', 'accessDetails'],
  'get_cost_dashboard': ['totalCost', 'breakdown'],
  'estimate_savings': ['recommendations', 'estimatedSavings'],
  'find_unused_data': ['unusedDatasets'],
  'recommend_archival': ['recommendations'],
  'query_data_nl': ['sql', 'results'],
  'generate_insight': ['insights'],
  'explain_anomaly': ['explanation', 'possibleCauses'],
  'export_insight': ['exportPath', 'format'],
  'suggest_features': ['features'],
  'select_model': ['recommendations'],
  'train_model': ['modelId', 'status'],
  'evaluate_model': ['metrics'],
  'deploy_model': ['deploymentId', 'status'],
  'diagnose_incident': ['diagnosis', 'severity'],
  'monitor_lag': ['lag'],
  'get_adoption_dashboard': ['agents', 'adoption'],
  'check_agent_health': ['agents', 'status'],
  'detect_drift': ['driftDetected'],
  'resolve_metric': ['definition', 'formula'],
  'generate_documentation': ['documentation'],
  'get_documentation': ['documentation'],
  'define_business_rule': ['rule', 'ruleId'],
  'list_semantic_definitions': ['definitions'],
  'get_dbt_model_lineage': ['edges'],
  'check_staleness': ['staleness'],
  'import_tribal_knowledge': ['imported'],
  'get_context': ['context'],
  'correlate_metadata': ['correlations'],
  'estimate_query_cost': ['estimatedCost'],
  'identify_golden_path': ['goldenPath'],
  'analyze_query_history': ['queryPatterns'],
};

/**
 * Score whether the response matches the expected structural schema for the tool.
 *
 * This is an anti-gaming check: an agent cannot just return a generic paragraph
 * mentioning seed entities and score well. The response must have the right JSON
 * structure for the tool that was called.
 *
 * Returns 0-1 (fraction of expected keys found).
 */
export function scoreResponseStructure(
  response: unknown,
  scenario: PersonaScenario,
): number {
  // For negative tests, structure validation is relaxed
  if (scenario.isNegativeTest) return 1.0;

  const fields = new Set(extractFields(response).map((f) => f.toLowerCase()));
  const text = stringify(response).toLowerCase();

  let totalChecks = 0;
  let passed = 0;

  for (const route of scenario.routes) {
    const expectedKeys = TOOL_SCHEMA_EXPECTATIONS[route.tool];
    if (!expectedKeys) continue;

    for (const key of expectedKeys) {
      totalChecks++;
      // Check both as JSON field and as substring (for nested responses)
      if (fields.has(key.toLowerCase()) || text.includes(`"${key.toLowerCase()}"`)) {
        passed++;
      }
    }
  }

  if (totalChecks === 0) return 1.0;
  return passed / totalChecks;
}

// ---------------------------------------------------------------------------
// 7. Jaccard Token Similarity for Multi-Seed Comparison
// ---------------------------------------------------------------------------

/**
 * Compute Jaccard similarity between two token sets.
 * Returns 0-1 where 1.0 means identical token sets.
 */
export function jaccardSimilarity(textA: string, textB: string): number {
  const tokenize = (t: string): Set<string> => {
    const tokens = new Set<string>();
    // Extract alphanumeric tokens of length >= 2
    const matches = t.toLowerCase().matchAll(/[a-z0-9_]{2,}/g);
    for (const m of matches) {
      tokens.add(m[0]);
    }
    return tokens;
  };

  const setA = tokenize(textA);
  const setB = tokenize(textB);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1.0 : intersection / union;
}

// ---------------------------------------------------------------------------
// 8. Latency Compliance
// ---------------------------------------------------------------------------

/**
 * Score whether the response arrived within the persona's latency budget.
 *
 * - If no budget is set (maxLatencyMs is undefined), returns 1.0 (N/A).
 * - If within budget, returns 1.0.
 * - If over budget, degrades linearly: score = budget / actual.
 *   e.g., budget=500ms, actual=1000ms -> 0.5
 * - Floor of 0.1 to avoid zero-scoring slow-but-correct responses.
 */
export function scoreLatencyCompliance(
  latencyMs: number,
  maxLatencyMs?: number,
): number {
  if (maxLatencyMs === undefined || maxLatencyMs <= 0) return 1.0;
  if (latencyMs <= maxLatencyMs) return 1.0;
  return Math.max(maxLatencyMs / latencyMs, 0.1);
}

// ---------------------------------------------------------------------------
// 9. Composite (Difficulty-Weighted)
// ---------------------------------------------------------------------------

/** Difficulty multiplier for weighted scoring. */
const DIFFICULTY_WEIGHTS: Record<string, number> = {
  basic: 1.0,
  intermediate: 1.25,
  advanced: 1.5,
};

/**
 * Compute composite score with difficulty weighting.
 *
 * Eight axes:
 *   - routingAccuracy, responseCompleteness, factualGrounding,
 *     actionability, seedSpecificity: 0.13 each (0.65 total)
 *   - negativeHandling: 0.10
 *   - responseStructure: 0.13
 *   - latencyCompliance: 0.12
 *
 * The raw composite is then multiplied by a difficulty weight for aggregation:
 *   basic=1.0, intermediate=1.25, advanced=1.5
 * but the per-scenario composite is kept on a 0-1 scale.
 */
export function computeComposite(
  scores: Omit<PersonaScore, 'composite'>,
  difficulty?: 'basic' | 'intermediate' | 'advanced',
): number {
  const raw =
    scores.routingAccuracy * 0.13 +
    scores.responseCompleteness * 0.13 +
    scores.factualGrounding * 0.13 +
    scores.actionability * 0.13 +
    scores.seedSpecificity * 0.13 +
    scores.negativeHandling * 0.10 +
    scores.responseStructure * 0.13 +
    scores.latencyCompliance * 0.12;

  // Composite is always 0-1 for the scenario
  return Math.min(raw, 1.0);
}

/**
 * Get the difficulty weight for aggregation purposes.
 * Advanced scenarios count more toward the final score.
 */
export function getDifficultyWeight(difficulty: string): number {
  return DIFFICULTY_WEIGHTS[difficulty] ?? 1.0;
}
