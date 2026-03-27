import { describe, it, expect } from 'vitest';
import { OnboardingOrchestrator } from '../onboarding.js';
import { EvaluationFramework } from '../evaluation.js';
import { LoadTestRunner } from '../load-testing.js';
import { DeploymentManager } from '../deployment.js';
import { TokenBudgetManager } from '../../../context-layer/src/token-budget.js';
import { SemanticDefinitionInjector } from '../../../context-layer/src/semantic-injector.js';

describe('TokenBudgetManager (REQ-CTXE-001, REQ-CTXE-002)', () => {
  it('creates default Sonnet budget at 32K', () => {
    const mgr = new TokenBudgetManager();
    const budget = mgr.getBudget('dw-pipelines', 'sonnet');
    expect(budget.totalTokens).toBe(32_768);
    expect(budget.allocated.taskSpecific).toBeGreaterThan(budget.allocated.historical);
  });

  it('creates Haiku budget at 8K', () => {
    const mgr = new TokenBudgetManager();
    const budget = mgr.getBudget('dw-incidents', 'haiku');
    expect(budget.totalTokens).toBe(8_192);
  });

  it('enforces budget limits', () => {
    const mgr = new TokenBudgetManager();
    expect(mgr.recordUsage('agent-1', 'haiku', 5000)).toBe(true);
    expect(mgr.recordUsage('agent-1', 'haiku', 5000)).toBe(false); // Over 8K
  });

  it('supports custom overrides', () => {
    const mgr = new TokenBudgetManager();
    mgr.setOverride('special-agent', 'sonnet', 65_536);
    expect(mgr.getBudget('special-agent', 'sonnet').totalTokens).toBe(65_536);
  });
});

describe('SemanticDefinitionInjector (REQ-CTXE-005)', () => {
  it('injects definitions for business terms', () => {
    const injector = new SemanticDefinitionInjector();
    injector.registerTerm({
      term: 'revenue', canonicalDefinition: 'Total gross revenue from all orders',
      formula: 'SUM(orders.total_amount)', source: 'dbt_semantic_layer', aliases: ['gross revenue', 'total revenue'],
    });
    const injection = injector.generateInjection('Calculate the revenue by region');
    expect(injection).toContain('revenue');
    expect(injection).toContain('SUM(orders.total_amount)');
  });

  it('returns empty for no matches', () => {
    const injector = new SemanticDefinitionInjector();
    expect(injector.generateInjection('Hello world')).toBe('');
  });
});

describe('OnboardingOrchestrator (REQ-ONBOARD-001)', () => {
  it('onboards SaaS customer', async () => {
    const onboarding = new OnboardingOrchestrator();
    const result = await onboarding.onboard('cust-new', 'saas');
    expect(result.firstAgentOperational).toBe(true);
    expect(result.steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('VPC onboarding includes infrastructure provisioning', async () => {
    const onboarding = new OnboardingOrchestrator();
    const result = await onboarding.onboard('cust-vpc', 'vpc');
    expect(result.steps[0].name).toBe('provision_infrastructure');
  });
});

describe('EvaluationFramework (REQ-EVAL-005 through 009)', () => {
  it('runs benchmark suite', async () => {
    const eval_ = new EvaluationFramework();
    const result = await eval_.runBenchmark('claude-sonnet-4-20250514');
    expect(result.passedThresholds).toBe(true);
    expect(result.corpusSize).toBeGreaterThanOrEqual(500);
    expect(result.metrics.sqlSyntacticAccuracy).toBeGreaterThan(0.95);
  });

  it('detects regression', () => {
    const eval_ = new EvaluationFramework({ regressionBlockThreshold: 0.02 });
    const baseline = { benchmarkId: 'b1', modelVersion: 'v1', metrics: { sqlSyntacticAccuracy: 0.96, sqlSemanticAccuracy: 0.91, rcaPrecision: 0.86, schemaMigrationSafety: 1.0, falsePositiveRate: 0.08 }, corpusSize: 500, passedThresholds: true, executedAt: Date.now() };
    const candidate = { ...baseline, benchmarkId: 'b2', modelVersion: 'v2', metrics: { ...baseline.metrics, sqlSemanticAccuracy: 0.85 } };
    const check = eval_.checkRegression(baseline, candidate);
    expect(check.blocked).toBe(true);
    expect(check.regressions.length).toBeGreaterThan(0);
  });
});

describe('LoadTestRunner (REQ-NFR-008)', () => {
  it('runs 2x capacity load test', async () => {
    const runner = new LoadTestRunner();
    const result = await runner.run('2x_capacity', 100, 10000);
    expect(result.passed).toBe(true);
    expect(result.targetLoad.customers).toBe(100);
    expect(result.results.successRate).toBeGreaterThan(0.99);
  });
});

describe('DeploymentManager (REQ-ARCH-005)', () => {
  it('deploys SaaS multi-tenant', async () => {
    const mgr = new DeploymentManager();
    const result = await mgr.deploy({ type: 'saas', region: 'us-east-1', customerId: 'cust-1', agentsEnabled: ['dw-pipelines', 'dw-incidents'] });
    expect(result.success).toBe(true);
    expect(result.endpoint).toContain('saas');
  });

  it('validates deployment health', async () => {
    const mgr = new DeploymentManager();
    const health = await mgr.validateDeployment('cust-1');
    expect(health.healthy).toBe(true);
  });
});
