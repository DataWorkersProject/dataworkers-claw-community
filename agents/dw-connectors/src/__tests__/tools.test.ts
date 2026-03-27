import { describe, it, expect } from 'vitest';
import { server } from '../index.js';

describe('dw-connectors MCP Server', () => {
  it('registers all 83 tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(83);
    expect(tools.map((t) => t.name)).toEqual([
      'list_snowflake_databases',
      'list_snowflake_tables',
      'get_snowflake_table_ddl',
      'get_snowflake_usage',
      'list_bigquery_datasets',
      'list_bigquery_tables',
      'get_bigquery_table_schema',
      'estimate_bigquery_cost',
      'list_dbt_models',
      'get_dbt_model_lineage',
      'get_dbt_test_results',
      'get_dbt_run_history',
      'list_databricks_catalogs',
      'list_databricks_tables',
      'get_databricks_table',
      'get_databricks_query_history',
      'list_all_catalogs',
      'search_across_catalogs',
      'get_table_from_any_catalog',
      'list_glue_databases',
      'list_glue_tables',
      'get_glue_table',
      'search_glue_tables',
      'list_hive_databases',
      'list_hive_tables',
      'get_hive_table_schema',
      'get_hive_partitions',
      'list_om_tables',
      'get_om_table',
      'search_om_tables',
      'get_om_lineage',
      'get_om_quality_tests',
      'list_lineage_datasets',
      'list_lineage_jobs',
      'get_lineage_graph',
      'emit_lineage_event',
      'search_datahub_datasets',
      'get_datahub_dataset',
      'get_datahub_lineage',
      'list_datahub_domains',
      'list_lf_permissions',
      'list_lf_tags',
      'search_lf_by_tags',
      'search_purview_entities',
      'get_purview_entity',
      'get_purview_lineage',
      'list_purview_glossary',
      'list_dataplex_lakes',
      'list_dataplex_entities',
      'get_dataplex_entity',
      'search_dataplex_entries',
      'list_nessie_branches',
      'list_nessie_tables',
      'get_nessie_content',
      'create_nessie_branch',
      'diff_nessie_refs',
      // Orchestration triggers (Pro tier)
      'trigger_airflow_dag',
      'trigger_dagster_job',
      'trigger_prefect_flow',
      'trigger_step_function',
      'trigger_adf_pipeline',
      'trigger_dbt_cloud_job',
      'trigger_composer_dag',
      // Alerting (Pro tier)
      'send_pagerduty_alert',
      'send_slack_alert',
      'send_teams_alert',
      'send_opsgenie_alert',
      'send_newrelic_alert',
      // Schema registry (Pro tier)
      'register_kafka_schema',
      // Quality suites (Pro tier)
      'run_gx_suite',
      'run_soda_suite',
      'run_monte_carlo_suite',
      // ITSM (Pro tier)
      'create_servicenow_ticket',
      'update_servicenow_ticket',
      'create_jira_sm_ticket',
      'update_jira_sm_ticket',
      // Alert resolution (Enterprise tier)
      'resolve_pagerduty_alert',
      'resolve_opsgenie_alert',
      'resolve_newrelic_alert',
      'resolve_slack_alert',
      'resolve_teams_alert',
      // Kafka Connect & Stream Schema (Pro tier)
      'get_connector_status',
      'register_stream_schema',
    ]);
  });

  // ── Snowflake tools ─────────────────────────────────────────────────

  describe('list_snowflake_databases', () => {
    it('returns databases from Snowflake', async () => {
      const result = await server.callTool('list_snowflake_databases', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('name');
    });
  });

  describe('list_snowflake_tables', () => {
    it('returns tables for a given database and schema', async () => {
      const result = await server.callTool('list_snowflake_tables', {
        customerId: 'cust-1',
        database: 'ANALYTICS',
        schema: 'PUBLIC',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_snowflake_table_ddl', () => {
    it('returns column definitions for a table', async () => {
      const result = await server.callTool('get_snowflake_table_ddl', {
        customerId: 'cust-1',
        database: 'ANALYTICS',
        schema: 'PUBLIC',
        table: 'ORDERS',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('columns');
      expect(Array.isArray(data.columns)).toBe(true);
      expect(data.columns.length).toBeGreaterThan(0);
    });
  });

  describe('get_snowflake_usage', () => {
    it('returns warehouse usage metrics', async () => {
      const result = await server.callTool('get_snowflake_usage', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('warehouseName');
    });
  });

  // ── BigQuery tools ──────────────────────────────────────────────────

  describe('list_bigquery_datasets', () => {
    it('returns datasets from BigQuery', async () => {
      const result = await server.callTool('list_bigquery_datasets', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('datasetId');
    });
  });

  describe('list_bigquery_tables', () => {
    it('returns tables in a dataset', async () => {
      const result = await server.callTool('list_bigquery_tables', {
        customerId: 'cust-1',
        datasetId: 'analytics',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_bigquery_table_schema', () => {
    it('returns schema for a specific table', async () => {
      const result = await server.callTool('get_bigquery_table_schema', {
        customerId: 'cust-1',
        datasetId: 'analytics',
        tableId: 'orders',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('columns');
      expect(Array.isArray(data.columns)).toBe(true);
      expect(data.columns.length).toBeGreaterThan(0);
    });
  });

  describe('estimate_bigquery_cost', () => {
    it('returns a cost estimate for a query', async () => {
      const result = await server.callTool('estimate_bigquery_cost', {
        customerId: 'cust-1',
        queryText: 'SELECT * FROM analytics.orders',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('estimatedBytesProcessed');
      expect(data).toHaveProperty('estimatedCostUSD');
      expect(data.estimatedBytesProcessed).toBeGreaterThan(0);
    });
  });

  // ── dbt tools ───────────────────────────────────────────────────────

  describe('list_dbt_models', () => {
    it('returns models with materialization type', async () => {
      const result = await server.callTool('list_dbt_models', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('materialization');
      expect(data[0]).toHaveProperty('uniqueId');
    });
  });

  describe('get_dbt_model_lineage', () => {
    it('returns lineage edges for a model', async () => {
      const result = await server.callTool('get_dbt_model_lineage', {
        customerId: 'cust-1',
        modelId: 'model.project.stg_orders',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('get_dbt_test_results', () => {
    it('returns test results', async () => {
      const result = await server.callTool('get_dbt_test_results', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('status');
    });
  });

  describe('get_dbt_run_history', () => {
    it('returns run history entries', async () => {
      const result = await server.callTool('get_dbt_run_history', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('status');
    });
  });

  // ── Databricks tools ────────────────────────────────────────────────

  describe('list_databricks_catalogs', () => {
    it('returns Unity Catalog catalogs', async () => {
      const result = await server.callTool('list_databricks_catalogs', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('name');
    });
  });

  describe('list_databricks_tables', () => {
    it('returns tables in a catalog', async () => {
      const result = await server.callTool('list_databricks_tables', {
        customerId: 'cust-1',
        catalog: 'main',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_databricks_table', () => {
    it('returns details for a specific table', async () => {
      const result = await server.callTool('get_databricks_table', {
        customerId: 'cust-1',
        catalog: 'main',
        schema: 'default',
        table: 'orders',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('columns');
      expect(data.name).toBe('orders');
    });
  });

  describe('get_databricks_query_history', () => {
    it('returns recent query history', async () => {
      const result = await server.callTool('get_databricks_query_history', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── AWS Glue tools ──────────────────────────────────────────────────

  describe('list_glue_databases', () => {
    it('returns databases from Glue', async () => {
      const result = await server.callTool('list_glue_databases', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('name');
    });
  });

  describe('list_glue_tables', () => {
    it('returns tables in a Glue database', async () => {
      const result = await server.callTool('list_glue_tables', {
        customerId: 'cust-1',
        database: 'analytics_db',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_glue_table', () => {
    it('returns details for a Glue table', async () => {
      const result = await server.callTool('get_glue_table', {
        customerId: 'cust-1',
        database: 'analytics_db',
        table: 'user_events',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('columns');
      expect(data.name).toBe('user_events');
    });
  });

  describe('search_glue_tables', () => {
    it('returns matching tables', async () => {
      const result = await server.callTool('search_glue_tables', {
        customerId: 'cust-1',
        query: 'event',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── Hive Metastore tools ────────────────────────────────────────────

  describe('list_hive_databases', () => {
    it('returns databases from Hive Metastore', async () => {
      const result = await server.callTool('list_hive_databases', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('list_hive_tables', () => {
    it('returns tables in a Hive database', async () => {
      const result = await server.callTool('list_hive_tables', {
        customerId: 'cust-1',
        database: 'default',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_hive_table_schema', () => {
    it('returns schema for a Hive table', async () => {
      const result = await server.callTool('get_hive_table_schema', {
        customerId: 'cust-1',
        database: 'default',
        table: 'customer_dim',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('columns');
    });
  });

  describe('get_hive_partitions', () => {
    it('returns partitions for a Hive table', async () => {
      const result = await server.callTool('get_hive_partitions', {
        customerId: 'cust-1',
        database: 'analytics',
        table: 'daily_sales',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── OpenMetadata tools ──────────────────────────────────────────────

  describe('list_om_tables', () => {
    it('returns tables from OpenMetadata', async () => {
      const result = await server.callTool('list_om_tables', {
        customerId: 'cust-1',
        database: 'warehouse_db',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_om_table', () => {
    it('returns details for an OpenMetadata table', async () => {
      const result = await server.callTool('get_om_table', {
        customerId: 'cust-1',
        tableId: 'tbl-001',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('columns');
    });
  });

  describe('search_om_tables', () => {
    it('returns matching OpenMetadata tables', async () => {
      const result = await server.callTool('search_om_tables', {
        customerId: 'cust-1',
        query: 'customer',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_om_lineage', () => {
    it('returns lineage for an OpenMetadata table', async () => {
      const result = await server.callTool('get_om_lineage', {
        customerId: 'cust-1',
        tableId: 'tbl-004',
        direction: 'upstream',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('nodes');
      expect(data).toHaveProperty('edges');
    });
  });

  describe('get_om_quality_tests', () => {
    it('returns quality tests for an OpenMetadata table', async () => {
      const result = await server.callTool('get_om_quality_tests', {
        customerId: 'cust-1',
        tableId: 'tbl-001',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── OpenLineage/Marquez tools ───────────────────────────────────────

  describe('list_lineage_datasets', () => {
    it('returns datasets from Marquez', async () => {
      const result = await server.callTool('list_lineage_datasets', {
        customerId: 'cust-1',
        namespace: 'default',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('list_lineage_jobs', () => {
    it('returns jobs from Marquez', async () => {
      const result = await server.callTool('list_lineage_jobs', {
        customerId: 'cust-1',
        namespace: 'etl_pipeline',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_lineage_graph', () => {
    it('returns a lineage graph', async () => {
      const result = await server.callTool('get_lineage_graph', {
        customerId: 'cust-1',
        nodeId: 'dataset:analytics.daily_revenue',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('graph');
      expect(data.graph.length).toBeGreaterThan(0);
    });
  });

  describe('emit_lineage_event', () => {
    it('emits a lineage event successfully', async () => {
      const result = await server.callTool('emit_lineage_event', {
        customerId: 'cust-1',
        eventType: 'COMPLETE',
        jobNamespace: 'etl_pipeline',
        jobName: 'test_job',
        runId: 'run-001',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('success', true);
    });
  });

  // ── DataHub tools ───────────────────────────────────────────────────

  describe('search_datahub_datasets', () => {
    it('returns datasets from DataHub', async () => {
      const result = await server.callTool('search_datahub_datasets', {
        customerId: 'cust-1',
        query: 'kafka',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_datahub_dataset', () => {
    it('returns a dataset by URN', async () => {
      const result = await server.callTool('get_datahub_dataset', {
        customerId: 'cust-1',
        urn: 'urn:li:dataset:(urn:li:dataPlatform:kafka,user_clicks,PROD)',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('name');
      expect(data.name).toBe('user_clicks');
    });
  });

  describe('get_datahub_lineage', () => {
    it('returns lineage for a dataset', async () => {
      const result = await server.callTool('get_datahub_lineage', {
        customerId: 'cust-1',
        urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)',
        direction: 'downstream',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('entities');
      expect(data.entities.length).toBeGreaterThan(0);
    });
  });

  describe('list_datahub_domains', () => {
    it('returns domains from DataHub', async () => {
      const result = await server.callTool('list_datahub_domains', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── Lake Formation tools ────────────────────────────────────────────

  describe('list_lf_permissions', () => {
    it('returns permissions for a resource', async () => {
      const result = await server.callTool('list_lf_permissions', {
        customerId: 'cust-1',
        resource: 'analytics_db',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('list_lf_tags', () => {
    it('returns tags for a resource', async () => {
      const result = await server.callTool('list_lf_tags', {
        customerId: 'cust-1',
        resource: 'analytics_db',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('search_lf_by_tags', () => {
    it('returns resources matching tag values', async () => {
      const result = await server.callTool('search_lf_by_tags', {
        customerId: 'cust-1',
        tags: ['pii'],
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── Azure Purview tools ─────────────────────────────────────────────

  describe('search_purview_entities', () => {
    it('returns entities from Purview', async () => {
      const result = await server.callTool('search_purview_entities', {
        customerId: 'cust-1',
        query: 'customers',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('entities');
      expect(data.entities.length).toBeGreaterThan(0);
    });
  });

  describe('get_purview_entity', () => {
    it('returns an entity by GUID', async () => {
      const result = await server.callTool('get_purview_entity', {
        customerId: 'cust-1',
        guid: 'pv-001',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('guid');
      expect(data.guid).toBe('pv-001');
    });
  });

  describe('get_purview_lineage', () => {
    it('returns lineage for an entity', async () => {
      const result = await server.callTool('get_purview_lineage', {
        customerId: 'cust-1',
        guid: 'pv-004',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('relations');
      expect(data.relations.length).toBeGreaterThan(0);
    });
  });

  describe('list_purview_glossary', () => {
    it('returns glossary terms', async () => {
      const result = await server.callTool('list_purview_glossary', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── Google Dataplex tools ───────────────────────────────────────────

  describe('list_dataplex_lakes', () => {
    it('returns lakes from Dataplex', async () => {
      const result = await server.callTool('list_dataplex_lakes', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('list_dataplex_entities', () => {
    it('returns entities in a zone', async () => {
      const result = await server.callTool('list_dataplex_entities', {
        customerId: 'cust-1',
        zone: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_dataplex_entity', () => {
    it('returns entity details', async () => {
      const result = await server.callTool('get_dataplex_entity', {
        customerId: 'cust-1',
        name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone/entities/customers',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('displayName');
      expect(data.displayName).toBe('customers');
    });
  });

  describe('search_dataplex_entries', () => {
    it('returns matching entries', async () => {
      const result = await server.callTool('search_dataplex_entries', {
        customerId: 'cust-1',
        query: 'orders',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── Apache Nessie tools ─────────────────────────────────────────────

  describe('list_nessie_branches', () => {
    it('returns branches and tags', async () => {
      const result = await server.callTool('list_nessie_branches', { customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('list_nessie_tables', () => {
    it('returns tables on a branch', async () => {
      const result = await server.callTool('list_nessie_tables', {
        customerId: 'cust-1',
        ref: 'main',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('get_nessie_content', () => {
    it('returns table metadata', async () => {
      const result = await server.callTool('get_nessie_content', {
        customerId: 'cust-1',
        ref: 'main',
        key: 'warehouse.analytics.customers',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('metadataLocation');
    });
  });

  describe('create_nessie_branch', () => {
    it('creates a new branch', async () => {
      const result = await server.callTool('create_nessie_branch', {
        customerId: 'cust-1',
        name: 'test-branch-tool',
        from: 'main',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data).toHaveProperty('name', 'test-branch-tool');
      expect(data).toHaveProperty('type', 'BRANCH');
    });
  });

  describe('diff_nessie_refs', () => {
    it('returns diff between refs', async () => {
      const result = await server.callTool('diff_nessie_refs', {
        customerId: 'cust-1',
        from: 'main',
        to: 'develop',
      });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  // ── Error handling tests ────────────────────────────────────────────

  describe('error handling', () => {
    it('returns error for invalid Snowflake table DDL request', async () => {
      const result = await server.callTool('get_snowflake_table_ddl', {
        customerId: 'cust-1',
        database: 'NONEXISTENT',
        schema: 'NONEXISTENT',
        table: 'NONEXISTENT',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid BigQuery table schema request', async () => {
      const result = await server.callTool('get_bigquery_table_schema', {
        customerId: 'cust-1',
        datasetId: 'nonexistent_dataset',
        tableId: 'nonexistent_table',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid Databricks table request', async () => {
      const result = await server.callTool('get_databricks_table', {
        customerId: 'cust-1',
        catalog: 'nonexistent',
        schema: 'nonexistent',
        table: 'nonexistent',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid Glue table request', async () => {
      const result = await server.callTool('get_glue_table', {
        customerId: 'cust-1',
        database: 'nonexistent',
        table: 'nonexistent',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid Hive table request', async () => {
      const result = await server.callTool('get_hive_table_schema', {
        customerId: 'cust-1',
        database: 'nonexistent',
        table: 'nonexistent',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid OpenMetadata table request', async () => {
      const result = await server.callTool('get_om_table', {
        customerId: 'cust-1',
        tableId: 'nonexistent',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid DataHub dataset request', async () => {
      const result = await server.callTool('get_datahub_dataset', {
        customerId: 'cust-1',
        urn: 'nonexistent',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid Purview entity request', async () => {
      const result = await server.callTool('get_purview_entity', {
        customerId: 'cust-1',
        guid: 'nonexistent',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid Dataplex entity request', async () => {
      const result = await server.callTool('get_dataplex_entity', {
        customerId: 'cust-1',
        name: 'nonexistent',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });

    it('returns error for invalid Nessie content request', async () => {
      const result = await server.callTool('get_nessie_content', {
        customerId: 'cust-1',
        ref: 'main',
        key: 'nonexistent.table',
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
    });
  });
});
