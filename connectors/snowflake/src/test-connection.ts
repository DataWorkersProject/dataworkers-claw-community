/**
 * Snowflake connection tester.
 *
 * Creates a connector (real or stub based on env vars), runs basic
 * operations, and returns a structured result with timing.
 */

import { SnowflakeConnector } from './index.js';

export interface ConnectionTestResult {
  provider: string;
  success: boolean;
  mode: 'real' | 'stub';
  latencyMs: number;
  error?: string;
  details?: Record<string, string>;
}

export async function testSnowflakeConnection(): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    const connector = SnowflakeConnector.fromEnv();
    const mode = connector.getMode();
    connector.connect(process.env.SNOWFLAKE_ACCOUNT);
    const health = connector.healthCheck();
    const databases = connector.listDatabases();
    connector.disconnect();
    return {
      provider: 'snowflake',
      success: health.healthy,
      mode,
      latencyMs: Date.now() - start,
      details: {
        databases: String(databases.length),
        account: process.env.SNOWFLAKE_ACCOUNT || 'stub',
      },
    };
  } catch (err) {
    return {
      provider: 'snowflake',
      success: false,
      mode: process.env.SNOWFLAKE_ACCOUNT ? 'real' : 'stub',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
