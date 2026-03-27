import { describe, it, expect } from 'vitest';
import { NovelIncidentReporter } from '../novel-reporter.js';

describe('NovelIncidentReporter', () => {
  const mockRCA = {
    incidentId: 'inc-1',
    rootCause: 'Unknown schema drift in upstream source',
    causalChain: [
      { entity: 'orders', entityType: 'table', issue: 'schema drift', confidence: 0.8, timestamp: Date.now() },
    ],
    confidence: 0.6,
    evidenceSources: ['lineage_graph', 'anomaly_detections'],
    traversalDepth: 2,
    analysisTimeMs: 150,
  } as any;

  it('generates a diagnosis report', () => {
    const reporter = new NovelIncidentReporter();
    const report = reporter.generateReport(
      { id: 'inc-1', type: 'schema_change', severity: 'high', affectedResources: ['orders'] },
      mockRCA,
    );
    expect(report.incidentId).toBe('inc-1');
    expect(report.requiresApproval).toBe(true);
    expect(report.urgency).toBe('high');
    expect(report.recommendedActions.length).toBeGreaterThan(0);
  });

  it('routes critical incidents to pagerduty', () => {
    const reporter = new NovelIncidentReporter();
    const report = reporter.generateReport(
      { id: 'inc-2', type: 'infrastructure', severity: 'critical', affectedResources: ['db'] },
      mockRCA,
    );
    expect(report.urgency).toBe('immediate');
    expect(report.approvalRouting.channel).toBe('pagerduty');
    expect(report.approvalRouting.priority).toBe('p1');
  });

  it('includes evidence chain in report', () => {
    const reporter = new NovelIncidentReporter();
    const report = reporter.generateReport({ id: 'inc-3' }, mockRCA);
    expect(report.evidenceChain.length).toBe(1);
    expect(report.evidenceChain[0]).toContain('orders');
  });
});
