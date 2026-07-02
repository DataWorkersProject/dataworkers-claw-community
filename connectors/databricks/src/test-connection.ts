/**
 * Databricks connection tester.
 *
 * Creates a connector (real or stub based on env vars), runs basic
 * operations, and returns a structured result with timing.
 */

import { DatabricksConnector } from './index.js';

export interface ConnectionTestResult {
  provider: string;
  success: boolean;
  mode: 'real' | 'stub';
  latencyMs: number;
  error?: string;
  details?: Record<string, string>;
}

export async function testDatabricksConnection(): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    const connector = DatabricksConnector.fromEnv();
    const mode = connector.getMode();
    connector.connect(process.env.DATABRICKS_HOST, process.env.DATABRICKS_TOKEN);
    const health = connector.healthCheck();
    const catalogs = await connector.listCatalogs();
    connector.disconnect();
    return {
      provider: 'databricks',
      success: health.healthy,
      mode,
      latencyMs: Date.now() - start,
      details: {
        catalogs: String(catalogs.length),
        host: process.env.DATABRICKS_HOST || 'stub',
      },
    };
  } catch (err) {
    return {
      provider: 'databricks',
      success: false,
      mode: process.env.DATABRICKS_HOST ? 'real' : 'stub',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
