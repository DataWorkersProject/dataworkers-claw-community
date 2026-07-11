# DataWorkers Onboarding

You are running the DataWorkers onboarding flow. Guide the user through getting started with the DataWorkers MCP platform.

## Step 1: Environment Detection

First, check what's available:
1. Run `docker ps` to see if Docker containers are running
2. Check for environment variables: SNOWFLAKE_ACCOUNT, BIGQUERY_PROJECT, DBT_PROJECT_DIR
3. Check if the .mcp.json is configured

Report findings to the user.

## Step 2: Offer Paths

Present these options:

**Option A: Sandbox Demo (0 min setup)**
Try DataWorkers immediately with pre-seeded demo data. 22 assets with full lineage, 35+ metrics, quality scores, and business rules. No external connections needed.

**Option B: Connect Your Data (5 min setup)**
Connect to your existing data infrastructure:
- Snowflake: Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USERNAME, SNOWFLAKE_PASSWORD
- BigQuery: Set GOOGLE_APPLICATION_CREDENTIALS
- dbt: Set DBT_PROJECT_DIR to your dbt project path
- DataHub/OpenMetadata: Set the respective API URLs

**Option C: Local Test Database (2 min setup)**
Spin up PostgreSQL with Docker and load sample e-commerce data:
```
docker compose up -d postgres
```

Ask the user which path they'd like.

## Step 3A: Sandbox Demo

If the user picks sandbox, run this demo sequence using `customerId: "cust-001"`:

1. **Search**: `search_datasets({ query: "customer orders revenue", customerId: "cust-001" })` — show them the catalog
2. **Explain**: `explain_table({ assetId: "orders" })` — the hero tool, 360-degree view
3. **Lineage**: `get_lineage({ assetId: "stg-orders", customerId: "cust-001" })` — trace data flow
4. **Metrics**: `resolve_metric({ metricName: "revenue", customerId: "cust-001" })` — semantic layer
5. **Quality**: `run_quality_check({ datasetId: "orders", customerId: "cust-001" })` — data quality
6. **Schema**: `detect_schema_change({ source: "snowflake", customerId: "cust-001" })` — schema monitoring
7. **Incidents**: `diagnose_incident` with sample anomaly signals — incident diagnosis
8. **Governance**: `check_policy({ action: "write", resource: "production.orders", agentId: "etl-agent", customerId: "cust-001" })` — policy check
9. **Pipelines**: `list_pipeline_templates()` — available templates
10. **Observability**: `list_active_agents()` — agent health
11. **Usage**: `get_adoption_dashboard()` — platform adoption

After each call, briefly explain what the user is seeing and why it matters.

## Step 3B: Connect Your Data

For each platform the user wants to connect:

### Snowflake
```bash
export SNOWFLAKE_ACCOUNT=your_account
export SNOWFLAKE_USERNAME=your_user
export SNOWFLAKE_PASSWORD=your_pass
export SNOWFLAKE_WAREHOUSE=your_warehouse
export SNOWFLAKE_DATABASE=your_db
```
Then test: `list_snowflake_databases({ customerId: "cust-001" })`

### BigQuery
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export BIGQUERY_PROJECT=your-project-id
```
Then test: `list_bigquery_datasets({ customerId: "cust-001" })`

### dbt
```bash
export DBT_PROJECT_DIR=/path/to/dbt/project
```
Then test: `list_dbt_models({ customerId: "cust-001" })`

After connecting, run `explain_table` on one of their real tables to show first value.

## Step 3C: Local Test Database

1. Start Postgres: `docker compose up -d postgres`
2. Wait for health check
3. Connect and create sample tables
4. Run DW tools against the local data

## Step 4: What's Next

After the demo, suggest:
- "Try `explain_table` on any of your tables for a full context view"
- "Use `search_datasets` with natural language to find data assets"
- "Set up `run_quality_check` in a pipeline for continuous monitoring"
- "Use `diagnose_incident` when anomalies are detected"
- "Check `get_adoption_dashboard` to track platform usage"

## Important Notes
- Demo tenant ID: `cust-001` (all seed data uses this)
- Community Edition uses in-memory stores — data resets on agent restart
- Pro tier unlocks: PII scanning, advanced governance, production persistence
