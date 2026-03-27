import { describe, it, expect } from 'vitest';
import { diagnoseIncidentHandler } from '../tools/diagnose-incident.js';
import { remediateHandler } from '../tools/remediate.js';
import { getIncidentHistoryHandler } from '../tools/get-incident-history.js';

describe('Concurrency Tests', () => {
  it('handles 10 concurrent diagnoses without errors', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      diagnoseIncidentHandler({
        anomalySignals: [{ metric: `metric_${i}`, value: 10 + i, expected: 2, deviation: 3 + i, source: `source_${i}`, timestamp: Date.now() }],
        customerId: 'cust-1',
      })
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    results.forEach(r => expect(r.content[0].type).toBe('text'));
  });

  it('handles concurrent diagnose + remediate', async () => {
    const [diagResult, remResult] = await Promise.all([
      diagnoseIncidentHandler({ anomalySignals: [{ metric: 'cpu', value: 90, expected: 40, deviation: 4, source: 'srv', timestamp: Date.now() }], customerId: 'cust-1' }),
      remediateHandler({ incidentId: 'concurrent-test', incidentType: 'resource_exhaustion', confidence: 0.96, customerId: 'cust-1', dryRun: true }),
    ]);
    expect(diagResult.content[0].type).toBe('text');
    expect(remResult.content[0].type).toBe('text');
  });

  it('handles concurrent history queries', async () => {
    const promises = Array.from({ length: 5 }, () =>
      getIncidentHistoryHandler({ customerId: 'cust-1', limit: 10 })
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
  });
});
