import { describe, it, expect, beforeAll } from 'vitest';
import { server } from '../index.js';
import { addTestTable, relationalStore } from '../backends.js';
import { calculateQualityScore } from '../score-calculator.js';
import type { ProfileResult } from '../profiler.js';

describe('dw-quality MCP Server', () => {
  it('registers all 6 tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(6);
    expect(tools.map((t) => t.name)).toEqual([
      'run_quality_check', 'get_quality_score', 'set_sla', 'get_anomalies',
      'create_quality_tests_for_pipeline', 'get_quality_summary',
    ]);
  });

  describe('run_quality_check', () => {
    it('returns quality check with score and metrics', async () => {
      const result = await server.callTool('run_quality_check', {
        datasetId: 'orders', customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.overallScore).toBeGreaterThanOrEqual(0);
      expect(data.overallScore).toBeLessThanOrEqual(100);
      expect(data.metrics.length).toBeGreaterThan(0);
      expect(data.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('checks null rates, uniqueness, freshness, volume', async () => {
      const result = await server.callTool('run_quality_check', {
        datasetId: 'orders', customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      const metricTypes = data.metrics.map((m: { type: string }) => m.type);
      expect(metricTypes).toContain('null_rate');
      expect(metricTypes).toContain('uniqueness');
      expect(metricTypes).toContain('freshness');
      expect(metricTypes).toContain('volume');
    });

    it('returns graceful default for unknown dataset', async () => {
      const result = await server.callTool('run_quality_check', {
        datasetId: 'nonexistent_table', customerId: 'cust-1',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.datasetId).toBe('nonexistent_table');
      expect(data.status).toBe('no_data');
      expect(data.checks).toEqual([]);
      expect(data.summary).toBe('No quality data available for this dataset');
    });
  });

  describe('get_quality_score', () => {
    it('returns score with dimensional breakdown', async () => {
      const result = await server.callTool('get_quality_score', {
        datasetId: 'orders', customerId: 'cust-1',
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.score).toBeGreaterThanOrEqual(0);
      expect(data.score).toBeLessThanOrEqual(100);
      expect(data.breakdown.completeness).toBeDefined();
      expect(data.breakdown.accuracy).toBeDefined();
      expect(data.breakdown.freshness).toBeDefined();
      expect(data.trend).toBeDefined();
    });

    it('returns different scores for different datasets', async () => {
      // Add tables with different null characteristics to guarantee different scores
      addTestTable('dataset_a', false); // no nullable columns
      addTestTable('dataset_b', true);  // nullable columns

      const resultA = await server.callTool('get_quality_score', {
        datasetId: 'dataset_a', customerId: 'cust-1',
      });
      const resultB = await server.callTool('get_quality_score', {
        datasetId: 'dataset_b', customerId: 'cust-1',
      });
      const scoreA = JSON.parse(resultA.content[0].text!);
      const scoreB = JSON.parse(resultB.content[0].text!);

      expect(scoreA.datasetId).toBe('dataset_a');
      expect(scoreB.datasetId).toBe('dataset_b');
      // Different null characteristics must produce different scores
      expect(scoreA.score).not.toBe(scoreB.score);
    });

    it('table with 50% nulls scores lower than table with 0% nulls', async () => {
      // Add test tables: one with all nullable columns, one with none
      addTestTable('high_nulls_table', true);
      addTestTable('low_nulls_table', false);

      const highNullsResult = await server.callTool('get_quality_score', {
        datasetId: 'high_nulls_table', customerId: 'cust-1',
      });
      const lowNullsResult = await server.callTool('get_quality_score', {
        datasetId: 'low_nulls_table', customerId: 'cust-1',
      });
      const highNullsScore = JSON.parse(highNullsResult.content[0].text!);
      const lowNullsScore = JSON.parse(lowNullsResult.content[0].text!);

      expect(highNullsScore.score).toBeLessThan(lowNullsScore.score);
      expect(highNullsScore.breakdown.completeness).toBeLessThan(lowNullsScore.breakdown.completeness);
    });

    it('returns graceful default for unknown dataset', async () => {
      const result = await server.callTool('get_quality_score', {
        datasetId: 'nonexistent', customerId: 'cust-1',
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.datasetId).toBe('nonexistent');
      expect(data.score).toBeNull();
      expect(data.message).toBe('No quality score computed yet');
    });
  });

  describe('set_sla', () => {
    it('creates SLA with rules and persists to store', async () => {
      const result = await server.callTool('set_sla', {
        datasetId: 'orders', customerId: 'cust-1',
        rules: [
          { metric: 'freshness', operator: 'lte', threshold: 24, severity: 'critical', description: 'Must update within 24h' },
          { metric: 'null_rate', operator: 'lte', threshold: 0.05, severity: 'warning', description: 'Max 5% nulls' },
        ],
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.created).toBe(true);
      expect(data.sla.rules).toHaveLength(2);
      // Should include evaluation results
      expect(data.evaluation).toBeDefined();
      expect(data.evaluation.rulesEvaluated).toBe(2);
    });

    it('rejects invalid metric names', async () => {
      const result = await server.callTool('set_sla', {
        datasetId: 'orders', customerId: 'cust-1',
        rules: [
          { metric: 'invalid_metric', operator: 'lte', threshold: 10, severity: 'warning', description: 'bad metric' },
        ],
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toContain('Invalid metric');
      expect(data.error).toContain('invalid_metric');
    });

    it('supports dryRun mode without persisting', async () => {
      const result = await server.callTool('set_sla', {
        datasetId: 'orders', customerId: 'cust-1',
        dryRun: true,
        rules: [
          { metric: 'freshness', operator: 'lte', threshold: 24, severity: 'critical', description: 'Must update within 24h' },
        ],
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.created).toBe(false);
      expect(data.dryRun).toBe(true);
      expect(data.sla.rules).toHaveLength(1);
      expect(data.message).toContain('Dry run');
    });

    it('evaluates current data against SLA rules after creation', async () => {
      // Inject a metric value first
      await relationalStore.insert('quality_metrics', {
        datasetId: 'sla-eval-test',
        customerId: 'cust-sla',
        metric: 'null_rate',
        value: 0.15,
        timestamp: Date.now(),
      });

      const result = await server.callTool('set_sla', {
        datasetId: 'sla-eval-test', customerId: 'cust-sla',
        rules: [
          { metric: 'null_rate', operator: 'lte', threshold: 0.05, severity: 'critical', description: 'Max 5% nulls' },
        ],
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.created).toBe(true);
      expect(data.evaluation.violations).toBe(1);
      expect(data.evaluation.results[0].passed).toBe(false);
      expect(data.evaluation.results[0].actualValue).toBe(0.15);
    });
  });

  describe('get_anomalies', () => {
    it('returns anomalies from seeded 14-day baseline', async () => {
      const result = await server.callTool('get_anomalies', {
        customerId: 'cust-1', datasetId: 'orders',
      });
      const data = JSON.parse(result.content[0].text!);
      // With stable seed data, there should be 0 anomalies (no spikes)
      expect(data.totalAnomalies).toBeGreaterThanOrEqual(0);
      expect(data.anomalies).toBeDefined();
      expect(Array.isArray(data.anomalies)).toBe(true);
    });

    it('detects anomaly after injecting null rate spike', async () => {
      // The relational store already has 14 days of stable null_rate data (~0.02-0.05)
      // Inject a spike: null_rate = 0.15 (3x the normal range)
      await relationalStore.insert('quality_metrics', {
        datasetId: 'orders',
        customerId: 'cust-1',
        metric: 'null_rate',
        value: 0.15,
        timestamp: Date.now(),
      });

      const result = await server.callTool('get_anomalies', {
        customerId: 'cust-1', datasetId: 'orders',
      });
      const data = JSON.parse(result.content[0].text!);

      // Should detect the null_rate spike as an anomaly
      expect(data.totalAnomalies).toBeGreaterThan(0);
      const nullRateAnomaly = data.anomalies.find(
        (a: { metric: string }) => a.metric.includes('null_rate'),
      );
      expect(nullRateAnomaly).toBeDefined();
      expect(nullRateAnomaly.value).toBe(0.15);
    });

    it('returns bootstrap mode with insufficient data points', async () => {
      // Create a new dataset with only 3 data points
      for (let i = 0; i < 3; i++) {
        await relationalStore.insert('quality_metrics', {
          datasetId: 'new_dataset',
          customerId: 'cust-bootstrap',
          metric: 'null_rate',
          value: 0.03,
          timestamp: Date.now() - i * 86400000,
        });
      }

      const result = await server.callTool('get_anomalies', {
        customerId: 'cust-bootstrap', datasetId: 'new_dataset',
      });
      const data = JSON.parse(result.content[0].text!);

      expect(data.bootstrapMode).toBe(true);
      expect(data.message).toContain('baseline');
      expect(data.totalAnomalies).toBe(0);
    });

    it('filters by severity', async () => {
      const result = await server.callTool('get_anomalies', {
        customerId: 'cust-1', severity: 'critical',
      });
      const data = JSON.parse(result.content[0].text!);
      if (data.anomalies.length > 0) {
        expect(data.anomalies.every((a: { severity: string }) => a.severity === 'critical')).toBe(true);
      }
    });
  });

  describe('E2E Quality Workflow', () => {
    it('check -> score -> set SLA -> get anomalies', async () => {
      // Step 1: Run check (use cust-1 which has seeded tables)
      const checkResult = await server.callTool('run_quality_check', {
        datasetId: 'products', customerId: 'cust-1',
      });
      const check = JSON.parse(checkResult.content[0].text!);
      expect(check.overallScore).toBeGreaterThanOrEqual(0);

      // Step 2: Get score
      const scoreResult = await server.callTool('get_quality_score', {
        datasetId: 'products', customerId: 'cust-1',
      });
      const score = JSON.parse(scoreResult.content[0].text!);
      expect(score.score).toBeGreaterThanOrEqual(0);

      // Step 3: Set SLA
      const slaResult = await server.callTool('set_sla', {
        datasetId: 'products', customerId: 'cust-1',
        rules: [{ metric: 'freshness', operator: 'lte', threshold: 12, severity: 'critical', description: '12h freshness' }],
      });
      expect(JSON.parse(slaResult.content[0].text!).created).toBe(true);

      // Step 4: Get anomalies
      const anomResult = await server.callTool('get_anomalies', { customerId: 'cust-1' });
      const anomalies = JSON.parse(anomResult.content[0].text!);
      expect(anomalies.totalAnomalies).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('score-calculator edge cases', () => {
  function makeProfile(overrides: Partial<ProfileResult> = {}): ProfileResult {
    return {
      totalRows: 1000,
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, totalRows: 1000, nullCount: 0, nullRate: 0, distinctCount: 1000, distinctRatio: 1.0 },
      ],
      freshnessHours: 1,
      profiledAt: Date.now(),
      ...overrides,
    };
  }

  it('freshness score is 100 at exactly 6 hours', () => {
    const profile = makeProfile({ freshnessHours: 6 });
    const result = calculateQualityScore('test-dataset', profile);
    expect(result.breakdown.freshness).toBe(100);
  });

  it('freshness score is 0 at 48 hours', () => {
    const profile = makeProfile({ freshnessHours: 48 });
    const result = calculateQualityScore('test-dataset', profile);
    expect(result.breakdown.freshness).toBe(0);
  });

  it('trend is improving with rising scores', () => {
    const profile = makeProfile();
    const result = calculateQualityScore('test-dataset', profile, [], [70, 75, 80]);
    expect(result.trend).toBe('improving');
  });

  it('trend is declining with falling scores', () => {
    const profile = makeProfile();
    const result = calculateQualityScore('test-dataset', profile, [], [80, 75, 70]);
    expect(result.trend).toBe('declining');
  });

  it('consistency penalizes large row count deviation', () => {
    // Current totalRows = 1000, historical average = 100 -> 900% deviation
    const profile = makeProfile({ totalRows: 1000 });
    const result = calculateQualityScore('test-dataset', profile, [100, 100, 100], []);
    expect(result.breakdown.consistency).toBeLessThan(100);
  });
});
