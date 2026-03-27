import { describe, it, expect } from 'vitest';
import { diagnoseIncidentHandler } from '../tools/diagnose-incident.js';
import { getRootCauseHandler } from '../tools/get-root-cause.js';
import { remediateHandler } from '../tools/remediate.js';
import { getIncidentHistoryHandler } from '../tools/get-incident-history.js';

describe('Error Path Tests', () => {
  it('diagnose handles empty signals array', async () => {
    const result = await diagnoseIncidentHandler({ anomalySignals: [], customerId: 'cust-1' });
    const data = JSON.parse((result.content[0] as {text:string}).text);
    expect(data.incidentId).toBeTruthy();
  });

  it('diagnose handles missing customerId gracefully', async () => {
    const result = await diagnoseIncidentHandler({ anomalySignals: [{ metric: 'test', value: 1, expected: 0, deviation: 2, source: 'test', timestamp: Date.now() }], customerId: '' });
    expect(result.content[0].type).toBe('text');
  });

  it('RCA handles non-existent resources', async () => {
    const result = await getRootCauseHandler({ incidentId: 'fake', incidentType: 'schema_change', affectedResources: ['nonexistent_table_xyz'], customerId: 'cust-1' });
    const data = JSON.parse((result.content[0] as {text:string}).text);
    expect(data.rootCause).toBeTruthy();
  });

  it('remediate handles unknown incident type', async () => {
    const result = await remediateHandler({ incidentId: 'fake', incidentType: 'quality_degradation', confidence: 0.96, customerId: 'cust-1', dryRun: true });
    const data = JSON.parse((result.content[0] as {text:string}).text);
    expect(data.actionsPerformed.length).toBeGreaterThan(0);
  });

  it('history handles non-existent customer', async () => {
    const result = await getIncidentHistoryHandler({ customerId: 'nonexistent-customer-xyz' });
    const data = JSON.parse((result.content[0] as {text:string}).text);
    expect(data.totalIncidents).toBe(0);
  });

  it('RCA handles empty affectedResources', async () => {
    const result = await getRootCauseHandler({ incidentId: 'fake', incidentType: 'infrastructure', affectedResources: [], customerId: 'cust-1' });
    const data = JSON.parse((result.content[0] as {text:string}).text);
    expect(data).toBeTruthy();
  });

  it('diagnose handles very large deviation values', async () => {
    const result = await diagnoseIncidentHandler({
      anomalySignals: [{ metric: 'error_rate', value: 99999, expected: 1, deviation: 500, source: 'test', timestamp: Date.now() }],
      customerId: 'cust-1',
    });
    const data = JSON.parse((result.content[0] as {text:string}).text);
    expect(data.severity).toBe('critical');
  });
});
