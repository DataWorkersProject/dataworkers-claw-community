/**
 * Eval Framework — User Value Dimension
 *
 * Measures how valuable agent responses are to end users:
 * actionability, relevance to input context, and trust signals.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionabilityResult {
  score: number; // 0-1
  breakdown: {
    specificAction: number;   // 0.3 weight
    namedEntities: number;    // 0.3 weight
    quantifiedImpact: number; // 0.2 weight
    priorityOrdering: number; // 0.2 weight
  };
  details: string[];
}

export interface RelevanceResult {
  score: number; // 0-1
  contextSpecificFraction: number;
  referencedInputFields: string[];
  genericPhraseCount: number;
  details: string;
}

export interface TrustSignalsResult {
  score: number; // 0-1
  breakdown: {
    confidence: number;       // 0.25 weight
    sourcesEvidence: number;  // 0.25 weight
    caveatsLimitations: number; // 0.25 weight
    timestampDataAsOf: number;  // 0.25 weight
  };
  details: string[];
}

// ---------------------------------------------------------------------------
// Patterns and heuristics
// ---------------------------------------------------------------------------

/** Patterns indicating specific, actionable next steps (not vague advice). */
const ACTION_PATTERNS = [
  /\brun\b/i,
  /\bexecute\b/i,
  /\bcreate\b/i,
  /\bdelete\b/i,
  /\bmodify\b/i,
  /\bupdate\b/i,
  /\badd\b/i,
  /\bremove\b/i,
  /\brestart\b/i,
  /\bdeploy\b/i,
  /\bmigrate\b/i,
  /\barchive\b/i,
  /\bschedule\b/i,
  /\bconfigure\b/i,
  /\bquery\b/i,
  /\balter\s+table\b/i,
  /\bselect\b.*\bfrom\b/i,
];

/** Patterns indicating vague/generic responses. */
const GENERIC_PATTERNS = [
  /\bconsider\b/i,
  /\byou may want to\b/i,
  /\bit depends\b/i,
  /\bgenerally speaking\b/i,
  /\bin general\b/i,
  /\btypically\b/i,
  /\busually\b/i,
  /\bplease consult\b/i,
  /\bfurther investigation\b/i,
  /\bmore information needed\b/i,
];

/** Patterns for quantified impact (numbers with context). */
const QUANTITY_PATTERNS = [
  /\$[\d,.]+/,                          // Dollar amounts
  /\d+\s*%/,                            // Percentages
  /\d+\s*(rows?|records?|entries)/i,    // Row counts
  /\d+\s*(ms|seconds?|minutes?|hours?|days?)/i, // Time durations
  /\d+\s*(GB|MB|TB|KB)/i,              // Data sizes
  /\d+\s*(tables?|columns?|databases?)/i, // Data objects
  /save[sd]?\s+\$?[\d,.]+/i,           // Savings
  /reduc(e|ed|tion)\s+.*\d+/i,         // Reductions
];

/** Patterns for entity references (table names, columns, identifiers). */
const ENTITY_PATTERNS = [
  /[a-z_]+\.[a-z_]+/i,                 // schema.table notation
  /`[^`]+`/,                            // Backtick-quoted identifiers
  /"[A-Z_]+"/, // Double-quoted identifiers
  /\b(table|column|schema|database|pipeline|dataset)\s*[:\s]+\s*[`"']?\w+/i,
  /\b[a-z_]+_[a-z_]+\b/,               // snake_case identifiers (likely table/column names)
];

/** Patterns indicating confidence/certainty. */
const CONFIDENCE_PATTERNS = [
  /confidence[:\s]+[\d.]+/i,
  /\bconfidence\b/i,
  /\bcertainty\b/i,
  /\blikelihood\b/i,
  /\bprobability\b/i,
  /\bscore[:\s]+[\d.]+/i,
];

/** Patterns indicating sources or evidence. */
const SOURCE_PATTERNS = [
  /\bsource[s]?\b/i,
  /\bevidence\b/i,
  /\bbased on\b/i,
  /\baccording to\b/i,
  /\bderived from\b/i,
  /\blineage\b/i,
  /\bquery[:\s]/i,
  /\blog[s]?\b/i,
  /\bmetric[s]?\b/i,
];

/** Patterns indicating caveats or limitations. */
const CAVEAT_PATTERNS = [
  /\bcaveat\b/i,
  /\blimitation\b/i,
  /\bnote\b/i,
  /\bwarning\b/i,
  /\bcaution\b/i,
  /\bassumption\b/i,
  /\bestimated\b/i,
  /\bapproximate\b/i,
  /\bdry\s*run\b/i,
];

/** Patterns indicating temporal context. */
const TIMESTAMP_PATTERNS = [
  /\btimestamp\b/i,
  /\bas\s*of\b/i,
  /\bdata_as_of\b/i,
  /\bupdated_at\b/i,
  /\blast_updated\b/i,
  /\bchecked_at\b/i,
  /\d{4}-\d{2}-\d{2}/,                 // ISO date
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,    // ISO datetime
];

// ---------------------------------------------------------------------------
// measureActionability
// ---------------------------------------------------------------------------

/**
 * Check response for specific, actionable content.
 *
 * Scoring weights:
 * - specific_action (0.3): Contains concrete next steps, not vague advice
 * - named_entities (0.3): References specific table names, columns, identifiers
 * - quantified_impact (0.2): Includes dollar amounts, row counts, percentages
 * - priority_ordering (0.2): Results are ordered/ranked/prioritized
 */
export function measureActionability(
  result: { isError?: boolean; content?: Array<{ text?: string }> } | null,
): ActionabilityResult {
  const details: string[] = [];
  const empty: ActionabilityResult = {
    score: 0,
    breakdown: { specificAction: 0, namedEntities: 0, quantifiedImpact: 0, priorityOrdering: 0 },
    details: ['No result to evaluate'],
  };

  if (!result || result.isError) return empty;

  const text = result.content?.[0]?.text ?? '';
  if (!text || text.length <= 2) return empty;

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return empty;
  }

  const responseStr = JSON.stringify(parsed);

  // --- Specific action (weight 0.3) ---
  const actionMatches = ACTION_PATTERNS.filter((p) => p.test(responseStr)).length;
  const genericMatches = GENERIC_PATTERNS.filter((p) => p.test(responseStr)).length;
  const actionScore = Math.min(1, actionMatches / 3) * (1 - Math.min(1, genericMatches / 3));
  details.push(`Actions found: ${actionMatches}, generic phrases: ${genericMatches}`);

  // --- Named entities (weight 0.3) ---
  const entityMatches = ENTITY_PATTERNS.filter((p) => p.test(responseStr)).length;
  const entityScore = Math.min(1, entityMatches / 3);
  details.push(`Named entities matched: ${entityMatches} patterns`);

  // --- Quantified impact (weight 0.2) ---
  const quantityMatches = QUANTITY_PATTERNS.filter((p) => p.test(responseStr)).length;
  const quantityScore = Math.min(1, quantityMatches / 2);
  details.push(`Quantified impacts found: ${quantityMatches}`);

  // --- Priority ordering (weight 0.2) ---
  let priorityScore = 0;
  // Check for arrays with ordering indicators
  if (Array.isArray(parsed)) {
    priorityScore = parsed.length > 1 ? 0.5 : 0;
    // Check if items have rank/priority/severity fields
    if (parsed[0] && ('priority' in parsed[0] || 'rank' in parsed[0] || 'severity' in parsed[0] || 'score' in parsed[0])) {
      priorityScore = 1;
    }
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Check nested arrays
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val) && (val as any[]).length > 1) {
        priorityScore = 0.5;
        const first = (val as any[])[0];
        if (first && typeof first === 'object' && ('priority' in first || 'rank' in first || 'severity' in first || 'score' in first || 'order' in first)) {
          priorityScore = 1;
          break;
        }
      }
    }
    // Check for explicit recommendations/steps fields
    if ('recommendations' in parsed || 'steps' in parsed || 'actions' in parsed || 'priorities' in parsed) {
      priorityScore = Math.max(priorityScore, 0.75);
    }
  }
  details.push(`Priority ordering score: ${priorityScore}`);

  const score =
    actionScore * 0.3 +
    entityScore * 0.3 +
    quantityScore * 0.2 +
    priorityScore * 0.2;

  return {
    score: Math.round(score * 1000) / 1000,
    breakdown: {
      specificAction: Math.round(actionScore * 1000) / 1000,
      namedEntities: Math.round(entityScore * 1000) / 1000,
      quantifiedImpact: Math.round(quantityScore * 1000) / 1000,
      priorityOrdering: Math.round(priorityScore * 1000) / 1000,
    },
    details,
  };
}

// ---------------------------------------------------------------------------
// measureRelevance
// ---------------------------------------------------------------------------

/**
 * Check that the response references the input context.
 *
 * Extracts identifiable values from the input (customerId, asset names,
 * table names, queries) and checks how many appear in the response.
 * Returns the fraction of response that is context-specific vs generic.
 */
export function measureRelevance(
  result: { isError?: boolean; content?: Array<{ text?: string }> } | null,
  input: Record<string, unknown>,
): RelevanceResult {
  const empty: RelevanceResult = {
    score: 0,
    contextSpecificFraction: 0,
    referencedInputFields: [],
    genericPhraseCount: 0,
    details: 'No result to evaluate',
  };

  if (!result || result.isError) return empty;

  const text = result.content?.[0]?.text ?? '';
  if (!text || text.length <= 2) return empty;

  const responseStr = text.toLowerCase();

  // Extract meaningful values from input
  const inputValues: { field: string; value: string }[] = [];
  extractInputValues(input, '', inputValues);

  // Check which input values appear in the response
  const referencedFields: string[] = [];
  for (const { field, value } of inputValues) {
    if (value.length >= 3 && responseStr.includes(value.toLowerCase())) {
      referencedFields.push(field);
    }
  }

  // Count generic phrases
  const genericCount = GENERIC_PATTERNS.filter((p) => p.test(responseStr)).length;

  // Compute context-specific fraction
  const totalInputFields = inputValues.filter((v) => v.value.length >= 3).length;
  const contextFraction = totalInputFields > 0
    ? referencedFields.length / totalInputFields
    : 0;

  // Final score: high context reference, low generic content
  const genericPenalty = Math.min(0.3, genericCount * 0.1);
  const score = Math.max(0, contextFraction - genericPenalty);

  return {
    score: Math.round(score * 1000) / 1000,
    contextSpecificFraction: Math.round(contextFraction * 1000) / 1000,
    referencedInputFields: referencedFields,
    genericPhraseCount: genericCount,
    details: `Referenced ${referencedFields.length}/${totalInputFields} input fields. Generic phrases: ${genericCount}`,
  };
}

// ---------------------------------------------------------------------------
// measureTrustSignals
// ---------------------------------------------------------------------------

/**
 * Check for trust-building signals in the response.
 *
 * Scoring weights:
 * - confidence field (0.25): Response includes confidence/certainty score
 * - sources/evidence (0.25): Response cites data sources or evidence
 * - caveats/limitations (0.25): Response includes honest caveats
 * - timestamp/dataAsOf (0.25): Response includes temporal context
 */
export function measureTrustSignals(
  result: { isError?: boolean; content?: Array<{ text?: string }> } | null,
): TrustSignalsResult {
  const details: string[] = [];
  const empty: TrustSignalsResult = {
    score: 0,
    breakdown: { confidence: 0, sourcesEvidence: 0, caveatsLimitations: 0, timestampDataAsOf: 0 },
    details: ['No result to evaluate'],
  };

  if (!result || result.isError) return empty;

  const text = result.content?.[0]?.text ?? '';
  if (!text || text.length <= 2) return empty;

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return empty;
  }

  const responseStr = JSON.stringify(parsed);
  const responseKeys = typeof parsed === 'object' && parsed !== null
    ? collectAllKeys(parsed)
    : [];

  // --- Confidence (weight 0.25) ---
  let confidenceScore = 0;
  if (responseKeys.some((k) => /confidence|certainty|likelihood|probability/i.test(k))) {
    confidenceScore = 1;
    details.push('Has confidence field in response structure');
  } else if (CONFIDENCE_PATTERNS.some((p) => p.test(responseStr))) {
    confidenceScore = 0.5;
    details.push('Mentions confidence in text');
  } else {
    details.push('No confidence signal found');
  }

  // --- Sources/evidence (weight 0.25) ---
  let sourcesScore = 0;
  if (responseKeys.some((k) => /source|evidence|lineage|origin|derived/i.test(k))) {
    sourcesScore = 1;
    details.push('Has source/evidence field in response structure');
  } else if (SOURCE_PATTERNS.some((p) => p.test(responseStr))) {
    sourcesScore = 0.5;
    details.push('Mentions sources in text');
  } else {
    details.push('No source/evidence signal found');
  }

  // --- Caveats/limitations (weight 0.25) ---
  let caveatsScore = 0;
  if (responseKeys.some((k) => /caveat|limitation|warning|note|assumption|risk/i.test(k))) {
    caveatsScore = 1;
    details.push('Has caveat/limitation field in response structure');
  } else if (CAVEAT_PATTERNS.some((p) => p.test(responseStr))) {
    caveatsScore = 0.5;
    details.push('Mentions caveats in text');
  } else {
    details.push('No caveat/limitation signal found');
  }

  // --- Timestamp/dataAsOf (weight 0.25) ---
  let timestampScore = 0;
  if (responseKeys.some((k) => /timestamp|updated_at|checked_at|as_of|dataAsOf|last_updated|createdAt/i.test(k))) {
    timestampScore = 1;
    details.push('Has timestamp field in response structure');
  } else if (TIMESTAMP_PATTERNS.some((p) => p.test(responseStr))) {
    timestampScore = 0.5;
    details.push('Contains date/time in text');
  } else {
    details.push('No temporal context found');
  }

  const score =
    confidenceScore * 0.25 +
    sourcesScore * 0.25 +
    caveatsScore * 0.25 +
    timestampScore * 0.25;

  return {
    score: Math.round(score * 1000) / 1000,
    breakdown: {
      confidence: Math.round(confidenceScore * 1000) / 1000,
      sourcesEvidence: Math.round(sourcesScore * 1000) / 1000,
      caveatsLimitations: Math.round(caveatsScore * 1000) / 1000,
      timestampDataAsOf: Math.round(timestampScore * 1000) / 1000,
    },
    details,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract string values from input for relevance checking.
 */
function extractInputValues(
  obj: unknown,
  prefix: string,
  result: { field: string; value: string }[],
): void {
  if (typeof obj === 'string') {
    result.push({ field: prefix || 'value', value: obj });
  } else if (typeof obj === 'number' || typeof obj === 'boolean') {
    result.push({ field: prefix || 'value', value: String(obj) });
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      extractInputValues(obj[i], `${prefix}[${i}]`, result);
    }
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      extractInputValues(value, prefix ? `${prefix}.${key}` : key, result);
    }
  }
}

/**
 * Collect all keys from a nested object (recursively).
 */
function collectAllKeys(obj: unknown): string[] {
  const keys: string[] = [];

  if (Array.isArray(obj)) {
    for (const item of obj) {
      keys.push(...collectAllKeys(item));
    }
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      keys.push(key);
      keys.push(...collectAllKeys(value));
    }
  }

  return keys;
}
