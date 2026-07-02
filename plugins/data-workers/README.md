# Data Workers Plugin for Claude Code

Trace lineage, audit data quality, and root-cause data incidents with the Data Workers Community Edition agent swarm, served through one local MCP server.

## Installation

```bash
claude plugin marketplace add DataWorkersProject/dataworkers-claw-community
claude plugin install data-workers@dataworkers
```

Installing the plugin registers the unified MCP server (`npx -y dw-claw`, 160+ tools) and three skills:

| Skill | What it does |
|---|---|
| `/data-workers:trace-lineage` | Source-to-consumer lineage for any table or column, across catalogs |
| `/data-workers:quality-audit` | Quality score, rule checks, anomalies with context, fixes ranked by impact |
| `/data-workers:incident-rca` | Walk a data incident from symptom to root cause with the evidence chain |

The server runs locally over stdio against in-memory sample data (tables like `analytics.orders`) until you connect real infrastructure:

```bash
npx dw-claw setup   # Snowflake / BigQuery / Databricks credentials → local .env
```

Grok Build reads Claude Code plugins natively, so the same install works there unchanged.

Community Edition scope: skills are read-only/diagnostic. Requires Node.js 20+. Docs: [dataworkers.io/docs/claude-code-setup](https://dataworkers.io/docs/claude-code-setup/).
