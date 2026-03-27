# OpenCode Setup — Community Edition

> Getting started with Data Workers Community Edition in [OpenCode](https://opencode.ai).

## Prerequisites

- **OpenCode** — v1.3+ installed. Get it at [opencode.ai](https://opencode.ai) or `brew install opencode`.
- **Node.js 20+** — Check with `node --version`.

## Quick Start (60 seconds)

### Option 1: Starter config (recommended first step)

Add to your `opencode.json`:

```json
{
  "mcp": {
    "data-context": {
      "type": "local",
      "command": ["npx", "-y", "data-context-mcp"],
      "enabled": true
    }
  }
}
```

This gives you 5 core tools: catalog search, lineage tracing, quality checks, schema discovery, and asset classification.

### Option 2: Auto-generate full config

```bash
npx dw-claw opencode
```

This creates `opencode.json` with all 11 agents (160+ tools) pre-configured.

### Option 3: Setup script

```bash
curl -fsSL https://raw.githubusercontent.com/DataWorkersProject/dataworkers-claw-community/main/scripts/setup-opencode.sh | bash
```

## Full Agent Configuration

Drop this into your `opencode.json` to get all 11 agents:

```json
{
  "mcp": {
    "dw-pipelines": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-pipelines"],
      "enabled": true
    },
    "dw-incidents": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-incidents"],
      "enabled": true
    },
    "dw-catalog": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-context-catalog"],
      "enabled": true
    },
    "dw-quality": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-quality"],
      "enabled": true
    },
    "dw-schema": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-schema"],
      "enabled": true
    },
    "dw-governance": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-governance"],
      "enabled": true
    },
    "dw-observability": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-observability"],
      "enabled": true
    },
    "dw-connectors": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-connectors"],
      "enabled": true
    },
    "dw-usage-intelligence": {
      "type": "local",
      "command": ["npx", "-y", "@data-workers/dw-usage-intelligence"],
      "enabled": true
    }
  }
}
```

## Custom Agent: Data Engineer Mode

Copy `.opencode/agents/data-engineer.md` from the Data Workers repo into your project's `.opencode/agents/` directory. This adds a dedicated "Data Engineer" agent mode with all Data Workers tools pre-enabled.

## Verify Setup

Launch OpenCode in your project directory:

```bash
opencode
```

Then try these prompts:

1. **Catalog search:** "Search the catalog for tables related to customer revenue"
2. **Lineage tracing:** "Show me the full lineage for analytics.orders"
3. **Quality check:** "Run a quality assessment on staging.events"
4. **Pipeline debugging:** "Why did my nightly ETL pipeline fail?"
5. **Schema analysis:** "Compare the schema of staging.events with production"

## InMemory Stubs

Without infrastructure credentials, agents start with InMemory stub data including sample datasets like `analytics.orders`, `staging.customers`, and `raw.events`. This confirms everything is working.

## Connect Real Data Platforms

Set environment variables to connect to your actual data stack:

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

## Also Works With

Data Workers uses the MCP protocol, so it works with any MCP-compatible client:

- [Claude Code](./claude-code.md)
- [Cursor](./cursor.md)
- [GitHub Copilot](./github-copilot.md)
- [Microsoft Copilot](./microsoft-copilot.md)

## Troubleshooting

- **Tools not showing up** — Restart OpenCode after modifying `opencode.json`.
- **"Agent not found"** — Ensure Node.js 20+ is installed and `npx` is in your PATH.
- **Timeout errors** — Some agents take 5-10s to initialize on first run (npm downloads).
- **Too many tools** — Start with the starter config (`data-context-mcp`) and add agents incrementally.

Need help? [Open an issue](https://github.com/DataWorkersProject/dataworkers-claw-community/issues) or join [Discord](https://discord.com/invite/b8DR5J53).
