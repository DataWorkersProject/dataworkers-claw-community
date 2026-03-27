/**
 * Eval Framework — Score Aggregator
 *
 * Computes dimension scores from raw sub-scores, composite from dimensions,
 * and assigns letter grades.
 */

import type {
  DimensionName,
  DimensionScore,
  SubScore,
  AgentEvalResult,
  LetterGrade,
} from '../types.js';
import { scoreToGrade, computeComposite, DIMENSIONS } from './rubrics.js';

// ---------------------------------------------------------------------------
// Build a DimensionScore from raw sub-scores
// ---------------------------------------------------------------------------

export function buildDimensionScore(
  dimension: DimensionName,
  subscores: SubScore[],
  evidence: string[] = [],
): DimensionScore {
  const score = subscores.reduce((sum, s) => sum + s.value, 0);
  // Clamp to 0-100
  const clamped = Math.max(0, Math.min(100, Math.round(score * 100) / 100));
  return {
    dimension,
    score: clamped,
    grade: scoreToGrade(clamped),
    subscores,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Create a SubScore entry
// ---------------------------------------------------------------------------

export function makeSubScore(
  metric: string,
  value: number,
  maxPoints: number,
  threshold: number,
  detail: string,
): SubScore {
  const clamped = Math.max(0, Math.min(maxPoints, value));
  return {
    metric,
    value: Math.round(clamped * 100) / 100,
    threshold,
    passed: clamped >= threshold,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Compute composite score from dimension scores
// ---------------------------------------------------------------------------

export function computeCompositeScore(dimensions: DimensionScore[]): {
  compositeScore: number;
  compositeGrade: LetterGrade;
} {
  const scoreMap: Record<DimensionName, number> = {
    'ai-evals': 0,
    'product-quality': 0,
    'productivity': 0,
    'user-value': 0,
  };

  for (const dim of dimensions) {
    scoreMap[dim.dimension] = dim.score;
  }

  const compositeScore = Math.round(computeComposite(scoreMap) * 100) / 100;
  return {
    compositeScore,
    compositeGrade: scoreToGrade(compositeScore),
  };
}

// ---------------------------------------------------------------------------
// Build a full AgentEvalResult from dimension scores
// ---------------------------------------------------------------------------

export function buildAgentEvalResult(
  agent: string,
  toolsTested: string[],
  dimensions: DimensionScore[],
  tier: 'community' | 'pro' | 'enterprise' = 'community',
): AgentEvalResult {
  const { compositeScore, compositeGrade } = computeCompositeScore(dimensions);
  return {
    agent,
    toolsTested,
    dimensions,
    compositeScore,
    compositeGrade,
    tier,
  };
}

// ---------------------------------------------------------------------------
// Aggregate multiple agent results into a summary
// ---------------------------------------------------------------------------

export interface EvalSummary {
  totalAgents: number;
  avgComposite: number;
  avgGrade: LetterGrade;
  byDimension: Record<DimensionName, { avg: number; min: number; max: number; grade: LetterGrade }>;
  agentRanking: Array<{ agent: string; composite: number; grade: LetterGrade }>;
}

export function aggregateSummary(results: AgentEvalResult[]): EvalSummary {
  const n = results.length;
  if (n === 0) {
    return {
      totalAgents: 0,
      avgComposite: 0,
      avgGrade: 'F',
      byDimension: {
        'ai-evals':        { avg: 0, min: 0, max: 0, grade: 'F' },
        'product-quality':  { avg: 0, min: 0, max: 0, grade: 'F' },
        'productivity':     { avg: 0, min: 0, max: 0, grade: 'F' },
        'user-value':       { avg: 0, min: 0, max: 0, grade: 'F' },
      },
      agentRanking: [],
    };
  }

  const avgComposite = results.reduce((s, r) => s + r.compositeScore, 0) / n;

  const dimAgg: Record<DimensionName, number[]> = {
    'ai-evals': [],
    'product-quality': [],
    'productivity': [],
    'user-value': [],
  };

  for (const r of results) {
    for (const d of r.dimensions) {
      dimAgg[d.dimension].push(d.score);
    }
  }

  const byDimension = {} as EvalSummary['byDimension'];
  for (const [dim, scores] of Object.entries(dimAgg) as Array<[DimensionName, number[]]>) {
    const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    byDimension[dim] = {
      avg: Math.round(avg * 100) / 100,
      min: scores.length > 0 ? Math.min(...scores) : 0,
      max: scores.length > 0 ? Math.max(...scores) : 0,
      grade: scoreToGrade(avg),
    };
  }

  const agentRanking = results
    .map((r) => ({ agent: r.agent, composite: r.compositeScore, grade: r.compositeGrade }))
    .sort((a, b) => b.composite - a.composite);

  return {
    totalAgents: n,
    avgComposite: Math.round(avgComposite * 100) / 100,
    avgGrade: scoreToGrade(avgComposite),
    byDimension,
    agentRanking,
  };
}
