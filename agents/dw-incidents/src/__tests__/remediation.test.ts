import { describe, it, expect } from 'vitest';
import { PlaybookRegistry } from '../remediation/playbook-registry.js';
import type { StepContext } from '../remediation/playbook-registry.js';
import { NovelIncidentReporter } from '../remediation/novel-reporter.js';
import type { RootCauseAnalysis } from '../types.js';

function makeStepContext(overrides?: Partial<StepContext>): StepContext {
  return {
    incidentId: 'inc-test-1',
    customerId: 'cust-test-1',
    incidentType: 'code_regression',
    orchestratorAPI: {
      restartTask: async () => ({ restartedAt: Date.now() }),
      getTaskStatus: async () => ({ status: 'running' }),
      scaleCompute: async () => ({ previousSize: 'S', newSize: 'M' }),
    },
    ...overrides,
  };
}

describe('PlaybookRegistry (REQ-INC-003)', () => {
  it('registers 5 built-in playbooks', () => {
    const registry = new PlaybookRegistry();
    expect(registry.listAll()).toHaveLength(5);
  });

  it('finds playbooks for incident type', () => {
    const registry = new PlaybookRegistry();
    const schemaPlaybooks = registry.findForIncidentType('schema_change');
    expect(schemaPlaybooks.length).toBeGreaterThan(0);
    expect(schemaPlaybooks[0].id).toBe('apply_schema_migration');
  });

  it('selects best playbook by confidence', () => {
    const registry = new PlaybookRegistry();
    const best = registry.selectBest('resource_exhaustion', 0.9);
    expect(best).not.toBeNull();
    expect(best!.id).toBe('scale_compute');
  });

  it('returns null when confidence too low', () => {
    const registry = new PlaybookRegistry();
    const best = registry.selectBest('resource_exhaustion', 0.5);
    expect(best).toBeNull();
  });

  it('executes playbook successfully', async () => {
    const registry = new PlaybookRegistry();
    const result = await registry.execute('restart_task', makeStepContext({ options: { taskId: 'task-1' } }));
    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(result.totalSteps);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns error for unknown playbook', async () => {
    const registry = new PlaybookRegistry();
    const result = await registry.execute('nonexistent' as any, makeStepContext());
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('all playbooks have rollback steps', () => {
    const registry = new PlaybookRegistry();
    for (const playbook of registry.listAll()) {
      expect(playbook.rollbackSteps.length).toBeGreaterThan(0);
    }
  });

  it('all playbooks have pre and post checks', () => {
    const registry = new PlaybookRegistry();
    for (const playbook of registry.listAll()) {
      expect(playbook.preChecks.length).toBeGreaterThan(0);
      expect(playbook.postChecks.length).toBeGreaterThan(0);
    }
  });

  it('supports custom playbook registration', () => {
    const registry = new PlaybookRegistry();
    registry.register({
      id: 'custom' as any,
      name: 'Custom Playbook',
      description: 'A custom remediation',
      applicableIncidentTypes: ['quality_degradation'],
      minConfidence: 0.8,
      estimatedDurationMs: 60_000,
      steps: [{ name: 'step1', action: 'do_thing', description: 'Do the thing', timeoutMs: 30_000, retryable: true }],
      rollbackSteps: [{ name: 'undo', action: 'undo_thing', description: 'Undo', timeoutMs: 30_000, retryable: false }],
      preChecks: ['check_ready'],
      postChecks: ['check_done'],
    });
    expect(registry.listAll()).toHaveLength(6);
  });
});

describe('NovelIncidentReporter (REQ-INC-004)', () => {
  const reporter = new NovelIncidentReporter();
  const mockRCA: RootCauseAnalysis = {
    incidentId: 'inc-novel-1',
    rootCause: 'Unknown data corruption in upstream source',
    causalChain: [
      { entity: 'orders', entityType: 'table', issue: 'NULL rate spike to 40%', confidence: 0.9 },
      { entity: 'source_api', entityType: 'infrastructure', issue: 'API returning partial data', confidence: 0.7 },
    ],
    confidence: 0.6,
    evidenceSources: ['lineage_graph', 'execution_logs'],
    traversalDepth: 2,
    analysisTimeMs: 500,
  };

  it('generates diagnosis report', () => {
    const report = reporter.generateReport(
      { id: 'inc-1', type: 'quality_degradation', severity: 'high', affectedResources: ['orders'] },
      mockRCA,
    );
    expect(report.requiresApproval).toBe(true);
    expect(report.confidence).toBe(0.6);
    expect(report.recommendedActions.length).toBeGreaterThan(0);
    expect(report.evidenceChain.length).toBe(2);
  });

  it('routes critical incidents to PagerDuty', () => {
    const report = reporter.generateReport(
      { id: 'inc-2', type: 'infrastructure', severity: 'critical', affectedResources: ['database'] },
      mockRCA,
    );
    expect(report.urgency).toBe('immediate');
    expect(report.approvalRouting.channel).toBe('pagerduty');
    expect(report.approvalRouting.priority).toBe('p1');
  });

  it('routes medium incidents to Slack', () => {
    const report = reporter.generateReport(
      { id: 'inc-3', type: 'quality_degradation', severity: 'medium', affectedResources: ['table'] },
      mockRCA,
    );
    expect(report.urgency).toBe('medium');
    expect(report.approvalRouting.channel).toBe('slack');
  });

  it('generates type-specific recommendations', () => {
    const codeReport = reporter.generateReport(
      { id: 'inc-4', type: 'code_regression', severity: 'high', affectedResources: ['pipeline'] },
      mockRCA,
    );
    expect(codeReport.recommendedActions.some((a) => a.action === 'review_recent_deploys')).toBe(true);
  });

  it('includes impact assessment', () => {
    const report = reporter.generateReport(
      { id: 'inc-5', type: 'schema_change', severity: 'high', affectedResources: ['a', 'b', 'c', 'd', 'e'] },
      mockRCA,
    );
    expect(report.estimatedImpact).toContain('5');
  });
});
