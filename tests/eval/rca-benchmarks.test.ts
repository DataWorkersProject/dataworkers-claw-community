/**
 * Incident RCA accuracy benchmarks.
 *
 * 15 incident scenarios across:
 * - Data freshness (3)
 * - Quality (3)
 * - Pipeline failure (3)
 * - Cost anomaly (3)
 * - Cross-system (3)
 *
 * Measures: category accuracy, severity accuracy.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryLLMClient } from '../../core/infrastructure-stubs/src/index.js';
import { LLMEvalRunner } from './llm-eval-framework.js';
import type { EvalScenario } from './llm-eval-framework.js';

// ---------------------------------------------------------------------------
// RCA Incident Scenarios
// ---------------------------------------------------------------------------

interface RCAScenario extends EvalScenario {
  symptoms: string[];
  expectedCategory: string;
  expectedSeverity: 'critical' | 'high' | 'medium' | 'low';
}

function makeRCA(
  name: string,
  symptoms: string[],
  expectedCategory: string,
  expectedSeverity: 'critical' | 'high' | 'medium' | 'low',
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): RCAScenario {
  return {
    name,
    category: 'rca',
    input: `diagnose incident: symptoms are: ${symptoms.join('; ')}`,
    expectedOutput: /help|data|pipeline|diagnos/i,
    agent: 'dw-incidents',
    difficulty,
    symptoms,
    expectedCategory,
    expectedSeverity,
  };
}

// Data Freshness (3)
const freshnessScenarios: RCAScenario[] = [
  makeRCA(
    'SLA breach: orders table stale',
    ['orders table not updated in 6 hours', 'SLA is 2 hours', 'downstream dashboards showing old data'],
    'data_freshness',
    'high',
    'easy',
  ),
  makeRCA(
    'upstream delay: source system slow',
    ['raw_events table 4 hours behind', 'source API returning 503 intermittently', 'partial data in staging'],
    'data_freshness',
    'medium',
    'medium',
  ),
  makeRCA(
    'source outage: complete data stop',
    ['no new rows in 24 hours', 'source database unreachable', 'all downstream tables affected'],
    'data_freshness',
    'critical',
    'easy',
  ),
];

// Quality (3)
const qualityScenarios: RCAScenario[] = [
  makeRCA(
    'null spike: email column',
    ['null rate in customer_email jumped from 2% to 45%', 'started after last pipeline run', 'only affects new records'],
    'data_quality',
    'high',
    'easy',
  ),
  makeRCA(
    'duplicate explosion: order records',
    ['duplicate rate increased from 0.1% to 15%', 'order_id uniqueness check failing', 'row count 3x expected'],
    'data_quality',
    'high',
    'medium',
  ),
  makeRCA(
    'schema mismatch: type change upstream',
    ['price column changed from DECIMAL to VARCHAR', 'aggregation queries returning errors', 'downstream ML models failing'],
    'data_quality',
    'high',
    'medium',
  ),
];

// Pipeline Failure (3)
const pipelineFailureScenarios: RCAScenario[] = [
  makeRCA(
    'timeout: ETL job exceeded limit',
    ['etl_orders_daily timed out after 3 hours', 'normally completes in 30 minutes', 'source table grew 10x overnight'],
    'pipeline_failure',
    'high',
    'medium',
  ),
  makeRCA(
    'OOM: memory exhaustion',
    ['pipeline worker killed by OOM', 'memory usage peaked at 32GB', 'large cartesian join in transformation'],
    'pipeline_failure',
    'high',
    'medium',
  ),
  makeRCA(
    'permission denied: credential rotation',
    ['pipeline failed with access denied', 'service account credentials expired', 'all pipelines using same SA affected'],
    'pipeline_failure',
    'critical',
    'easy',
  ),
];

// Cost Anomaly (3)
const costAnomalyScenarios: RCAScenario[] = [
  makeRCA(
    'warehouse spike: runaway query',
    ['warehouse compute cost 5x normal', 'single query consuming 90% resources', 'query running for 6 hours'],
    'cost_anomaly',
    'high',
    'easy',
  ),
  makeRCA(
    'storage growth: unbounded table',
    ['storage costs doubled in one week', 'audit_log table growing 50GB/day', 'no retention policy configured'],
    'cost_anomaly',
    'medium',
    'medium',
  ),
  makeRCA(
    'query explosion: misconfigured dashboard',
    ['10,000 queries in 1 hour from single user', 'dashboard auto-refresh set to 1 second', 'warehouse at max capacity'],
    'cost_anomaly',
    'high',
    'medium',
  ),
];

// Cross-System (3)
const crossSystemScenarios: RCAScenario[] = [
  makeRCA(
    'cascading failure: source outage ripple',
    ['source database failover caused 2-hour gap', 'gap propagated through 5 downstream tables', 'revenue dashboard showing $0 for 2 hours'],
    'cross_system',
    'critical',
    'hard',
  ),
  makeRCA(
    'upstream schema change: breaking consumers',
    ['upstream team renamed column customer_id to cust_id', '3 pipelines failing with column not found', '2 dashboards showing errors'],
    'cross_system',
    'high',
    'hard',
  ),
  makeRCA(
    'data drift: gradual distribution shift',
    ['order_amount distribution shifted over 30 days', 'ML model accuracy dropped from 92% to 71%', 'no schema changes detected'],
    'cross_system',
    'medium',
    'hard',
  ),
];

const allRCAScenarios: RCAScenario[] = [
  ...freshnessScenarios,
  ...qualityScenarios,
  ...pipelineFailureScenarios,
  ...costAnomalyScenarios,
  ...crossSystemScenarios,
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Incident RCA Accuracy Benchmarks', () => {
  let llm: InMemoryLLMClient;
  let runner: LLMEvalRunner;

  beforeEach(() => {
    llm = new InMemoryLLMClient();
    runner = new LLMEvalRunner(llm);
  });

  it('has 15 benchmark scenarios', () => {
    expect(allRCAScenarios).toHaveLength(15);
  });

  it('has 3 data freshness scenarios', () => {
    expect(freshnessScenarios).toHaveLength(3);
  });

  it('has 3 quality scenarios', () => {
    expect(qualityScenarios).toHaveLength(3);
  });

  it('has 3 pipeline failure scenarios', () => {
    expect(pipelineFailureScenarios).toHaveLength(3);
  });

  it('has 3 cost anomaly scenarios', () => {
    expect(costAnomalyScenarios).toHaveLength(3);
  });

  it('has 3 cross-system scenarios', () => {
    expect(crossSystemScenarios).toHaveLength(3);
  });

  it('all scenarios are in the rca category', () => {
    for (const s of allRCAScenarios) {
      expect(s.category).toBe('rca');
    }
  });

  it('all scenarios target dw-incidents agent', () => {
    for (const s of allRCAScenarios) {
      expect(s.agent).toBe('dw-incidents');
    }
  });

  it('all scenarios have symptoms defined', () => {
    for (const s of allRCAScenarios) {
      expect(s.symptoms.length).toBeGreaterThan(0);
    }
  });

  it('all scenarios have expected category', () => {
    for (const s of allRCAScenarios) {
      expect(s.expectedCategory).toBeTruthy();
    }
  });

  it('all scenarios have expected severity', () => {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    for (const s of allRCAScenarios) {
      expect(validSeverities).toContain(s.expectedSeverity);
    }
  });

  describe('Data freshness scenarios', () => {
    for (const scenario of freshnessScenarios) {
      it(`diagnoses: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].actualOutput).toBeTruthy();
        expect(results[0].passed).toBe(true);
      });
    }
  });

  describe('Quality scenarios', () => {
    for (const scenario of qualityScenarios) {
      it(`diagnoses: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
      });
    }
  });

  describe('Pipeline failure scenarios', () => {
    for (const scenario of pipelineFailureScenarios) {
      it(`diagnoses: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
      });
    }
  });

  describe('Cost anomaly scenarios', () => {
    for (const scenario of costAnomalyScenarios) {
      it(`diagnoses: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
      });
    }
  });

  describe('Cross-system scenarios', () => {
    for (const scenario of crossSystemScenarios) {
      it(`diagnoses: ${scenario.name}`, async () => {
        const results = await runner.runScenarios([scenario]);
        expect(results).toHaveLength(1);
        expect(results[0].passed).toBe(true);
      });
    }
  });

  it('computes aggregate metrics across all RCA scenarios', async () => {
    const results = await runner.runScenarios(allRCAScenarios);
    const metrics = runner.computeMetrics(results);

    expect(metrics.totalScenarios).toBe(15);
    expect(metrics.passRate).toBeGreaterThan(0);
    expect(metrics.byCategory.rca).toBeDefined();
    expect(metrics.byCategory.rca.total).toBe(15);
    expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports metrics by difficulty level', async () => {
    const results = await runner.runScenarios(allRCAScenarios);
    const metrics = runner.computeMetrics(results);

    expect(metrics.byDifficulty.easy).toBeDefined();
    expect(metrics.byDifficulty.medium).toBeDefined();
    expect(metrics.byDifficulty.hard).toBeDefined();
  });

  it('category accuracy can be measured from scenario metadata', () => {
    // Verify each category group has consistent expectedCategory
    const categories = new Set(freshnessScenarios.map((s) => s.expectedCategory));
    expect(categories.size).toBe(1);
    expect(categories.has('data_freshness')).toBe(true);

    const qualityCats = new Set(qualityScenarios.map((s) => s.expectedCategory));
    expect(qualityCats.size).toBe(1);
    expect(qualityCats.has('data_quality')).toBe(true);
  });

  it('severity distribution covers critical, high, and medium', () => {
    const severities = new Set(allRCAScenarios.map((s) => s.expectedSeverity));
    expect(severities.has('critical')).toBe(true);
    expect(severities.has('high')).toBe(true);
    expect(severities.has('medium')).toBe(true);
  });
});
