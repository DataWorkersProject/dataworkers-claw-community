# Getting Started with Data Workers Claw

> **Data Workers Claw Community Edition** — Getting started guide for the open-source autonomous agent swarm for data engineering.

This guide walks you through installing Data Workers Claw and connecting it to your preferred MCP client.

## Prerequisites

- **Node.js >= 20** — Data Workers requires Node.js 20 or later. Check your version with `node --version`.

## Installation

### Clone and Install

```bash
git clone https://github.com/DhanushAShetty/dw-claw-community
cd data-workers
npm install
```

### Verify Installation

```bash
npm test
```

This runs the full test suite (3,061+ tests across 149+ files) to confirm everything is working.

## Quick Start — Single Install Command

The fastest way to get started is the single install command, which registers all Data Workers agents with your MCP client:

```bash
npx dw-claw
```

This auto-detects your MCP client (Claude Code, Cursor, etc.) and configures all agents.

## Platform Setup

### Claude Code

**Option 1: Unified connector agent (recommended)**

```bash
claude mcp add data-workers -- node agents/dw-connectors/dist/index.js
```

This registers the unified connector agent with tools spanning all 49 data platform connectors (14 catalog + 35 enterprise).

**Option 2: Manual `.mcp.json` configuration**

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "data-workers": {
      "command": "node",
      "args": ["<path-to-data-workers>/agents/dw-connectors/dist/index.js"]
    }
  }
}
```

**Option 3: Individual agents**

You can register agents individually if you only need specific capabilities:

```json
{
  "mcpServers": {
    "dw-pipelines": {
      "command": "node",
      "args": ["<path-to-data-workers>/agents/dw-pipelines/dist/index.js"]
    },
    "dw-quality": {
      "command": "node",
      "args": ["<path-to-data-workers>/agents/dw-quality/dist/index.js"]
    }
  }
}
```

Available individual agents: `dw-pipelines`, `dw-incidents`, `dw-context-catalog`, `dw-schema`, `dw-quality`, `dw-governance`, `dw-usage-intelligence`, `dw-observability`, `dw-connectors`, `dw-orchestration`, `dw-ml`.

### Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "data-workers": {
      "command": "node",
      "args": ["<path-to-data-workers>/agents/dw-connectors/dist/index.js"]
    }
  }
}
```

Or configure via **Cursor Settings > MCP Servers > Add Server** and provide:
- **Name:** `data-workers`
- **Command:** `node`
- **Args:** `<path-to-data-workers>/agents/dw-connectors/dist/index.js`

### OpenClaw

Configure your OpenClaw instance:

```yaml
# openclaw.config.yml
mcp_servers:
  - name: data-workers
    transport: stdio
    command: node
    args:
      - "<path-to-data-workers>/agents/dw-connectors/dist/index.js"
```

### Other MCP Clients

Data Workers agents are standard MCP servers using stdio transport. Any MCP-compatible client can connect by running:

```
node <path-to-data-workers>/agents/dw-connectors/dist/index.js
```

## Dedicated Platform Guides

For in-depth onboarding, first workflows, and platform-specific troubleshooting, see:

- [Claude Code Setup](./setup/claude-code.md) — Deep-dive installation, verification, and team config
- [Cursor Setup](./setup/cursor.md) — Full onboarding including UI configuration and team sharing
- [GitHub Copilot Setup](./setup/github-copilot.md) — VS Code configuration and @workspace activation
- [Microsoft Copilot Setup](./setup/microsoft-copilot.md) — Current status and compatibility notes
- [OpenClaw, Cline & Continue Setup](./setup/openclaw.md) — Configuration for any MCP-compatible client

## Connecting to Real Infrastructure

By default, Data Workers uses in-memory stubs that work out of the box with no external dependencies. To connect to real infrastructure, set the relevant environment variables and the `fromEnv()` auto-detection will use real adapters automatically.

| Variable | Service | Purpose |
|----------|---------|---------|
| `SNOWFLAKE_ACCOUNT` | Snowflake | Account identifier |
| `SNOWFLAKE_USERNAME` | Snowflake | Authentication user |
| `SNOWFLAKE_PASSWORD` | Snowflake | Authentication password |
| `GOOGLE_CLOUD_PROJECT` | BigQuery | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | BigQuery / Dataplex | Service account key path |
| `DATABRICKS_HOST` | Databricks | Workspace URL |
| `DATABRICKS_TOKEN` | Databricks | Personal access token |
| `DBT_API_TOKEN` | dbt Cloud | API token |
| `DBT_ACCOUNT_ID` | dbt Cloud | Account identifier |
| `AWS_ACCESS_KEY_ID` | Glue / Lake Formation | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | Glue / Lake Formation | AWS credentials |
| `AWS_REGION` | Glue / Lake Formation | AWS region |
| `HIVE_METASTORE_URI` | Hive Metastore | Thrift URI |
| `OPENMETADATA_HOST` | OpenMetadata | Server URL |
| `OPENMETADATA_TOKEN` | OpenMetadata | JWT token |
| `OPENLINEAGE_URL` | OpenLineage / Marquez | API endpoint |
| `DATAHUB_GMS_URL` | DataHub | GMS endpoint |
| `DATAHUB_TOKEN` | DataHub | Authentication token |
| `PURVIEW_ACCOUNT_NAME` | Microsoft Purview | Account name |
| `AZURE_TENANT_ID` | Microsoft Purview | Azure AD tenant |
| `NESSIE_URI` | Project Nessie | API endpoint |
| `REDIS_URL` | Redis | Connection URL (for real KV/cache) |
| `POSTGRES_URL` | PostgreSQL | Connection URL (for real relational store) |
| `KAFKA_BROKERS` | Kafka | Broker list (for real message bus) |
| `NEO4J_URI` | Neo4j | Connection URL (for real graph DB) |

When no environment variables are set, all connectors return realistic mock data, making Data Workers fully functional for development, testing, and demos without any external services.

## Next Steps

- Browse the [README](../README.md) for the full agent and connector reference
- Check the [FAQ](faq.md) for common questions
- See the [Architecture Guide](ARCHITECTURE.md) for production deployment details
