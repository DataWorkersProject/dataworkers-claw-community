import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '../index.js';
import type { Diagnosis, RootCauseAnalysis, RemediationResult } from '../types.js';
import { messageBus } from '../backends.js';

describe('dw-incidents MCP Server', () => {
  beforeEach(async () => {
    await messageBus.clear();
  });

  it('registers all 5 tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.name)).toEqual([
      'diagnose_incident',
      'get_root_cause',
      'remediate',
      'get_incident_history',
      'monitor_metrics',
    ]);
  });

  describe('diagnose_incident', () => {
    it('classifies schema change incident', async () => {
      const result = await server.callTool('diagnose_incident', {
        anomalySignals: [{
          metric: 'schema_column_count',
          value: 15,
          expected: 12,
          deviation: 3.5,
          source: 'orders_table',
          timestamp: Date.now(),
        }],
        customerId: 'cust-1',
      });
      const diagnosis = JSON.parse(result.content[0].text!) as Diagnosis;
      expect(diagnosis.type).toBe('schema_change');
      expect(diagnosis.severity).toBe('high');
      expect(diagnosis.confidence).toBeGreaterThan(0.5);
    });

    it('classifies resource exhaustion', async () => {
      const result = await server.callTool('diagnose_incident', {
        anomalySignals: [{
          metric: 'memory_usage_percent',
          value: 98,
          expected: 60,
          deviation: 6.0,
          source: 'warehouse',
          timestamp: Date.now(),
        }],
        customerId: 'cust-1',
      });
      const diagnosis = JSON.parse(result.content[0].text!) as Diagnosis;
      expect(diagnosis.type).toBe('resource_exhaustion');
      expect(diagnosis.severity).toBe('critical');
    });

    it('suggests relevant actions', async () => {
      const result = await server.callTool('diagnose_incident', {
        anomalySignals: [{ metric: 'latency_ms', value: 5000, expected: 500, deviation: 4.0, source: 'api', timestamp: Date.now() }],
        customerId: 'cust-1',
      });
      const diagnosis = JSON.parse(result.content[0].text!) as Diagnosis;
      expect(diagnosis.suggestedActions.length).toBeGreaterThan(0);
    });

    it('publishes incident_detected Kafka event after diagnosis', async () => {
      await server.callTool('diagnose_incident', {
        anomalySignals: [{
          metric: 'schema_column_count',
          value: 15,
          expected: 12,
          deviation: 3.5,
          source: 'orders_table',
          timestamp: Date.now(),
        }],
        customerId: 'cust-1',
      });

      const events = await messageBus.getEvents('incident_detected');
      expect(events.length).toBeGreaterThan(0);
      const lastEvent = events[events.length - 1];
      expect(lastEvent.type).toBe('incident_detected');
      expect(lastEvent.payload.incidentType).toBe('schema_change');
      expect(lastEvent.customerId).toBe('cust-1');
    });

    it('queries real metric history from relational store', async () => {
      // Use 'orders' as source which has seeded quality_metrics data
      const result = await server.callTool('diagnose_incident', {
        anomalySignals: [{
          metric: 'null_rate',
          value: 0.25,
          expected: 0.03,
          deviation: 8.0,
          source: 'orders',
          timestamp: Date.now(),
        }],
        customerId: 'cust-1',
      });
      const diagnosis = JSON.parse(result.content[0].text!) as Diagnosis;
      expect(diagnosis.type).toBe('quality_degradation');
      expect(diagnosis.incidentId).toBeTruthy();
    });
  });

  describe('get_root_cause', () => {
    it('performs RCA with causal chain', async () => {
      const result = await server.callTool('get_root_cause', {
        incidentId: 'inc-1',
        incidentType: 'schema_change',
        affectedResources: ['orders_table'],
        customerId: 'cust-1',
      });
      const rca = JSON.parse(result.content[0].text!) as RootCauseAnalysis;
      expect(rca.causalChain.length).toBeGreaterThan(0);
      expect(rca.confidence).toBeGreaterThan(0);
      expect(rca.evidenceSources).toContain('lineage_graph');
    });

    it('respects max depth', async () => {
      const result = await server.callTool('get_root_cause', {
        incidentId: 'inc-2',
        incidentType: 'source_delay',
        affectedResources: ['source_table'],
        customerId: 'cust-1',
        maxDepth: 3,
      });
      const rca = JSON.parse(result.content[0].text!) as RootCauseAnalysis;
      expect(rca.traversalDepth).toBeLessThanOrEqual(3);
    });

    it('traverses real lineage graph (not hardcoded causal chain)', async () => {
      // Use 'orders' which exists in the seeded graph as tbl-1
      const result = await server.callTool('get_root_cause', {
        incidentId: 'inc-lineage-1',
        incidentType: 'quality_degradation',
        affectedResources: ['orders'],
        customerId: 'cust-1',
      });
      const rca = JSON.parse(result.content[0].text!) as RootCauseAnalysis;

      // Should have traversed upstream from orders -> raw_orders
      expect(rca.causalChain.length).toBeGreaterThan(1);
      const entityNames = rca.causalChain.map((c) => c.entity);
      expect(entityNames[0]).toBe('orders');
      // Upstream should include raw_orders (source for orders via tbl-1)
      expect(entityNames.some((n) => n.includes('raw_orders'))).toBe(true);
    });

    it('produces different RCA results for different tables', async () => {
      const ordersResult = await server.callTool('get_root_cause', {
        incidentId: 'inc-diff-1',
        incidentType: 'schema_change',
        affectedResources: ['orders'],
        customerId: 'cust-1',
      });
      const ordersRca = JSON.parse(ordersResult.content[0].text!) as RootCauseAnalysis;

      const customersResult = await server.callTool('get_root_cause', {
        incidentId: 'inc-diff-2',
        incidentType: 'schema_change',
        affectedResources: ['customers'],
        customerId: 'cust-1',
      });
      const customersRca = JSON.parse(customersResult.content[0].text!) as RootCauseAnalysis;

      // Different resources should produce different causal chains
      const ordersEntities = ordersRca.causalChain.map((c) => c.entity);
      const customersEntities = customersRca.causalChain.map((c) => c.entity);
      expect(ordersEntities).not.toEqual(customersEntities);
    });

    it('finds similar incidents via vector store', async () => {
      const result = await server.callTool('get_root_cause', {
        incidentId: 'inc-similar-1',
        incidentType: 'schema_change',
        affectedResources: ['orders'],
        customerId: 'cust-1',
      });
      const rca = JSON.parse(result.content[0].text!) as RootCauseAnalysis;

      // Root cause should reference similar past incidents if found
      expect(rca.evidenceSources).toContain('incident_history');
    });
  });

  describe('remediate', () => {
    it('auto-remediates with high confidence', async () => {
      const result = await server.callTool('remediate', {
        incidentId: 'inc-1',
        incidentType: 'resource_exhaustion',
        confidence: 0.96,
        customerId: 'cust-1',
      });
      const remediation = JSON.parse(result.content[0].text!) as RemediationResult;
      expect(remediation.success).toBe(true);
      expect(remediation.automated).toBe(true);
      expect(remediation.playbook).toBe('scale_compute');
      expect(remediation.rollbackAvailable).toBe(true);
    });

    it('routes to human review with low confidence', async () => {
      const result = await server.callTool('remediate', {
        incidentId: 'inc-2',
        incidentType: 'code_regression',
        confidence: 0.6,
        customerId: 'cust-1',
      });
      const remediation = JSON.parse(result.content[0].text!) as RemediationResult;
      expect(remediation.automated).toBe(false);
      expect(remediation.actionsPerformed).toContain('Routed to human approval queue');
    });

    it('supports dry run', async () => {
      const result = await server.callTool('remediate', {
        incidentId: 'inc-3',
        incidentType: 'source_delay',
        confidence: 0.96,
        customerId: 'cust-1',
        dryRun: true,
      });
      const remediation = JSON.parse(result.content[0].text!) as RemediationResult;
      expect(remediation.actionsPerformed[0]).toContain('[DRY RUN]');
    });

    it('calls orchestrator API for restart_task', async () => {
      const result = await server.callTool('remediate', {
        incidentId: 'inc-restart-1',
        incidentType: 'code_regression',
        confidence: 0.96,
        customerId: 'cust-1',
        playbook: 'restart_task',
      });
      const remediation = JSON.parse(result.content[0].text!) as RemediationResult;
      expect(remediation.success).toBe(true);
      expect(remediation.playbook).toBe('restart_task');
      // Should contain actions from real orchestrator API call
      expect(remediation.actionsPerformed.some((a) => a.includes('Restarted task'))).toBe(true);
      expect(remediation.actionsPerformed.some((a) => a.includes('Health check'))).toBe(true);
    });

    it('calls orchestrator API for scale_compute', async () => {
      const result = await server.callTool('remediate', {
        incidentId: 'inc-scale-1',
        incidentType: 'resource_exhaustion',
        confidence: 0.96,
        customerId: 'cust-1',
        playbook: 'scale_compute',
      });
      const remediation = JSON.parse(result.content[0].text!) as RemediationResult;
      expect(remediation.success).toBe(true);
      expect(remediation.actionsPerformed.some((a) => a.includes('Scaled warehouse'))).toBe(true);
    });

    it('publishes incident_remediated event after remediation', async () => {
      await server.callTool('remediate', {
        incidentId: 'inc-event-rem-1',
        incidentType: 'resource_exhaustion',
        confidence: 0.96,
        customerId: 'cust-1',
      });

      const events = await messageBus.getEvents('incident_remediated');
      expect(events.length).toBeGreaterThan(0);
      const lastEvent = events[events.length - 1];
      expect(lastEvent.type).toBe('incident_remediated');
      expect(lastEvent.payload.incidentId).toBe('inc-event-rem-1');
      expect(lastEvent.payload.automated).toBe(true);
    });

    it('publishes incident_escalated event when confidence is low', async () => {
      await server.callTool('remediate', {
        incidentId: 'inc-event-esc-1',
        incidentType: 'code_regression',
        confidence: 0.6,
        customerId: 'cust-1',
      });

      const events = await messageBus.getEvents('incident_escalated');
      expect(events.length).toBeGreaterThan(0);
      const lastEvent = events[events.length - 1];
      expect(lastEvent.type).toBe('incident_escalated');
      expect(lastEvent.payload.incidentId).toBe('inc-event-esc-1');
    });
  });

  describe('get_incident_history', () => {
    it('returns incident history from real data', async () => {
      const result = await server.callTool('get_incident_history', {
        customerId: 'cust-1',
      });
      const history = JSON.parse(result.content[0].text!);
      expect(history.totalIncidents).toBeGreaterThan(0);
      expect(history.incidents).toBeDefined();
      expect(history.byType).toBeDefined();
      expect(history.autoResolvedPercent).toBeGreaterThanOrEqual(0);
    });

    it('filters by type', async () => {
      const result = await server.callTool('get_incident_history', {
        customerId: 'cust-1',
        type: 'schema_change',
        limit: 5,
      });
      const history = JSON.parse(result.content[0].text!);
      expect(history.incidents.every((i: { type: string }) => i.type === 'schema_change')).toBe(true);
    });

    it('returns data from relational store (not generated)', async () => {
      const result = await server.callTool('get_incident_history', {
        customerId: 'cust-1',
        limit: 20,
      });
      const history = JSON.parse(result.content[0].text!);
      // Seeded data has 14 incidents
      expect(history.totalIncidents).toBe(14);
      // Each incident should have a real ID from the seed
      expect(history.incidents[0].id).toMatch(/^hist-inc-/);
    });

    it('finds similar incidents via vector store', async () => {
      const result = await server.callTool('get_incident_history', {
        customerId: 'cust-1',
        similarTo: 'schema change incident affecting orders pipeline',
      });
      const history = JSON.parse(result.content[0].text!);
      expect(history.similarIncidents).toBeDefined();
      expect(history.similarIncidents.length).toBeGreaterThan(0);
      expect(history.similarIncidents[0].score).toBeGreaterThan(0);
    });

    it('includes MTTR metrics', async () => {
      const result = await server.callTool('get_incident_history', {
        customerId: 'cust-1',
      });
      const history = JSON.parse(result.content[0].text!);
      expect(history.avgResolutionTimeMs).toBeGreaterThan(0);
      expect(history.mttrMinutes).toBeGreaterThan(0);
      expect(history.autoResolvedPercent).toBeGreaterThan(0);
    });
  });

  describe('monitor_metrics', () => {
    it('records data points and returns recorded count', async () => {
      const result = await server.callTool('monitor_metrics', {
        dataPoints: [
          { metric: 'row_count', value: 1000, source: 'orders_table' },
          { metric: 'latency', value: 250, source: 'orders_table' },
        ],
        customerId: 'cust-1',
      });
      const parsed = JSON.parse(result.content[0].text!);
      expect(parsed.recorded).toBe(2);
      expect(parsed.anomaliesDetected).toBe(0);
      expect(parsed.monitoredMetrics).toContain('orders_table:row_count');
      expect(parsed.monitoredMetrics).toContain('orders_table:latency');
    });

    it('detects anomalies after enough data points', async () => {
      // Feed 15 normal data points for baseline
      const normalPoints = Array.from({ length: 15 }, (_, i) => ({
        metric: 'null_rate',
        value: 0.02 + (i % 3) * 0.005, // small variance around 0.02
        source: 'anomaly_test_source',
        timestamp: Date.now() - (15 - i) * 60000,
      }));

      await server.callTool('monitor_metrics', {
        dataPoints: normalPoints,
        customerId: 'cust-1',
      });

      // Now send an anomalous data point
      const result = await server.callTool('monitor_metrics', {
        dataPoints: [
          { metric: 'null_rate', value: 0.95, source: 'anomaly_test_source', timestamp: Date.now() },
        ],
        customerId: 'cust-1',
      });
      const parsed = JSON.parse(result.content[0].text!);
      expect(parsed.anomaliesDetected).toBe(1);
      expect(parsed.detections[0].isAnomaly).toBe(true);
      expect(parsed.detections[0].metric).toBe('null_rate');
    });

    it('populates monitored metrics list', async () => {
      const result = await server.callTool('monitor_metrics', {
        dataPoints: [
          { metric: 'cpu_usage', value: 45, source: 'warehouse_a' },
          { metric: 'memory_usage', value: 60, source: 'warehouse_a' },
          { metric: 'cpu_usage', value: 50, source: 'warehouse_b' },
        ],
        customerId: 'cust-1',
      });
      const parsed = JSON.parse(result.content[0].text!);
      expect(parsed.monitoredMetrics).toContain('warehouse_a:cpu_usage');
      expect(parsed.monitoredMetrics).toContain('warehouse_a:memory_usage');
      expect(parsed.monitoredMetrics).toContain('warehouse_b:cpu_usage');
    });
  });

  // E2E incident workflow
  describe('E2E Incident Workflow', () => {
    it('diagnose -> RCA -> remediate', async () => {
      // Step 1: Diagnose
      const diagResult = await server.callTool('diagnose_incident', {
        anomalySignals: [{ metric: 'cpu_usage', value: 99, expected: 40, deviation: 8.0, source: 'warehouse', timestamp: Date.now() }],
        customerId: 'cust-e2e',
      });
      const diagnosis = JSON.parse(diagResult.content[0].text!) as Diagnosis;
      expect(diagnosis.incidentId).toBeTruthy();

      // Verify incident_detected event was published
      const detectedEvents = await messageBus.getEvents('incident_detected');
      expect(detectedEvents.length).toBeGreaterThan(0);

      // Step 2: RCA
      const rcaResult = await server.callTool('get_root_cause', {
        incidentId: diagnosis.incidentId,
        incidentType: diagnosis.type,
        affectedResources: diagnosis.affectedResources,
        customerId: 'cust-e2e',
      });
      const rca = JSON.parse(rcaResult.content[0].text!) as RootCauseAnalysis;
      expect(rca.rootCause).toBeTruthy();

      // Step 3: Remediate
      const remResult = await server.callTool('remediate', {
        incidentId: diagnosis.incidentId,
        incidentType: diagnosis.type,
        confidence: diagnosis.confidence,
        customerId: 'cust-e2e',
      });
      const remediation = JSON.parse(remResult.content[0].text!) as RemediationResult;
      expect(remediation.actionsPerformed.length).toBeGreaterThan(0);
    });
  });
});
