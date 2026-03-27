/**
 * MCP Resource: Supported Platforms
 *
 * Static JSON listing all platforms the catalog agent can crawl and index.
 * Read-only metadata for clients to know which connectors are available.
 */

import type { ResourceDefinition, ResourceHandler } from '@data-workers/mcp-framework';

const platforms = [
  { id: 'snowflake', name: 'Snowflake', category: 'warehouse', features: ['column-lineage', 'freshness', 'usage-stats'] },
  { id: 'bigquery', name: 'BigQuery', category: 'warehouse', features: ['column-lineage', 'freshness', 'usage-stats'] },
  { id: 'redshift', name: 'Amazon Redshift', category: 'warehouse', features: ['column-lineage', 'freshness'] },
  { id: 'databricks', name: 'Databricks', category: 'lakehouse', features: ['column-lineage', 'freshness', 'unity-catalog'] },
  { id: 'postgres', name: 'PostgreSQL', category: 'database', features: ['freshness'] },
  { id: 'mysql', name: 'MySQL', category: 'database', features: ['freshness'] },
  { id: 'dbt', name: 'dbt', category: 'transformation', features: ['column-lineage', 'semantic-layer', 'docs'] },
  { id: 'airflow', name: 'Apache Airflow', category: 'orchestration', features: ['dag-lineage', 'run-history'] },
  { id: 'dagster', name: 'Dagster', category: 'orchestration', features: ['asset-lineage', 'run-history'] },
  { id: 'prefect', name: 'Prefect', category: 'orchestration', features: ['flow-lineage', 'run-history'] },
  { id: 'iceberg', name: 'Apache Iceberg', category: 'table-format', features: ['schema-evolution', 'time-travel'] },
  { id: 'delta', name: 'Delta Lake', category: 'table-format', features: ['schema-evolution', 'time-travel'] },
  { id: 'hudi', name: 'Apache Hudi', category: 'table-format', features: ['schema-evolution', 'incremental'] },
  { id: 'kafka', name: 'Apache Kafka', category: 'streaming', features: ['topic-schema', 'throughput'] },
  { id: 'looker', name: 'Looker', category: 'bi', features: ['semantic-layer', 'usage-stats'] },
  { id: 'tableau', name: 'Tableau', category: 'bi', features: ['dashboard-lineage', 'usage-stats'] },
  { id: 'powerbi', name: 'Power BI', category: 'bi', features: ['dashboard-lineage', 'usage-stats'] },
  { id: 'metabase', name: 'Metabase', category: 'bi', features: ['dashboard-lineage'] },
  { id: 'sigma', name: 'Sigma', category: 'bi', features: ['dashboard-lineage'] },
  { id: 'superset', name: 'Apache Superset', category: 'bi', features: ['dashboard-lineage'] },
  { id: 'spark', name: 'Apache Spark', category: 'compute', features: ['job-lineage'] },
  { id: 'flink', name: 'Apache Flink', category: 'streaming', features: ['job-lineage', 'throughput'] },
  { id: 'fivetran', name: 'Fivetran', category: 'ingestion', features: ['connector-status', 'sync-history'] },
  { id: 'airbyte', name: 'Airbyte', category: 'ingestion', features: ['connector-status', 'sync-history'] },
  { id: 'glue', name: 'AWS Glue', category: 'catalog', features: ['schema-registry', 'crawlers'] },
  { id: 'openmetadata', name: 'OpenMetadata', category: 'catalog', features: ['full-metadata', 'lineage'] },
  { id: 'datahub', name: 'DataHub', category: 'catalog', features: ['full-metadata', 'lineage'] },
];

const content = JSON.stringify({
  totalPlatforms: platforms.length,
  categories: [...new Set(platforms.map(p => p.category))],
  platforms,
}, null, 2);

export const supportedPlatformsDefinition: ResourceDefinition = {
  uri: 'catalog://ref/supported-platforms',
  name: 'Supported Platforms',
  description: 'All platforms the catalog agent can connect to, grouped by category (warehouse, orchestration, BI, etc.) with supported feature flags.',
  mimeType: 'application/json',
};

export const supportedPlatformsHandler: ResourceHandler = async (_uri: string) => ({
  contents: [{
    uri: 'catalog://ref/supported-platforms',
    mimeType: 'application/json',
    text: content,
  }],
});
