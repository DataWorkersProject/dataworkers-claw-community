/**
 * Eval Framework — Swarm Scenario: Incident Response
 *
 * Simulates an incident response workflow: diagnose a pipeline failure,
 * find root cause, check agent health, and execute remediation.
 *
 * Flow:
 * 1. diagnose_incident -> identify the incident
 * 2. get_root_cause -> determine what caused it
 * 3. check_agent_health -> verify the pipeline agent is healthy
 * 4. remediate -> apply a fix (dry run)
 */

import type { SwarmScenario } from './types.js';
import { runSwarmScenario } from './onboarding.js';

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

export const incidentResponseScenario: SwarmScenario = {
  name: 'incident-response',
  description: 'Diagnose pipeline failure, find root cause, check health, and remediate',
  steps: [
    {
      id: 'diagnose',
      agent: 'dw-incidents',
      tool: 'diagnose_incident',
      inputTemplate: {
        anomalySignals: [
          {
            metric: 'row_count',
            value: 0,
            expected: 50000,
            deviation: -1.0,
            source: 'daily-orders-etl',
            timestamp: Date.now(),
          },
        ],
        customerId: 'test-customer-1',
      },
      extractFields: {
        incidentId: 'incidentId',
        incidentType: 'incidentType',
        severity: 'severity',
        affectedResources: 'affectedResources',
      },
      expectedFields: ['incidentId', 'severity'],
    },
    {
      id: 'root-cause',
      agent: 'dw-incidents',
      tool: 'get_root_cause',
      inputTemplate: {
        customerId: 'test-customer-1',
      },
      dynamicInputs: {
        incidentId: { fromStep: 'diagnose', field: 'incidentId', fallback: 'inc-001' },
        incidentType: { fromStep: 'diagnose', field: 'incidentType', fallback: 'data_quality' },
        affectedResources: { fromStep: 'diagnose', field: 'affectedResources', fallback: ['daily-orders-etl'] },
      },
      extractFields: {
        rootCause: 'rootCause',
        confidence: 'confidence',
        recommendation: 'recommendation',
      },
      expectedFields: ['rootCause'],
    },
    {
      id: 'health-check',
      agent: 'dw-observability',
      tool: 'check_agent_health',
      inputTemplate: {
        agentName: 'dw-pipelines',
      },
      extractFields: {
        healthy: 'healthy',
        status: 'status',
        errorRate: 'errorRate',
      },
      expectedFields: ['status'],
    },
    {
      id: 'remediate',
      agent: 'dw-incidents',
      tool: 'remediate',
      inputTemplate: {
        incidentType: 'data_quality',
        confidence: 0.85,
        customerId: 'test-customer-1',
      },
      dynamicInputs: {
        incidentId: { fromStep: 'diagnose', field: 'incidentId', fallback: 'inc-001' },
      },
      extractFields: {
        actionTaken: 'action',
        success: 'success',
        rollbackAvailable: 'rollbackAvailable',
      },
      expectedFields: ['action', 'success'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function runIncidentResponseScenario(
  servers: Record<string, { callTool: (name: string, args: Record<string, unknown>) => Promise<any> }>,
) {
  return runSwarmScenario(incidentResponseScenario, servers);
}
