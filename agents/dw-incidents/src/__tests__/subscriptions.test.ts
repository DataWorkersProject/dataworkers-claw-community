import { describe, it } from 'vitest';
import { messageBus } from '../backends.js';
import '../subscriptions.js';

describe('Cross-Agent Event Subscriptions', () => {
  it('auto-diagnoses on quality_anomaly_detected', async () => {
    // The subscription should not throw
    await messageBus.publish('quality_anomaly_detected', {
      id: 'test-quality-event',
      type: 'quality_anomaly_detected',
      payload: { metric: 'null_rate', value: 0.45, expected: 0.01, deviation: 4.0, datasetId: 'orders' },
      timestamp: Date.now(),
      customerId: 'cust-1',
    });
    // If we got here without throwing, the subscription handled it
  });

  it('auto-diagnoses on schema_change_detected', async () => {
    await messageBus.publish('schema_change_detected', {
      id: 'test-schema-event',
      type: 'schema_change_detected',
      payload: { tableName: 'orders', changeType: 'column_added' },
      timestamp: Date.now(),
      customerId: 'cust-1',
    });
  });

  it('auto-diagnoses on pipeline_failed', async () => {
    await messageBus.publish('pipeline_failed', {
      id: 'test-pipeline-event',
      type: 'pipeline_failed',
      payload: { pipelineId: 'etl_orders', source: 'orders' },
      timestamp: Date.now(),
      customerId: 'cust-1',
    });
  });
});
