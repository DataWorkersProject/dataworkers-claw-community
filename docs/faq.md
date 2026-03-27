# Frequently Asked Questions

## What platforms are supported?

Data Workers works with any MCP-compatible client, including:

- **Claude Code** — via `.mcp.json` or `claude mcp add`
- **Cursor** — via `.cursor/mcp.json` or Cursor Settings
- **OpenClaw** — via `openclaw.config.yml`
- **Any MCP client** — Data Workers agents use standard stdio transport

## Do I need real infrastructure to use Data Workers?

No. Data Workers ships with 9 in-memory infrastructure stubs that work out of the box. All connectors return realistic mock data by default, so you can explore every tool without setting up Snowflake, BigQuery, Kafka, or any other service.

When you are ready to connect to real infrastructure, set the relevant environment variables and the `fromEnv()` auto-detection will switch to real adapters automatically. See the [Getting Started guide](getting-started.md) for the full environment variable reference.

## How do I connect to my real Snowflake / BigQuery / Databricks / etc.?

Set the appropriate environment variables before starting the agent. Each connector uses `fromEnv()` to auto-detect credentials:

```bash
# Example: connect to real Snowflake
export SNOWFLAKE_ACCOUNT=myorg-myaccount
export SNOWFLAKE_USERNAME=myuser
export SNOWFLAKE_PASSWORD=mypassword

# Example: connect to real BigQuery
export GOOGLE_CLOUD_PROJECT=my-gcp-project
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Example: connect to real Databricks
export DATABRICKS_HOST=https://myworkspace.databricks.com
export DATABRICKS_TOKEN=dapi1234567890
```

No code changes are needed. The connector detects the environment variables and uses real API calls instead of stubs.

## How many agents and tools are there?

Data Workers includes:

- **11 agents** — 9 domain agents + 1 unified connector agent + 1 orchestration agent
- **160+ MCP tools** across all agents and connectors
- **49 connectors (14 catalog + 35 enterprise)** — 14 catalog connectors (Iceberg, Polaris, Snowflake, BigQuery, dbt, Databricks, Glue, Lake Formation, Hive Metastore, OpenMetadata, OpenLineage, DataHub, Purview, Dataplex) + 35 enterprise connectors — orchestration (Airflow, Dagster, Prefect, Step Functions, Azure Data Factory, dbt Cloud, Temporal, Mage, Kestra, Argo), alerting (PagerDuty, Slack, Teams, OpsGenie, New Relic), identity (Okta, Azure AD), observability (OpenTelemetry, Datadog), quality (Great Expectations, Soda, Monte Carlo, Anomalo, Bigeye, Elementary), BI (Looker, Tableau, Metabase, Sigma, Superset), ITSM (ServiceNow, Jira Service Management)
- **9 infrastructure adapters** — VectorStore, GraphDB, Full-Text Search, Key-Value, Relational, MessageBus, LLMClient, OrchestratorAPI, WarehouseConnector (each with in-memory stub + real adapter)
- **3,061+ tests** across 149+ files

## Can I use individual agents instead of all of them?

Yes. Each agent is a standalone MCP server. You can register only the agents you need:

```bash
# Just the pipeline builder
claude mcp add dw-pipelines -- node agents/dw-pipelines/dist/index.js

# Just the quality monitor
claude mcp add dw-quality -- node agents/dw-quality/dist/index.js
```

Or add multiple agents individually in your `.mcp.json`. See the [Getting Started guide](getting-started.md) for examples.

## What is the dw-connectors agent?

The `dw-connectors` agent is a unified MCP gateway that exposes tools spanning all 49 data platform connectors (14 catalog + 35 enterprise). Instead of configuring separate connector servers, you register one agent and get access to all connector tools (list tables, get schemas, query lineage, etc.) across every supported platform.

## What is the difference between stubs and real adapters?

- **Stubs** (default): In-memory implementations that return realistic mock data. No external services needed. Perfect for development, testing, and demos.
- **Real adapters**: Connect to actual infrastructure (Redis, PostgreSQL, Kafka, Neo4j) and data platforms (Snowflake, BigQuery, etc.) via environment variable detection. Same API, real data.

The `fromEnv()` pattern means your code does not change — only the environment variables determine which backend is used.

## How do I run the tests?

```bash
cd data-workers
npm test
```

Or run specific test files:

```bash
npx vitest run agents/dw-connectors/src/__tests__/tools.test.ts
npx vitest run connectors/snowflake/src/__tests__/connector.test.ts
```

## Is Data Workers production-ready?

The architecture is complete and tested. For production use:

1. Set environment variables for your real data platforms
2. Configure real infrastructure adapters (Redis, PostgreSQL, Kafka, Neo4j) for persistent state
3. Review the [Architecture Guide](ARCHITECTURE.md) and [API Reference](API.md) for production deployment details

The in-memory stubs are suitable for development and evaluation. Production deployments should use real infrastructure adapters for durability and scale.
