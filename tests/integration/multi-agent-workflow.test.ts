/**
 * Multi-agent workflow integration tests.
 *
 * Tests cross-agent workflows by importing tool handlers directly from agent
 * packages and verifying the output of one tool can feed into the next.
 * Uses InMemory backends (no Docker required).
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import MCP servers from agent packages to call tools directly
import { server as pipelinesServer } from '../../agents/dw-pipelines/src/index.js';
import { server as incidentsServer } from '../../agents/dw-incidents/src/index.js';
// dw-cost removed (paid agent)

// Import backends for event verification and cleanup
import { messageBus as pipelinesMessageBus } from '../../agents/dw-pipelines/src/backends.js';
import { messageBus as incidentsMessageBus } from '../../agents/dw-incidents/src/backends.js';

// Import types for structured assertions
import type { PipelineSpec } from '../../agents/dw-pipelines/src/types.js';
import type { Diagnosis, RootCauseAnalysis, RemediationResult } from '../../agents/dw-incidents/src/types.js';

// ---------------------------------------------------------------------------
// Workflow 1: Pipeline creation -> validation -> deployment (dw-pipelines)
// ---------------------------------------------------------------------------
describe('Workflow 1: Pipeline creation -> validation -> deployment', () => {
  beforeEach(async () => {
    await pipelinesMessageBus.clear();
  });

  // generate_pipeline is stripped in OSS (returns pro_feature error).
  // Test that the stub correctly returns an upgrade CTA.
  it('generate_pipeline returns pro_feature upgrade CTA in OSS', async () => {
    const genResult = await pipelinesServer.callTool('generate_pipeline', {
      description: 'Extract daily sales from Snowflake, transform with dbt, load into BigQuery',
      customerId: 'cust-integration',
    });

    const parsed = JSON.parse(genResult.content[0].text!);
    expect(parsed.error).toBe('pro_feature');
    expect(parsed.upgrade_url).toBeDefined();
  });

  it('validate_pipeline works with a hand-crafted spec', async () => {
    const spec: PipelineSpec = {
      id: 'pipe-int-001',
      name: 'daily-orders-etl',
      description: 'Integration test pipeline',
      version: 1,
      status: 'draft',
      orchestrator: 'airflow',
      codeLanguage: 'sql',
      tasks: [
        { id: 't0', name: 'extract', type: 'extract', description: 'Extract', code: 'SELECT 1', codeLanguage: 'sql', dependencies: [], config: {} },
        { id: 't1', name: 'transform', type: 'transform', description: 'Transform', code: 'SELECT 1', codeLanguage: 'sql', dependencies: ['t0'], config: {} },
        { id: 't2', name: 'load', type: 'load', description: 'Load', code: 'INSERT INTO t SELECT 1', codeLanguage: 'sql', dependencies: ['t1'], config: {} },
      ],
      qualityTests: [],
      retryPolicy: { maxRetries: 3, delaySeconds: 60, backoffMultiplier: 2 },
      metadata: { author: 'test', agentId: 'dw-pipelines', customerId: 'cust-integration', sourceDescription: 'test', generatedAt: Date.now(), confidence: 0.9, tags: ['etl'] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const valResult = await pipelinesServer.callTool('validate_pipeline', {
      pipelineSpec: spec,
      customerId: 'cust-integration',
    });

    const report = JSON.parse(valResult.content[0].text!);
    expect(report.valid).toBe(true);
    expect(report.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('deploy_pipeline returns pro_feature upgrade CTA in OSS', async () => {
    const spec: PipelineSpec = {
      id: 'pipe-int-002',
      name: 'daily-orders-etl',
      description: 'Integration test pipeline',
      version: 1,
      status: 'draft',
      orchestrator: 'airflow',
      codeLanguage: 'sql',
      tasks: [
        { id: 't0', name: 'extract', type: 'extract', description: 'Extract', code: 'SELECT 1', codeLanguage: 'sql', dependencies: [], config: {} },
      ],
      qualityTests: [],
      retryPolicy: { maxRetries: 3, delaySeconds: 60, backoffMultiplier: 2 },
      metadata: { author: 'test', agentId: 'dw-pipelines', customerId: 'cust-integration', sourceDescription: 'test', generatedAt: Date.now(), confidence: 0.9, tags: ['etl'] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const deployResult = await pipelinesServer.callTool('deploy_pipeline', {
      pipelineSpec: spec,
      customerId: 'cust-integration',
      environment: 'staging',
    });

    const deployment = JSON.parse(deployResult.content[0].text!);
    expect(deployment.error).toBe('pro_feature');
    expect(deployment.upgrade_url).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Workflow 2: Incident detection -> RCA -> remediation (dw-incidents)
// ---------------------------------------------------------------------------
describe('Workflow 2: Incident detection -> RCA -> remediation', () => {
  beforeEach(async () => {
    await incidentsMessageBus.clear();
  });

  it('diagnose_incident output feeds into get_root_cause', async () => {
    // Step 1: Diagnose an incident from anomaly signals
    const diagResult = await incidentsServer.callTool('diagnose_incident', {
      anomalySignals: [
        {
          metric: 'schema_column_count',
          value: 18,
          expected: 12,
          deviation: 4.0,
          source: 'orders',
          timestamp: Date.now(),
        },
      ],
      customerId: 'cust-integration',
    });

    const diagnosis = JSON.parse(diagResult.content[0].text!) as Diagnosis;
    expect(diagnosis.incidentId).toBeDefined();
    expect(diagnosis.type).toBe('schema_change');
    expect(diagnosis.affectedResources).toContain('orders');

    // Step 2: Feed diagnosis output into RCA
    const rcaResult = await incidentsServer.callTool('get_root_cause', {
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      affectedResources: diagnosis.affectedResources,
      customerId: 'cust-integration',
    });

    const rca = JSON.parse(rcaResult.content[0].text!) as RootCauseAnalysis;
    expect(rca.incidentId).toBe(diagnosis.incidentId);
    expect(rca.causalChain.length).toBeGreaterThan(0);
    expect(rca.rootCause).toBeTruthy();
    expect(rca.evidenceSources).toContain('lineage_graph');
  });

  it('RCA output feeds into remediate for auto-remediation', async () => {
    // Step 1: Diagnose
    const diagResult = await incidentsServer.callTool('diagnose_incident', {
      anomalySignals: [
        {
          metric: 'memory_usage_percent',
          value: 98,
          expected: 50,
          deviation: 7.0,
          source: 'warehouse_primary',
          timestamp: Date.now(),
        },
      ],
      customerId: 'cust-integration',
    });
    const diagnosis = JSON.parse(diagResult.content[0].text!) as Diagnosis;
    expect(diagnosis.type).toBe('resource_exhaustion');

    // Step 2: RCA
    const rcaResult = await incidentsServer.callTool('get_root_cause', {
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      affectedResources: diagnosis.affectedResources,
      customerId: 'cust-integration',
    });
    const rca = JSON.parse(rcaResult.content[0].text!) as RootCauseAnalysis;
    expect(rca.confidence).toBeGreaterThan(0);

    // Step 3: Feed diagnosis + RCA into remediation
    const remResult = await incidentsServer.callTool('remediate', {
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      confidence: diagnosis.confidence,
      customerId: 'cust-integration',
    });
    const remediation = JSON.parse(remResult.content[0].text!) as RemediationResult;
    expect(remediation.incidentId).toBe(diagnosis.incidentId);
    expect(remediation.actionsPerformed.length).toBeGreaterThan(0);
  });

  it('full incident flow publishes events at each stage', async () => {
    // Step 1: Diagnose -> publishes incident_detected
    const diagResult = await incidentsServer.callTool('diagnose_incident', {
      anomalySignals: [
        {
          metric: 'cpu_usage',
          value: 99,
          expected: 40,
          deviation: 8.0,
          source: 'warehouse',
          timestamp: Date.now(),
        },
      ],
      customerId: 'cust-integration',
    });
    const diagnosis = JSON.parse(diagResult.content[0].text!) as Diagnosis;

    const detectedEvents = await incidentsMessageBus.getEvents('incident_detected');
    expect(detectedEvents.length).toBeGreaterThan(0);
    expect(detectedEvents[detectedEvents.length - 1].payload.incidentId).toBe(diagnosis.incidentId);

    // Step 2: RCA (no event publication, just analysis)
    await incidentsServer.callTool('get_root_cause', {
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      affectedResources: diagnosis.affectedResources,
      customerId: 'cust-integration',
    });

    // Step 3: Remediate with high confidence -> publishes incident_remediated
    await incidentsServer.callTool('remediate', {
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      confidence: 0.96,
      customerId: 'cust-integration',
    });

    const remediatedEvents = await incidentsMessageBus.getEvents('incident_remediated');
    expect(remediatedEvents.length).toBeGreaterThan(0);
    const lastRemediated = remediatedEvents[remediatedEvents.length - 1];
    expect(lastRemediated.payload.incidentId).toBe(diagnosis.incidentId);
    expect(lastRemediated.payload.automated).toBe(true);
  });

  it('low confidence diagnosis routes to escalation instead of remediation', async () => {
    // Diagnose with moderate deviation (low confidence)
    const diagResult = await incidentsServer.callTool('diagnose_incident', {
      anomalySignals: [
        {
          metric: 'error_rate',
          value: 0.08,
          expected: 0.05,
          deviation: 1.5,
          source: 'api_server',
          timestamp: Date.now(),
        },
      ],
      customerId: 'cust-integration',
    });
    const diagnosis = JSON.parse(diagResult.content[0].text!) as Diagnosis;

    // Remediate with low confidence -> should escalate
    const remResult = await incidentsServer.callTool('remediate', {
      incidentId: diagnosis.incidentId,
      incidentType: diagnosis.type,
      confidence: 0.5,
      customerId: 'cust-integration',
    });
    const remediation = JSON.parse(remResult.content[0].text!) as RemediationResult;
    expect(remediation.automated).toBe(false);
    expect(remediation.actionsPerformed).toContain('Routed to human approval queue');

    // Verify escalation event was published
    const escalatedEvents = await incidentsMessageBus.getEvents('incident_escalated');
    expect(escalatedEvents.length).toBeGreaterThan(0);
  });
});

