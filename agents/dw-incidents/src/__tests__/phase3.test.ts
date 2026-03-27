import { describe, it, expect } from 'vitest';
import { messageBus } from '../backends.js';
import '../subscriptions.js';

describe('Phase 3: Cross-Agent Event Integration', () => {
  const customerId = 'cust-1';

  it('quality anomaly triggers auto-diagnosis', async () => {
    await messageBus.publish('quality_anomaly_detected', {
      id: `evt-${Date.now()}`, type: 'quality_anomaly_detected',
      payload: { metric: 'null_rate', value: 0.5, expected: 0.02, deviation: 5.0, datasetId: 'orders' },
      timestamp: Date.now(), customerId,
    });
  });

  it('schema change triggers auto-diagnosis', async () => {
    await messageBus.publish('schema_change_detected', {
      id: `evt-${Date.now()}`, type: 'schema_change_detected',
      payload: { tableName: 'orders', changeType: 'column_removed', columnName: 'legacy_field' },
      timestamp: Date.now(), customerId,
    });
  });

  it('pipeline failure triggers auto-diagnosis', async () => {
    await messageBus.publish('pipeline_failed', {
      id: `evt-${Date.now()}`, type: 'pipeline_failed',
      payload: { pipelineId: 'etl_daily', taskId: 'transform', error: 'OOM', deploymentInfo: { version: '1.2.3' } },
      timestamp: Date.now(), customerId,
    });
  });

  it('message bus request/reply works for quality context', async () => {
    // Register a mock quality context handler
    messageBus.onRequest('get_quality_context', async (_payload) => {
      return { qualityScore: 0.85, issues: ['null_rate_high'] };
    });

    const result = await messageBus.request('get_quality_context', { resources: ['orders'], customerId });
    expect(result).toHaveProperty('qualityScore');
  });

  it('event subscription and unsubscription work', async () => {
    let received = false;
    const handler = () => { received = true; };
    messageBus.subscribe('test_event', handler);
    await messageBus.publish('test_event', { id: 'test', type: 'test_event', payload: {}, timestamp: Date.now() });
    expect(received).toBe(true);

    received = false;
    messageBus.unsubscribe('test_event', handler);
    await messageBus.publish('test_event', { id: 'test2', type: 'test_event', payload: {}, timestamp: Date.now() });
    expect(received).toBe(false);
  });
});
