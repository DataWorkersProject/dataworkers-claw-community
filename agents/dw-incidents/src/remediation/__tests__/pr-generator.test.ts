import { describe, it, expect } from 'vitest';
import { PRGenerator } from '../pr-generator.js';
import type { PRGenerationRequest } from '../pr-generator.js';
import type { RootCauseAnalysis, IncidentType } from '../../types.js';

function makeRootCause(overrides?: Partial<RootCauseAnalysis>): RootCauseAnalysis {
  return {
    incidentId: 'inc-001',
    rootCause: 'Column "user_id" was dropped in upstream migration',
    causalChain: [
      { entity: 'users_table', entityType: 'table', issue: 'Column dropped', confidence: 0.95 },
      { entity: 'etl_pipeline', entityType: 'pipeline', issue: 'Schema mismatch', confidence: 0.88 },
    ],
    confidence: 0.92,
    evidenceSources: ['schema_diff', 'pipeline_logs'],
    traversalDepth: 3,
    analysisTimeMs: 150,
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<PRGenerationRequest>): PRGenerationRequest {
  return {
    incidentId: 'inc-001',
    incidentType: 'schema_change',
    rootCause: makeRootCause(),
    affectedResources: ['users_table', 'orders_pipeline'],
    ...overrides,
  };
}

describe('PRGenerator', () => {
  const generator = new PRGenerator();

  describe('generate()', () => {
    it('produces a valid GeneratedPR structure', () => {
      const pr = generator.generate(makeRequest());

      expect(pr.branchName).toBe('fix/incident-inc-001-schema_change');
      expect(pr.title).toContain('[Auto-Remediation]');
      expect(pr.title).toContain('schema change');
      expect(pr.title).toContain('users_table');
      expect(pr.body).toContain('## Root Cause Analysis');
      expect(pr.files).toEqual([]);
      expect(pr.labels).toContain('auto-remediation');
      expect(pr.labels).toContain('incident-schema_change');
      expect(pr.reviewers).toEqual([]);
    });

    it('includes root cause details in PR body', () => {
      const pr = generator.generate(makeRequest());

      expect(pr.body).toContain('**Type:** schema_change');
      expect(pr.body).toContain('**Confidence:** 92%');
      expect(pr.body).toContain('Column "user_id" was dropped');
    });

    it('includes causal chain in PR body', () => {
      const pr = generator.generate(makeRequest());

      expect(pr.body).toContain('### Causal Chain');
      expect(pr.body).toContain('1. **users_table** (table): Column dropped [95% confidence]');
      expect(pr.body).toContain('2. **etl_pipeline** (pipeline): Schema mismatch [88% confidence]');
    });

    it('includes evidence sources in PR body', () => {
      const pr = generator.generate(makeRequest());

      expect(pr.body).toContain('### Evidence Sources');
      expect(pr.body).toContain('- schema_diff');
      expect(pr.body).toContain('- pipeline_logs');
    });

    it('uses suggestedFix when provided', () => {
      const pr = generator.generate(makeRequest({ suggestedFix: 'Add the column back' }));

      expect(pr.body).toContain('Add the column back');
      expect(pr.body).not.toContain('Requires manual review');
    });

    it('uses fallback text when no suggestedFix', () => {
      const pr = generator.generate(makeRequest({ suggestedFix: undefined }));

      expect(pr.body).toContain('_Requires manual review');
    });

    it('handles multiple affected resources in title', () => {
      const pr = generator.generate(makeRequest({
        affectedResources: ['table_a', 'table_b', 'pipeline_c'],
      }));

      expect(pr.title).toContain('table_a, table_b, pipeline_c');
    });

    it('formats incident type with spaces in title', () => {
      const pr = generator.generate(makeRequest({ incidentType: 'resource_exhaustion' }));

      expect(pr.title).toContain('resource exhaustion');
    });
  });

  describe('suggestFix()', () => {
    it('returns schema_change suggestion', () => {
      const fix = generator.suggestFix('schema_change', 'Column dropped');
      expect(fix).toContain('dbt models');
      expect(fix).toContain('Column dropped');
    });

    it('returns source_delay suggestion', () => {
      const fix = generator.suggestFix('source_delay', 'API timeout');
      expect(fix).toContain('retry logic');
    });

    it('returns resource_exhaustion suggestion', () => {
      const fix = generator.suggestFix('resource_exhaustion', 'OOM');
      expect(fix).toContain('resource allocation');
    });

    it('returns code_regression suggestion', () => {
      const fix = generator.suggestFix('code_regression', 'Bad deploy');
      expect(fix).toContain('Rollback');
    });

    it('returns infrastructure suggestion', () => {
      const fix = generator.suggestFix('infrastructure', 'Network down');
      expect(fix).toContain('infrastructure health');
    });

    it('returns quality_degradation suggestion', () => {
      const fix = generator.suggestFix('quality_degradation', 'Null spike');
      expect(fix).toContain('data quality checks');
    });
  });
});
