import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { PipelineTemplate } from '../types.js';

export const listTemplatesDefinition: ToolDefinition = {
  name: 'list_pipeline_templates',
  description: 'List available pipeline templates for common data engineering patterns. Templates can be used as starting points for pipeline generation.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['etl', 'elt', 'cdc', 'streaming', 'reverse-etl', 'data-quality'],
        description: 'Filter templates by category.',
      },
      orchestrator: {
        type: 'string',
        enum: ['airflow', 'dagster', 'prefect'],
        description: 'Filter templates by orchestrator.',
      },
    },
  },
};

export const TEMPLATES: PipelineTemplate[] = [
  {
    id: 'etl-basic',
    name: 'Basic ETL Pipeline',
    description: 'Extract from a source, transform with SQL, load into target warehouse.',
    category: 'etl',
    orchestrator: 'airflow',
    codeLanguage: 'sql',
    parameters: [
      { name: 'source', description: 'Source connection', type: 'string', required: true },
      { name: 'target', description: 'Target warehouse', type: 'string', required: true },
      { name: 'schedule', description: 'Cron schedule', type: 'string', required: false, default: '0 0 * * *' },
    ],
    exampleDescription: 'Extract daily sales from PostgreSQL, clean and aggregate, load into Snowflake',
    version: '1.0.0',
    lastUpdated: '2026-01-15T00:00:00Z',
  },
  {
    id: 'elt-dbt',
    name: 'dbt ELT Pipeline',
    description: 'Extract and load raw data, then transform in-warehouse using dbt models.',
    category: 'elt',
    orchestrator: 'dagster',
    codeLanguage: 'dbt',
    parameters: [
      { name: 'source', description: 'Source connection', type: 'string', required: true },
      { name: 'dbtProject', description: 'dbt project path', type: 'string', required: true },
      { name: 'models', description: 'dbt models to run', type: 'array', required: false },
    ],
    exampleDescription: 'Load raw events from S3, transform with dbt staging and mart models',
    version: '1.0.0',
    lastUpdated: '2026-01-15T00:00:00Z',
  },
  {
    id: 'cdc-debezium',
    name: 'CDC with Debezium',
    description: 'Capture database changes in real-time using Debezium and stream to target.',
    category: 'cdc',
    orchestrator: 'prefect',
    codeLanguage: 'python',
    parameters: [
      { name: 'sourceDatabase', description: 'Source database connection', type: 'string', required: true },
      { name: 'targetTopic', description: 'Kafka topic for changes', type: 'string', required: true },
      { name: 'tables', description: 'Tables to capture', type: 'array', required: true },
    ],
    exampleDescription: 'Capture changes from PostgreSQL orders table, stream to Kafka',
    version: '1.0.0',
    lastUpdated: '2026-01-15T00:00:00Z',
  },
  {
    id: 'quality-monitoring',
    name: 'Data Quality Pipeline',
    description: 'Run data quality checks on tables: schema validation, row counts, freshness, uniqueness.',
    category: 'data-quality',
    orchestrator: 'airflow',
    codeLanguage: 'sql',
    parameters: [
      { name: 'tables', description: 'Tables to validate', type: 'array', required: true },
      { name: 'alertChannel', description: 'Alert channel (slack, email)', type: 'string', required: false, default: 'slack' },
    ],
    exampleDescription: 'Run hourly quality checks on dim_customers and fact_orders tables',
    version: '1.0.0',
    lastUpdated: '2026-01-15T00:00:00Z',
  },
  {
    id: 'reverse-etl',
    name: 'Reverse ETL to SaaS',
    description: 'Sync warehouse data back to operational SaaS tools (CRM, marketing, support).',
    category: 'reverse-etl',
    orchestrator: 'dagster',
    codeLanguage: 'python',
    parameters: [
      { name: 'source', description: 'Source warehouse', type: 'string', required: true },
      { name: 'destination', description: 'SaaS destination (salesforce, hubspot, intercom)', type: 'string', required: true },
      { name: 'syncMode', description: 'full or incremental', type: 'string', required: false, default: 'incremental' },
    ],
    exampleDescription: 'Sync customer segments from BigQuery to Salesforce daily',
    version: '1.0.0',
    lastUpdated: '2026-01-15T00:00:00Z',
  },
  {
    id: 'etl-multi-source',
    name: 'Multi-Source ETL',
    description: 'Extract from multiple sources, join and transform, load into unified data model.',
    category: 'etl',
    orchestrator: 'airflow',
    codeLanguage: 'sql',
    parameters: [
      { name: 'sources', description: 'List of source connections', type: 'array', required: true },
      { name: 'target', description: 'Target warehouse', type: 'string', required: true },
      { name: 'joinKeys', description: 'Keys to join sources', type: 'array', required: true },
    ],
    exampleDescription: 'Join Stripe payments with Salesforce accounts and load into Snowflake',
    version: '1.0.0',
    lastUpdated: '2026-01-15T00:00:00Z',
  },
  {
    id: 'iceberg-merge-upsert',
    name: 'Iceberg MERGE INTO Upsert',
    description: 'Upsert data into Apache Iceberg tables using MERGE INTO with automatic compaction and snapshot management.',
    category: 'etl',
    orchestrator: 'airflow',
    codeLanguage: 'sql',
    parameters: [
      { name: 'source', description: 'Source table or query', type: 'string', required: true },
      { name: 'targetTable', description: 'Iceberg target table (namespace.table)', type: 'string', required: true },
      { name: 'matchColumns', description: 'Columns to match on', type: 'array', required: true },
      { name: 'updateColumns', description: 'Columns to update', type: 'array', required: true },
    ],
    exampleDescription: 'Merge daily order updates into iceberg analytics.events.orders using id as match key',
    version: '1.0.0',
    lastUpdated: '2026-02-01T00:00:00Z',
  },
  {
    id: 'iceberg-compact-maintain',
    name: 'Iceberg Table Maintenance',
    description: 'Run compaction, snapshot expiry, and manifest rewriting on Iceberg tables to optimize query performance.',
    category: 'data-quality',
    orchestrator: 'airflow',
    codeLanguage: 'sql',
    parameters: [
      { name: 'tables', description: 'Iceberg tables to maintain', type: 'array', required: true },
      { name: 'snapshotRetentionDays', description: 'Days to retain snapshots', type: 'number', required: false, default: 7 },
    ],
    exampleDescription: 'Run weekly maintenance on all Iceberg tables: compact files, expire snapshots older than 7 days',
    version: '1.0.0',
    lastUpdated: '2026-02-01T00:00:00Z',
  },
  {
    id: 'iceberg-cdc-stream',
    name: 'CDC to Iceberg via Kafka',
    description: 'Stream CDC events from Kafka into Iceberg tables with exactly-once semantics.',
    category: 'cdc',
    orchestrator: 'prefect',
    codeLanguage: 'python',
    parameters: [
      { name: 'kafkaTopic', description: 'Source Kafka topic', type: 'string', required: true },
      { name: 'targetTable', description: 'Iceberg target table', type: 'string', required: true },
      { name: 'schemaRegistry', description: 'Confluent Schema Registry URL', type: 'string', required: false },
    ],
    exampleDescription: 'Stream CDC events from Kafka orders-changes topic into Iceberg warehouse.orders',
    version: '1.0.0',
    lastUpdated: '2026-02-01T00:00:00Z',
  },
  {
    id: 'polaris-governed-etl',
    name: 'Polaris-Governed ETL',
    description: 'ETL pipeline with Polaris catalog governance: access checks, audit logging, and policy enforcement.',
    category: 'etl',
    orchestrator: 'dagster',
    codeLanguage: 'sql',
    parameters: [
      { name: 'polarisCatalog', description: 'Polaris catalog name', type: 'string', required: true },
      { name: 'source', description: 'Source table reference', type: 'string', required: true },
      { name: 'target', description: 'Target table reference', type: 'string', required: true },
      { name: 'principal', description: 'Polaris principal for access checks', type: 'string', required: true },
    ],
    exampleDescription: 'Extract from Polaris production catalog, enforce RBAC, load into governed Iceberg table',
    version: '1.0.0',
    lastUpdated: '2026-02-15T00:00:00Z',
  },
  {
    id: 'polaris-catalog-discovery',
    name: 'Polaris Catalog Discovery & Quality',
    description: 'Discover tables in a Polaris catalog, profile data quality, and flag issues.',
    category: 'data-quality',
    orchestrator: 'airflow',
    codeLanguage: 'python',
    parameters: [
      { name: 'polarisCatalog', description: 'Polaris catalog to scan', type: 'string', required: true },
      { name: 'namespaces', description: 'Namespaces to discover (default: all)', type: 'array', required: false },
      { name: 'qualityThresholds', description: 'Quality check thresholds', type: 'string', required: false },
    ],
    exampleDescription: 'Scan Polaris production catalog, profile all tables, flag freshness and schema issues',
    version: '1.0.0',
    lastUpdated: '2026-02-15T00:00:00Z',
  },
  // CDC streaming templates referencing dw-streaming
  {
    id: 'cdc-streaming-kafka',
    name: 'CDC Streaming via dw-streaming',
    description: 'Change data capture pipeline that uses dw-streaming agent for Kafka-based CDC. Captures row-level changes and streams them to a target table with exactly-once semantics.',
    category: 'cdc',
    orchestrator: 'airflow',
    codeLanguage: 'python',
    parameters: [
      { name: 'sourceDatabase', description: 'Source database to capture changes from', type: 'string', required: true },
      { name: 'tables', description: 'Tables to capture CDC events for', type: 'array', required: true },
      { name: 'kafkaBrokers', description: 'Kafka broker addresses', type: 'string', required: true },
      { name: 'targetTable', description: 'Target table for merged changes', type: 'string', required: true },
      { name: 'streamingAgentId', description: 'dw-streaming agent ID for health coordination', type: 'string', required: false, default: 'dw-streaming' },
    ],
    exampleDescription: 'Capture CDC events from PostgreSQL via dw-streaming Kafka consumer, merge into Iceberg orders table',
    version: '1.0.0',
    lastUpdated: '2026-03-01T00:00:00Z',
  },
  {
    id: 'cdc-streaming-realtime',
    name: 'Real-Time CDC with Stream Health',
    description: 'Real-time CDC pipeline with integrated stream health monitoring via dw-streaming. Includes automatic backpressure handling and dead-letter queue.',
    category: 'cdc',
    orchestrator: 'prefect',
    codeLanguage: 'python',
    parameters: [
      { name: 'sourceDatabase', description: 'Source database connection', type: 'string', required: true },
      { name: 'tables', description: 'Tables to capture', type: 'array', required: true },
      { name: 'targetTable', description: 'Target table for merged changes', type: 'string', required: true },
      { name: 'healthCheckInterval', description: 'Stream health check interval in seconds', type: 'number', required: false, default: 30 },
    ],
    exampleDescription: 'Real-time CDC from MySQL to Snowflake with dw-streaming health monitoring and DLQ',
    version: '1.0.0',
    lastUpdated: '2026-03-01T00:00:00Z',
  },
];

export const listTemplatesHandler: ToolHandler = async (args) => {
  let filtered = [...TEMPLATES];

  if (args.category) {
    filtered = filtered.filter((t) => t.category === args.category);
  }
  if (args.orchestrator) {
    filtered = filtered.filter((t) => t.orchestrator === args.orchestrator);
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
  };
};
