# Cursor Setup — Community Edition

> Complete onboarding guide for Data Workers Community Edition in Cursor.

## Prerequisites

- **Cursor** — Latest version with MCP support.
- **Node.js 20+** — Check with `node --version`.
- **Data Workers cloned and installed:**

```bash
git clone https://github.com/DataWorkersProject/dataworkers-claw-community
cd data-workers
npm install
```

## Option 1: Project-Scoped Configuration (Recommended)

Create or edit `.cursor/mcp.json` in your project root:

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

Commit this file to git so your team gets the same setup automatically.

## Option 2: Cursor Settings UI (Global)

1. Open Cursor Settings (`Cmd+,` / `Ctrl+,`).
2. Navigate to **MCP Servers**.
3. Click **Add Server**.
4. Enter:
   - **Name:** `data-workers`
   - **Command:** `node`
   - **Args:** `<path-to-data-workers>/agents/dw-connectors/dist/index.js`
5. Save and **restart Cursor**.

## Project-Scoped vs Global

- **Project-scoped (`.cursor/mcp.json`):** Best for teams. Commit to git.
- **Global (Cursor Settings):** Best for individual use across all projects.
- Project-scoped takes precedence if both are configured.

## Restart Cursor

**Important:** Restart Cursor after adding or modifying MCP configuration. Servers are loaded at startup.

## Verify Connection

After restarting, type in the Cursor chat:

> List all available Data Workers tools and show me the health of my data pipelines.

All community tools operate in **read-only** mode — diagnostics, analysis, discovery, and recommendations.

## InMemory Stubs on First Run

Without infrastructure credentials, the server starts with InMemory stub data. Set environment variables to connect to real infrastructure.

## First 5 Workflows to Try

1. **Incident diagnosis:** *"Why did my nightly ETL pipeline fail?"*
2. **Data quality check:** *"Run a quality assessment on analytics.orders."*
3. **Catalog search:** *"Search the catalog for tables related to customer revenue."*
4. **Schema analysis:** *"Analyze the schema of staging.events."*
5. **Pipeline health:** *"Show pipeline health across all orchestrators."*

## Individual Agent Configuration

```json
{
  "mcpServers": {
    "dw-incident": {
      "command": "node",
      "args": ["<path-to-data-workers>/agents/dw-incidents/dist/index.js"]
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

## Team Setup

- Add `.cursor/mcp.json` to your project root and commit to git.
- Store credentials in `.env` (add to `.gitignore`).

## Troubleshooting

- **Tools not appearing** — Restart Cursor. MCP servers are loaded at startup.
- **Config key is `mcpServers` not `mcp.servers`** — Cursor uses camelCase `mcpServers`.
- **Server crashes** — Run `node agents/dw-connectors/dist/index.js` manually to see errors.
- **Env vars not picked up** — Launch Cursor from terminal (`cursor .`) to inherit shell environment.

Need help? [Open an issue](https://github.com/DataWorkersProject/dataworkers-claw-community/issues) or join [Discord](https://discord.com/invite/b8DR5J53).
