# GitHub Copilot Setup — Community Edition

> Setup guide for Data Workers Community Edition with GitHub Copilot in VS Code.

## Prerequisites

- **VS Code 1.99 or later** — MCP support requires recent VS Code.
- **GitHub Copilot extension** — Latest version.
- **Node.js 20+** — Check with `node --version`.
- **Data Workers cloned and installed:**

```bash
git clone https://github.com/DhanushAShetty/dw-claw-community
cd data-workers
npm install
```

## Configure VS Code settings.json

Open VS Code settings, switch to JSON view, and add:

```json
"mcp.servers": {
  "data-workers": {
    "command": "node",
    "args": ["<path-to-data-workers>/agents/dw-connectors/dist/index.js"]
  }
}
```

**Important:** GitHub Copilot uses `mcp.servers` (with a dot) — NOT `mcpServers` (camelCase).

## Activate Agent Mode

Type `@workspace` before your prompt in the Copilot Chat panel to enable MCP tool calls.

## Verify Connection

> @workspace List all available Data Workers tools and show me pipeline health.

All community tools operate in **read-only** mode.

## First 5 Workflows to Try

1. *"@workspace Why did my nightly ETL pipeline fail?"*
2. *"@workspace Run a quality assessment on analytics.orders."*
3. *"@workspace Search the catalog for tables related to customer revenue."*
4. *"@workspace Analyze the schema of staging.events."*
5. *"@workspace Show pipeline health across all orchestrators."*

## Key Differences from Other Clients

- **Config key:** `mcp.servers` (not `mcpServers`)
- **Agent mode required:** Prefix prompts with `@workspace`
- **Newer integration:** Expect improvements as GitHub iterates

## Environment Variables

| Variable | Service |
|----------|---------|
| `SNOWFLAKE_ACCOUNT` | Snowflake |
| `SNOWFLAKE_USERNAME` | Snowflake |
| `SNOWFLAKE_PASSWORD` | Snowflake |
| `GOOGLE_CLOUD_PROJECT` | BigQuery |
| `GOOGLE_APPLICATION_CREDENTIALS` | BigQuery / Dataplex |
| `DATABRICKS_HOST` | Databricks |
| `DATABRICKS_TOKEN` | Databricks |

## Troubleshooting

- **Tools not appearing** — Ensure VS Code 1.99+ and Copilot extension is updated. Restart VS Code.
- **Wrong config key** — Use `mcp.servers` (dot), not `mcpServers` (camelCase).
- **@workspace not working** — Ensure agent mode is active in Copilot Chat.

Need help? [Open an issue](https://github.com/DhanushAShetty/dw-claw-community/issues) or join [Discord](https://discord.com/invite/b8DR5J53).
