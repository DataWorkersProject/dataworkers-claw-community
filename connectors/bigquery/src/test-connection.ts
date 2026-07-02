/**
 * BigQuery connection tester.
 *
 * Creates a connector (real or stub based on env vars), runs basic
 * operations, and returns a structured result with timing.
 */

import { BigQueryConnector } from './index.js';

export interface ConnectionTestResult {
  provider: string;
  success: boolean;
  mode: 'real' | 'stub';
  latencyMs: number;
  error?: string;
  details?: Record<string, string>;
}

export async function testBigQueryConnection(): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    const connector = BigQueryConnector.fromEnv();
    const mode = connector.getMode();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
    connector.connect(projectId);
    const health = connector.healthCheck();
    const datasets = connector.listDatasets();
    connector.disconnect();
    return {
      provider: 'bigquery',
      success: health.healthy,
      mode,
      latencyMs: Date.now() - start,
      details: {
        datasets: String(datasets.length),
        project: projectId || 'stub',
      },
    };
  } catch (err) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
    return {
      provider: 'bigquery',
      success: false,
      mode: projectId ? 'real' : 'stub',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
