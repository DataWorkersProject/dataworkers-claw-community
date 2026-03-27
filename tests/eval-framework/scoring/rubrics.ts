/**
 * Eval Framework — Scoring Rubrics
 *
 * Defines point allocations for each dimension and its sub-metrics.
 * Used by the aggregator to convert raw measurements into dimension scores.
 */

import type { DimensionName, EvalDimension } from '../types.js';

// ---------------------------------------------------------------------------
// Dimension weights (must sum to 1.0)
// ---------------------------------------------------------------------------

export const DIMENSIONS: EvalDimension[] = [
  { name: 'ai-evals',        weight: 0.35 },
  { name: 'product-quality',  weight: 0.25 },
  { name: 'productivity',     weight: 0.25 },
  { name: 'user-value',       weight: 0.15 },
];

// ---------------------------------------------------------------------------
// AI Evals rubric (0-100 points)
// ---------------------------------------------------------------------------

export interface AIEvalsRubric {
  hallucination: number;      // 30 pts — lower rate = higher score
  correctness: number;        // 25 pts — fraction of correct results
  consistency: number;        // 20 pts — same result across N runs
  errorHandling: number;      // 15 pts — graceful errors on bad input
  schemaCompliance: number;   // 10 pts — response matches expected schema
}

export const AI_EVALS_WEIGHTS: Record<keyof AIEvalsRubric, number> = {
  hallucination: 30,
  correctness: 25,
  consistency: 20,
  errorHandling: 15,
  schemaCompliance: 10,
};

// ---------------------------------------------------------------------------
// Product Quality rubric (0-100 points)
// ---------------------------------------------------------------------------

export interface ProductQualityRubric {
  responseStructure: number;     // 25 pts — valid JSON, camelCase, no junk values
  errorMessages: number;         // 20 pts — structured error with code, problem, fix
  inputValidation: number;       // 20 pts — rejects bad input with good message
  latency: number;               // 20 pts — P95 latency scoring
  documentationMatch: number;    // 15 pts — tool does what description says
}

export const PRODUCT_QUALITY_WEIGHTS: Record<keyof ProductQualityRubric, number> = {
  responseStructure: 25,
  errorMessages: 20,
  inputValidation: 20,
  latency: 20,
  documentationMatch: 15,
};

// ---------------------------------------------------------------------------
// Productivity rubric (0-100 points)
// ---------------------------------------------------------------------------

export interface ProductivityRubric {
  taskCompletion: number;        // 30 pts — tool actually completes the task
  stepsSaved: number;            // 25 pts — manual steps eliminated
  crossAgentHandoffs: number;    // 25 pts — smooth inter-agent data flow
  automationCoverage: number;    // 20 pts — fraction of workflow automated
}

export const PRODUCTIVITY_WEIGHTS: Record<keyof ProductivityRubric, number> = {
  taskCompletion: 30,
  stepsSaved: 25,
  crossAgentHandoffs: 25,
  automationCoverage: 20,
};

// ---------------------------------------------------------------------------
// User Value rubric (0-100 points)
// ---------------------------------------------------------------------------

export interface UserValueRubric {
  actionability: number;         // 30 pts — response contains actionable next steps
  relevance: number;             // 25 pts — response addresses the question
  trustSignals: number;          // 25 pts — confidence scores, sources, caveats
  comparison: number;            // 20 pts — useful vs generic response
}

export const USER_VALUE_WEIGHTS: Record<keyof UserValueRubric, number> = {
  actionability: 30,
  relevance: 25,
  trustSignals: 25,
  comparison: 20,
};

// ---------------------------------------------------------------------------
// Grade thresholds
// ---------------------------------------------------------------------------

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function scoreToGrade(score: number): LetterGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Composite score formula
// ---------------------------------------------------------------------------

export function computeComposite(dimensionScores: Record<DimensionName, number>): number {
  return (
    dimensionScores['ai-evals'] * 0.35 +
    dimensionScores['product-quality'] * 0.25 +
    dimensionScores['productivity'] * 0.25 +
    dimensionScores['user-value'] * 0.15
  );
}

// ---------------------------------------------------------------------------
// Latency scoring helper (for Product Quality latency sub-metric)
// ---------------------------------------------------------------------------

export function scoreLatency(p95Ms: number): number {
  if (p95Ms < 200)  return 20;
  if (p95Ms < 500)  return 15;
  if (p95Ms < 1000) return 10;
  if (p95Ms < 2000) return 5;
  return 0;
}
