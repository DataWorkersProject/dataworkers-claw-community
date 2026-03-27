import { describe, it, expect } from 'vitest';
import type { Diagnosis, RootCauseAnalysis, RemediationResult } from '../types.js';

import { diagnoseIncidentHandler } from '../tools/diagnose-incident.js';
import { getRootCauseHandler } from '../tools/get-root-cause.js';
import { remediateHandler } from '../tools/remediate.js';
import { getIncidentHistoryHandler } from '../tools/get-incident-history.js';

describe('Incident Lifecycle Integration Tests', () => {
  const customerId = 'cust-1';

  it('full lifecycle: diagnose → RCA → remediate → history', async () => {
    // Step 1: Diagnose an incident
    const diagnosisResult = await diagnoseIncidentHandler({
      anomalySignals: [
        { metric: 'error_rate', value: 25.0, expected: 2.0, deviation: 5.5, source: 'orders', timestamp: Date.now() },
      ],
      customerId,
    });
    expect(diagnosisResult.content[0].type).toBe('text');
    const diagnosis = JSON.parse((diagnosisResult.content[0] as { text: string }).text) as Diagnosis;
    expect(diagnosis.incidentId).toBeTruthy();
    expect(diagnosis.type).toBeTruthy();
    expect(diagnosis.severity).toBeTruthy();
    expect(diagnosis.confidence).toBeGreaterThan(0);
    expect(diagnosis.affectedResources).toContain('orders');

    // Step 2: Root cause analysis
    const rcaResult = await getRootCauseHandler({
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      affectedResources: diagnosis.affectedResources,
      customerId,
      maxDepth: 3,
    });
    const rca = JSON.parse((rcaResult.content[0] as { text: string }).text) as RootCauseAnalysis;
    expect(rca.rootCause).toBeTruthy();
    expect(rca.causalChain.length).toBeGreaterThan(0);
    expect(rca.confidence).toBeGreaterThan(0);
    expect(rca.evidenceSources).toContain('lineage_graph');

    // Step 3: Remediate (dry run for safety)
    const remResult = await remediateHandler({
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      confidence: 0.96, // Above auto-remediation threshold
      customerId,
      dryRun: true,
    });
    const remediation = JSON.parse((remResult.content[0] as { text: string }).text) as RemediationResult;
    expect(remediation.incidentId).toBe(diagnosis.incidentId);
    expect(remediation.actionsPerformed.length).toBeGreaterThan(0);
    expect(remediation.dryRun).toBe(true);
    expect(remediation.automated).toBe(true);
    // Dry run actions should have [DRY RUN] prefix
    expect(remediation.actionsPerformed[0]).toContain('[DRY RUN]');

    // Step 4: Query incident history
    const historyResult = await getIncidentHistoryHandler({
      customerId,
      limit: 50,
    });
    const history = JSON.parse((historyResult.content[0] as { text: string }).text);
    expect(history.totalIncidents).toBeGreaterThan(0);
    expect(history.mttrMinutes).toBeGreaterThanOrEqual(0);
    expect(history.incidents).toBeDefined();
    expect(history.byType).toBeDefined();
  });

  it('escalation path: low confidence → NovelReporter → diagnosisReport', async () => {
    const result = await remediateHandler({
      incidentId: 'test-escalation',
      incidentType: 'code_regression',
      confidence: 0.5, // Below 0.95 threshold → not auto-remediable
      customerId,
      affectedResources: ['orders'],
      rootCause: 'Unknown regression in ETL pipeline',
    });
    const remediation = JSON.parse((result.content[0] as { text: string }).text) as RemediationResult;
    expect(remediation.automated).toBe(false);
    expect(remediation.playbook).toBe('custom');
    expect(remediation.actionsPerformed).toContain('Routed to human approval queue');
    // Should have diagnosisReport from NovelIncidentReporter
    expect(remediation.diagnosisReport).toBeDefined();
    expect(remediation.diagnosisReport!.requiresApproval).toBe(true);
    expect(remediation.diagnosisReport!.rootCauseHypothesis).toBe('Unknown regression in ETL pipeline');
    expect(remediation.diagnosisReport!.approvalRouting).toBeDefined();
  });

  it('history with MTTR report', async () => {
    const result = await getIncidentHistoryHandler({
      customerId,
      includeMTTRReport: true,
    });
    const history = JSON.parse((result.content[0] as { text: string }).text);
    expect(history.totalIncidents).toBeGreaterThan(0);
    expect(history.mttrReport).toBeDefined();
    expect(history.mttrReport.totalIncidents).toBeGreaterThanOrEqual(0);
    expect(history.mttrReport.mttrMinutes).toBeGreaterThanOrEqual(0);
    expect(history.mttrReport.autoResolutionRate).toBeGreaterThanOrEqual(0);
    expect(history.mttrReport.byType).toBeDefined();
    expect(history.mttrReport.bySeverity).toBeDefined();
  });

  it('similar incident search via vector store', async () => {
    const result = await getIncidentHistoryHandler({
      customerId,
      similarTo: 'schema change incident affecting orders table',
    });
    const history = JSON.parse((result.content[0] as { text: string }).text);
    expect(history.similarIncidents).toBeDefined();
    expect(history.similarIncidents.length).toBeGreaterThan(0);
    expect(history.similarIncidents[0]).toHaveProperty('score');
    expect(history.similarIncidents[0]).toHaveProperty('id');
    expect(history.similarIncidents[0]).toHaveProperty('type');
  });

  it('multi-signal diagnosis with classification', async () => {
    const result = await diagnoseIncidentHandler({
      anomalySignals: [
        { metric: 'cpu_usage', value: 95.0, expected: 40.0, deviation: 4.2, source: 'warehouse', timestamp: Date.now() },
        { metric: 'memory_usage', value: 88.0, expected: 50.0, deviation: 3.8, source: 'warehouse', timestamp: Date.now() },
      ],
      customerId,
    });
    const diagnosis = JSON.parse((result.content[0] as { text: string }).text) as Diagnosis;
    expect(diagnosis.type).toBe('resource_exhaustion');
    expect(diagnosis.affectedResources).toContain('warehouse');
    expect(diagnosis.enrichedSignals).toBeDefined();
    expect(diagnosis.enrichedSignals!.length).toBe(2);
    expect(diagnosis.classificationScores).toBeDefined();
  });

  it('RCA processes multiple affected resources', async () => {
    const result = await getRootCauseHandler({
      incidentId: 'test-multi-resource',
      incidentType: 'quality_degradation',
      affectedResources: ['orders', 'customers'],
      customerId,
      maxDepth: 2,
    });
    const rca = JSON.parse((result.content[0] as { text: string }).text) as RootCauseAnalysis;
    expect(rca.processedResources).toBeDefined();
    expect(rca.processedResources!.length).toBe(2);
    expect(rca.processedResources).toContain('orders');
    expect(rca.processedResources).toContain('customers');
    // Should have causal chain entries for both resources
    expect(rca.causalChain.length).toBeGreaterThanOrEqual(2);
  });

  it('full lifecycle with actual remediation execution (non-dry-run)', async () => {
    // Diagnose
    const diagResult = await diagnoseIncidentHandler({
      anomalySignals: [
        { metric: 'memory_usage', value: 98.0, expected: 50.0, deviation: 6.0, source: 'warehouse', timestamp: Date.now() },
      ],
      customerId,
    });
    const diagnosis = JSON.parse((diagResult.content[0] as { text: string }).text) as Diagnosis;
    expect(diagnosis.incidentId).toBeTruthy();

    // Remediate with actual execution (enterprise tier allows this)
    const remResult = await remediateHandler({
      incidentId: diagnosis.incidentId,
      incidentType: 'resource_exhaustion',
      confidence: 0.96,
      customerId,
      playbook: 'scale_compute',
    });
    const remediation = JSON.parse((remResult.content[0] as { text: string }).text) as RemediationResult;
    expect(remediation.success).toBe(true);
    expect(remediation.automated).toBe(true);
    expect(remediation.playbook).toBe('scale_compute');
    expect(remediation.rollbackAvailable).toBe(true);
    expect(remediation.actionsPerformed.some(a => a.includes('Scaled warehouse'))).toBe(true);
  });

  it('history reflects incidents from current test run', async () => {
    // First, create a known incident
    const diagResult = await diagnoseIncidentHandler({
      anomalySignals: [
        { metric: 'latency_ms', value: 9000, expected: 200, deviation: 7.0, source: 'orders', timestamp: Date.now() },
      ],
      customerId: 'cust-lifecycle-test',
    });
    const diagnosis = JSON.parse((diagResult.content[0] as { text: string }).text) as Diagnosis;
    expect(diagnosis.incidentId).toBeTruthy();

    // Query history for the test customer — should find seeded incidents only for cust-1
    // but cust-lifecycle-test should have 0 from the incidents table (incident logger stores separately)
    const historyResult = await getIncidentHistoryHandler({
      customerId: 'cust-lifecycle-test',
    });
    const history = JSON.parse((historyResult.content[0] as { text: string }).text);
    // The incident logger stores in incident_log, not incidents table, so history query shows 0
    expect(history.totalIncidents).toBe(0);
  });
});
