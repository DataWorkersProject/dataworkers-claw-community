/**
 * Shared type definitions for the Data Platform Connectors Agent.
 */

/** Generic connector result wrapper. */
export interface ConnectorResult<T = unknown> {
  platform: string;
  data: T;
  timestamp: number;
}

/** Snowflake database info. */
export interface SnowflakeDatabaseInfo {
  name: string;
  owner: string;
  comment: string;
}

/** Snowflake table info. */
export interface SnowflakeTableInfo {
  name: string;
  database: string;
  schema: string;
  kind: string;
  rowCount: number;
  bytes: number;
  owner: string;
}

/** BigQuery dataset info. */
export interface BigQueryDatasetInfo {
  datasetId: string;
  projectId: string;
  location: string;
  description: string;
}

/** BigQuery cost estimate. */
export interface BigQueryCostEstimateInfo {
  queryText: string;
  estimatedBytesProcessed: number;
  estimatedCostUsd: number;
}

/** dbt model info. */
export interface DbtModelInfo {
  uniqueId: string;
  name: string;
  database: string;
  schema: string;
  materialization: string;
  description: string;
  tags: string[];
}

/** dbt lineage edge. */
export interface DbtLineageEdgeInfo {
  source: string;
  target: string;
  relationship: string;
}

/** dbt test result. */
export interface DbtTestResultInfo {
  testId: string;
  name: string;
  status: string;
  executionTime: number;
}

/** dbt run history entry. */
export interface DbtRunHistoryInfo {
  runId: string;
  status: string;
  startedAt: number;
  finishedAt: number;
  duration: number;
}

/** Databricks catalog info. */
export interface DatabricksCatalogInfo {
  name: string;
  owner: string;
  comment: string;
}

/** Databricks table info. */
export interface DatabricksTableInfo {
  name: string;
  catalogName: string;
  schemaName: string;
  tableType: string;
  dataSourceFormat: string;
  owner: string;
}

/** Databricks query history entry. */
export interface DatabricksQueryHistoryInfo {
  queryId: string;
  status: string;
  queryText: string;
  startTime: number;
  endTime: number;
  rowsProduced: number;
}
