# Claude Code Setup — Community Edition

> Getting started with Data Workers Community Edition in Claude Code.

## Prerequisites

- **Claude Code** — Latest version. Update with `claude update`.
- **Node.js 20+** — Check with `node --version`.
- **Data Workers cloned and installed:**

```bash
git clone https://github.com/DhanushAShetty/dw-claw-community
cd data-workers
npm install
```

## Install with One Command

```bash
claude mcp add data-workers -- node agents/dw-connectors/dist/index.js
```

This registers all community agents with read-only diagnostic and analysis tools.

## Manual Configuration

Edit your project's `.mcp.json`:

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

## Verify Connection

```bash
claude mcp list
```

Then type in the Claude Code chat:

> List all available Data Workers tools and show me the health of my data pipelines.

All community tools operate in **read-only** mode — diagnostics, analysis, discovery, and recommendations.

## InMemory Stubs on First Run

Without infrastructure credentials, the server starts with InMemory stub data including sample datasets like `analytics.orders`, `staging.customers`, and `raw.events`. This confirms the server is working.

## First 5 Workflows to Try

1. **Incident diagnosis:** *"Why did my nightly ETL pipeline fail? Check logs and provide root cause analysis."*
2. **Data quality check:** *"Run a quality assessment on analytics.orders and flag anomalies."*
3. **Catalog search:** *"Search the catalog for tables related to customer revenue and show lineage."*
4. **Schema analysis:** *"Analyze the schema of staging.events and suggest performance improvements."*
5. **Pipeline health:** *"Show pipeline health across all orchestrators and highlight issues."*

## Individual Agent Configuration

Register agents individually:

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

Available agents: `dw-pipelines`, `dw-incidents`, `dw-context-catalog`, `dw-schema`, `dw-quality`, `dw-governance`, `dw-usage-intelligence`, `dw-observability`, `dw-connectors`, `dw-orchestration`, `dw-ml`.

## Environment Variables

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

## Team Setup

Add `.mcp.json` to your project root and commit to git. Store credentials in `.env` (add to `.gitignore`).

## Troubleshooting

- **"Agent not found"** — Update Claude Code to the latest version.
- **`claude mcp list` shows disconnected** — Run `node agents/dw-connectors/dist/index.js` manually to see errors.
- **No tools discovered** — Restart Claude Code after adding the server.

Need help? [Open an issue](https://github.com/DhanushAShetty/dw-claw-community/issues) or join [Discord](https://discord.com/invite/b8DR5J53).
