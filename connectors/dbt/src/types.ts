/**
 * Type definitions for the dbt Cloud API + manifest parsing connector.
 */

export interface DbtColumn {
  name: string;
  description: string;
  type: string;
  tests: string[];
}

export interface DbtModel {
  uniqueId: string;
  name: string;
  schema: string;
  database: string;
  materialization: 'table' | 'view' | 'incremental' | 'ephemeral';
  description: string;
  columns: DbtColumn[];
  dependsOn: string[];
  tags: string[];
}

export interface DbtTestResult {
  testId: string;
  testName: string;
  status: 'pass' | 'fail' | 'warn' | 'error';
  executionTimeMs: number;
  failureMessage?: string;
}

export interface DbtRunHistory {
  runId: string;
  status: 'success' | 'error' | 'cancelled';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  modelCount: number;
}

export interface DbtLineageEdge {
  parent: string;
  child: string;
  relationship: 'ref' | 'source';
}

export interface DbtManifest {
  metadata: {
    dbtVersion: string;
    projectName: string;
    generatedAt: string;
  };
  nodes: Record<string, DbtModel>;
  sources: Record<string, DbtModel>;
}

/** Configuration for connecting to the dbt Cloud API. */
export interface DbtCloudConfig {
  apiToken: string;
  accountId: string;
  baseUrl?: string;
}

/** Interface that both stub and real dbt Cloud clients implement. */
export interface IDbtClient {
  listModels(): DbtModel[] | Promise<DbtModel[]>;
  getModel(uniqueId: string): DbtModel | Promise<DbtModel>;
  getModelLineage(uniqueId: string): DbtLineageEdge[] | Promise<DbtLineageEdge[]>;
  getTestResults(runId?: string): DbtTestResult[] | Promise<DbtTestResult[]>;
  getRunHistory(limit?: number): DbtRunHistory[] | Promise<DbtRunHistory[]>;
}
