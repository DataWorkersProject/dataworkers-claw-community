# OpenClaw, Cline & Continue Setup — Community Edition

> Setup guide for Data Workers Community Edition with OpenClaw, Cline, Continue, and any MCP client.

## Prerequisites

- **Your MCP client** — OpenClaw, Cline, Continue, or any client supporting MCP stdio transport.
- **Node.js 20+** — Check with `node --version`.
- **Data Workers cloned and installed:**

```bash
git clone https://github.com/DhanushAShetty/dw-claw-community
cd data-workers
npm install
```

## OpenClaw

```yaml
# openclaw.config.yml
mcp_servers:
  - name: data-workers
    transport: stdio
    command: node
    args:
      - "<path-to-data-workers>/agents/dw-connectors/dist/index.js"
```

## Cline

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

## Continue

**Global:** `~/.continue/config.json`
**Project-level:** `.continue/config.json`

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

## Any Other MCP Client

```bash
node <path-to-data-workers>/agents/dw-connectors/dist/index.js
```

## Verify Connection

> List all available Data Workers tools and show me the health of my data pipelines.

All community tools operate in **read-only** mode.

## First 5 Workflows to Try

1. *"Why did my nightly ETL pipeline fail?"*
2. *"Run a quality assessment on analytics.orders."*
3. *"Search the catalog for tables related to customer revenue."*
4. *"Analyze the schema of staging.events."*
5. *"Show pipeline health across all orchestrators."*

## Environment Variables

| Variable | Service |
|----------|---------|
| `SNOWFLAKE_ACCOUNT` | Snowflake |
| `SNOWFLAKE_USERNAME` | Snowflake |
| `SNOWFLAKE_PASSWORD` | Snowflake |
| `GOOGLE_CLOUD_PROJECT` | BigQuery |
| `DATABRICKS_HOST` | Databricks |
| `DATABRICKS_TOKEN` | Databricks |

## Troubleshooting

- **Tools not appearing** — Restart your client after configuration.
- **Server not starting** — Run `node agents/dw-connectors/dist/index.js` manually to see errors.
- **Config key** — Most clients use `mcpServers` (camelCase). Check your client's docs.

Need help? [Open an issue](https://github.com/DhanushAShetty/dw-claw-community/issues) or join [Discord](https://discord.com/invite/b8DR5J53).
