/**
 * Benchmark Scenarios — dw-incidents
 *
 * 5 scenarios covering incident diagnosis, history retrieval,
 * root cause analysis, remediation, and metric monitoring.
 */

import type { BenchmarkScenario } from '../types.js';
import { nonEmptyCheck, typeCheck } from '../framework.js';

const CID = 'test-customer-1';

export const incidentsScenarios: BenchmarkScenario[] = [
  // ── 1. Diagnose incident ──────────────────────────────────────────────
  {
    name: 'incidents-diagnose-basic',
    description: 'Diagnose an incident from anomaly signals',
    agent: 'dw-incidents',
    tool: 'diagnose_incident',
    input: {
      anomalySignals: [
        {
          metric: 'row_count',
          value: 0,
          expected: 50000,
          deviation: -1.0,
          source: 'fact_orders',
          timestamp: Date.now(),
        },
      ],
      customerId: CID,
    },
    expectedFields: ['incidentId', 'severity', 'type'],
    qualityChecks: [
      { name: 'incident-fields-present', fn: nonEmptyCheck(['incidentId', 'severity', 'type']) },
      { name: 'severity-is-string', fn: typeCheck({ severity: 'string' }) },
    ],
    category: 'analysis',
    difficulty: 'basic',
  },

  // ── 2. Get incident history ───────────────────────────────────────────
  {
    name: 'incidents-get-history',
    description: 'Retrieve historical incidents for a customer',
    agent: 'dw-incidents',
    tool: 'get_incident_history',
    input: { customerId: CID },
    expectedFields: [],
    category: 'search',
    difficulty: 'basic',
  },

  // ── 3. Root cause analysis ────────────────────────────────────────────
  {
    name: 'incidents-root-cause',
    description: 'Perform root cause analysis on an incident',
    agent: 'dw-incidents',
    tool: 'get_root_cause',
    input: {
      incidentId: 'inc-001',
      incidentType: 'data_quality',
      affectedResources: ['fact_orders'],
      customerId: CID,
    },
    expectedFields: ['incidentId', 'rootCause'],
    qualityChecks: [
      { name: 'root-cause-present', fn: nonEmptyCheck(['rootCause']) },
    ],
    category: 'analysis',
    difficulty: 'intermediate',
  },

  // ── 4. Remediate incident ─────────────────────────────────────────────
  {
    name: 'incidents-remediate',
    description: 'Generate remediation steps for an incident',
    agent: 'dw-incidents',
    tool: 'remediate',
    input: {
      incidentId: 'inc-001',
      incidentType: 'data_quality',
      confidence: 0.85,
      customerId: CID,
    },
    expectedFields: ['incidentId'],
    qualityChecks: [
      { name: 'incident-id-present', fn: nonEmptyCheck(['incidentId']) },
    ],
    category: 'generation',
    difficulty: 'intermediate',
  },

  // ── 5. Monitor metrics ────────────────────────────────────────────────
  {
    name: 'incidents-monitor-metrics',
    description: 'Ingest and monitor data metrics for anomalies',
    agent: 'dw-incidents',
    tool: 'monitor_metrics',
    input: {
      dataPoints: [
        { metric: 'row_count', value: 50000, source: 'fact_orders' },
        { metric: 'null_rate', value: 0.02, source: 'fact_orders' },
      ],
      customerId: CID,
    },
    expectedFields: [],
    category: 'monitoring',
    difficulty: 'basic',
  },
];
