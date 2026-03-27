/**
 * Response Cleaner — strip noise before sending results to an LLM.
 *
 * SLIM_MODE aggressively trims payloads to reduce token usage:
 *  - Truncates descriptions > 500 chars
 *  - Caps arrays at 20 items
 *  - Removes metadata noise keys
 */

const SLIM_MAX_DESC_LENGTH = 500;
const SLIM_MAX_ARRAY_ITEMS = 20;

/** Keys that are considered metadata noise in slim mode. */
const NOISE_KEYS = new Set([
  'lastCrawled',
  'metadata',
  'qualityScore',
  'freshnessScore',
]);

/**
 * Recursively strip null / undefined values from an object.
 */
function stripNulls(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const cleaned: unknown[] = [];
    for (const item of obj) {
      const v = stripNulls(item);
      if (v !== undefined) cleaned.push(v);
    }
    return cleaned;
  }
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const v = stripNulls(value);
      if (v !== undefined) out[key] = v;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return obj;
}

/**
 * Apply slim-mode transformations: truncate descriptions, cap arrays, remove noise.
 */
function applySlimMode(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const sliced = obj.slice(0, SLIM_MAX_ARRAY_ITEMS);
    return sliced.map(item => applySlimMode(item));
  }
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (NOISE_KEYS.has(key)) continue;
      if (key === 'description' && typeof value === 'string' && value.length > SLIM_MAX_DESC_LENGTH) {
        out[key] = value.slice(0, SLIM_MAX_DESC_LENGTH) + '...';
      } else {
        out[key] = applySlimMode(value);
      }
    }
    return out;
  }
  return obj;
}

/**
 * Estimate the rough token count for a payload (chars / 4).
 */
export function estimateTokens(data: unknown): number {
  const json = JSON.stringify(data) ?? '';
  return Math.ceil(json.length / 4);
}

/**
 * Clean a response object for LLM consumption.
 *
 * @param response - The raw response object.
 * @param slimMode - When true, aggressively trim to reduce token usage.
 * @returns Cleaned response with an `_tokenEstimate` field.
 */
export function cleanForLLM(response: unknown, slimMode?: boolean): unknown {
  let cleaned = stripNulls(response);
  if (slimMode) {
    cleaned = applySlimMode(cleaned);
  }
  // Attach token estimate at the top level if it's an object
  if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)) {
    (cleaned as Record<string, unknown>)._tokenEstimate = estimateTokens(cleaned);
  }
  return cleaned;
}
