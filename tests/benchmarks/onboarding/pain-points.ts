/**
 * Onboarding Benchmark — Pain Point Scoring
 *
 * Converts raw TimingResults into a multi-dimensional pain score that
 * highlights the worst friction points in the onboarding flow.
 *
 * Dimensions (each 1-5):
 *   time             — how long the step takes
 *   cognitiveLoad    — how much the user needs to understand
 *   errorRate        — likelihood of user hitting an error
 *   manualActions    — number of manual file edits / terminal commands
 *   prerequisiteSurprise — unexpected dependencies or requirements
 *
 * Total is a weighted average:
 *   time × 0.30 + cognitiveLoad × 0.25 + errorRate × 0.20
 *   + manualActions × 0.15 + prerequisiteSurprise × 0.10
 */

import type { TimingResult } from './timers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PainPointScore {
  step: string;
  time: number;
  cognitiveLoad: number;
  errorRate: number;
  manualActions: number;
  prerequisiteSurprise: number;
  total: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Heuristic tables
// ---------------------------------------------------------------------------

/** Map stepId → static scores for dimensions that don't depend on timing */
const STEP_HEURISTICS: Record<
  string,
  {
    cognitiveLoad: number;
    errorRate: number;
    manualActions: number;
    prerequisiteSurprise: number;
    notes: string;
  }
> = {
  T_install: {
    cognitiveLoad: 1,
    errorRate: 2,
    manualActions: 1,
    prerequisiteSurprise: 1,
    notes: 'npx cold install; depends on registry speed and package size',
  },
  T_first_tool: {
    cognitiveLoad: 1,
    errorRate: 1,
    manualActions: 1,
    prerequisiteSurprise: 1,
    notes: 'First tool call via npx; should be near-instant with stubs',
  },
  T_total: {
    cognitiveLoad: 1,
    errorRate: 1,
    manualActions: 1,
    prerequisiteSurprise: 1,
    notes: 'Total npx onboarding wall clock time',
  },
  T2: {
    cognitiveLoad: 1,
    errorRate: 1,
    manualActions: 1,
    prerequisiteSurprise: 1,
    notes: 'git clone is familiar; low friction',
  },
  T3: {
    cognitiveLoad: 2,
    errorRate: 3,
    manualActions: 1,
    prerequisiteSurprise: 3,
    notes: 'npm install can fail on native deps, node version, or disk space',
  },
  T4: {
    cognitiveLoad: 4,
    errorRate: 3,
    manualActions: 4,
    prerequisiteSurprise: 4,
    notes:
      'MCP registration requires editing JSON config; path varies by client',
  },
  T5: {
    cognitiveLoad: 2,
    errorRate: 2,
    manualActions: 1,
    prerequisiteSurprise: 2,
    notes: 'First tool call should just work with in-memory stubs',
  },
  T6: {
    cognitiveLoad: 4,
    errorRate: 4,
    manualActions: 5,
    prerequisiteSurprise: 4,
    notes:
      'Credential setup: find docs, create .env, correct variable names, obtain creds from cloud provider',
  },
  T7: {
    cognitiveLoad: 3,
    errorRate: 3,
    manualActions: 2,
    prerequisiteSurprise: 2,
    notes: 'First real query; errors likely come from bad creds, not the tool',
  },
};

const DEFAULT_HEURISTIC = {
  cognitiveLoad: 3,
  errorRate: 3,
  manualActions: 3,
  prerequisiteSurprise: 3,
  notes: 'Unknown step — using default scores',
};

// ---------------------------------------------------------------------------
// Time scoring
// ---------------------------------------------------------------------------

function scoreTime(durationMs: number): number {
  if (durationMs <= 5_000) return 1;
  if (durationMs <= 15_000) return 2;
  if (durationMs <= 60_000) return 3;
  if (durationMs <= 180_000) return 4;
  return 5;
}

// ---------------------------------------------------------------------------
// Weighted total
// ---------------------------------------------------------------------------

const WEIGHTS = {
  time: 0.3,
  cognitiveLoad: 0.25,
  errorRate: 0.2,
  manualActions: 0.15,
  prerequisiteSurprise: 0.1,
} as const;

function weightedTotal(scores: Omit<PainPointScore, 'total' | 'notes' | 'step'>): number {
  return Math.round(
    (scores.time * WEIGHTS.time +
      scores.cognitiveLoad * WEIGHTS.cognitiveLoad +
      scores.errorRate * WEIGHTS.errorRate +
      scores.manualActions * WEIGHTS.manualActions +
      scores.prerequisiteSurprise * WEIGHTS.prerequisiteSurprise) *
      100,
  ) / 100;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert timing results into pain-point scores for each step.
 * Skipped steps are excluded from the output.
 */
export function scorePainPoints(results: TimingResult[]): PainPointScore[] {
  return results
    .filter((r) => r.status !== 'skip')
    .map((r) => {
      const h = STEP_HEURISTICS[r.stepId] ?? DEFAULT_HEURISTIC;
      const time = scoreTime(r.durationMs);
      const scores = {
        time,
        cognitiveLoad: h.cognitiveLoad,
        errorRate: h.errorRate,
        manualActions: h.manualActions,
        prerequisiteSurprise: h.prerequisiteSurprise,
      };
      return {
        step: r.stepId,
        ...scores,
        total: weightedTotal(scores),
        notes: h.notes,
      };
    });
}

/**
 * Return the top N pain points sorted by total score descending.
 */
export function topPainPoints(
  results: TimingResult[],
  n = 3,
): PainPointScore[] {
  return scorePainPoints(results)
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

/**
 * Render pain-point scores as a markdown table.
 */
export function painPointMarkdown(scores: PainPointScore[]): string {
  const lines: string[] = [];
  lines.push(
    '| Step | Time | Cognitive | Errors | Manual | Surprise | **Total** | Notes |',
  );
  lines.push(
    '|------|------|-----------|--------|--------|----------|-----------|-------|',
  );
  for (const s of scores) {
    lines.push(
      `| ${s.step} | ${s.time} | ${s.cognitiveLoad} | ${s.errorRate} | ${s.manualActions} | ${s.prerequisiteSurprise} | **${s.total}** | ${s.notes} |`,
    );
  }
  return lines.join('\n');
}
