import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { MetricMonitor } from '../engine/metric-monitor.js';
import type { MetricDataPoint } from '../engine/statistical-detector.js';

// Lazy singleton
let monitor: MetricMonitor | null = null;
function getMonitor(): MetricMonitor {
  if (!monitor) monitor = new MetricMonitor();
  return monitor;
}

export const monitorMetricsDefinition: ToolDefinition = {
  name: 'monitor_metrics',
  description: 'Record metric data points and detect anomalies. Uses statistical detection with seasonality support. Returns anomaly detections for any recorded metrics that exceed thresholds.',
  inputSchema: {
    type: 'object',
    properties: {
      dataPoints: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string', description: 'Metric name (e.g., row_count, latency, null_rate).' },
            value: { type: 'number', description: 'Current metric value.' },
            source: { type: 'string', description: 'Data source identifier.' },
            timestamp: { type: 'number', description: 'Epoch ms. Defaults to now.' },
          },
          required: ['metric', 'value', 'source'],
        },
        description: 'Metric data points to record and analyze.',
      },
      customerId: { type: 'string' },
    },
    required: ['dataPoints', 'customerId'],
  },
};

export const monitorMetricsHandler: ToolHandler = async (args) => {
  const dataPoints = args.dataPoints as Array<{ metric: string; value: number; source: string; timestamp?: number }>;
  const monitor = getMonitor();

  const detections = [];
  for (const dp of dataPoints) {
    const point: MetricDataPoint = {
      metric: dp.metric,
      value: dp.value,
      source: dp.source,
      timestamp: dp.timestamp ?? Date.now(),
    };
    const detection = monitor.recordMetric(point);
    if (detection) {
      detections.push(detection);
    }
  }

  const result = {
    recorded: dataPoints.length,
    anomaliesDetected: detections.length,
    detections,
    monitoredMetrics: monitor.getMonitoredMetrics(),
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
};
