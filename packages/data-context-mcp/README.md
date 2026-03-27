# data-context-mcp

Standalone MCP (Model Context Protocol) server for data context and catalog operations. This is the free-tier OSS entry point for [Data Workers](https://github.com/anthropics/data-workers) -- giving AI assistants deep understanding of your data assets, lineage, documentation, and impact analysis.

## Quick Start

```bash
npx data-context-mcp
```

No configuration needed. The server starts with in-memory backends seeded with sample data so you can explore immediately.

## Claude Desktop Integration

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "data-context": {
      "command": "npx",
      "args": ["data-context-mcp"]
    }
  }
}
```

Then ask Claude things like:
- "What tables do we have related to orders?"
- "Trace the lineage of the revenue_daily table"
- "What would break if I changed the customers table?"
- "Explain the orders table"

## Tools

### Read-Only Tools (Free -- Community Tier)

All 20 read-only tools are available without any license:

| Tool | Description |
|------|-------------|
| `search_datasets` | Natural language search over the data catalog |
| `search_across_platforms` | Federated cross-platform search with hybrid retrieval |
| `get_lineage` | Column-level lineage traversal |
| `trace_cross_platform_lineage` | Unified cross-platform lineage tracing |
| `resolve_metric` | Metric name disambiguation via semantic layer |
| `list_semantic_definitions` | Browse semantic layer definitions |
| `get_documentation` | Retrieve auto-generated asset documentation |
| `check_freshness` | Data freshness and SLA compliance checks |
| `get_context` | Complete context for a data asset in a single call |
| `explain_table` | Hero tool -- full table explanation with schema, lineage, quality |
| `assess_impact` | Downstream impact assessment for asset changes |
| `blast_radius_analysis` | Column-level, cross-platform blast radius with PR diff support |
| `detect_dead_assets` | Find orphaned tables, columns, and DAG nodes |
| `correlate_metadata` | Cross-platform metadata enrichment and correlation |
| `get_table_schema_for_sql` | Schema info optimized for SQL generation |
| `query_rules` | Search and browse business rules |
| `get_authoritative_source` | Look up authoritative source for a domain/concept |
| `analyze_query_history` | Analyze query patterns and usage history |
| `identify_golden_path` | Identify recommended query paths for data access |
| `check_staleness` | Check if context/documentation is stale |

### Write Tools (Pro Tier)

These 11 tools require `DW_LICENSE_TIER=pro` (or higher):

| Tool | Description |
|------|-------------|
| `generate_documentation` | Generate and persist documentation with provenance |
| `update_lineage` | Additive lineage edge management with soft-delete |
| `auto_tag_dataset` | Auto-classify datasets with tags (with rollback) |
| `flag_documentation_gap` | Flag missing or stale documentation |
| `define_business_rule` | Create business rules for data assets |
| `import_tribal_knowledge` | Batch import tribal knowledge as business rules |
| `update_business_rule` | Update existing business rules |
| `mark_authoritative` | Designate an asset as authoritative for a domain |
| `revoke_authority` | Revoke authority designation |
| `correct_response` | Submit corrections to context/documentation |
| `flag_stale_context` | Flag context as stale with reason |

### Admin Tools (Enterprise Tier)

These 2 tools require `DW_LICENSE_TIER=enterprise`:

| Tool | Description |
|------|-------------|
| `ingest_unstructured_context` | Ingest unstructured context from Slack, Confluence, etc. |
| `run_data_steward` | Enterprise data steward workflow automation |

## Environment Variables

### License Tier

| Variable | Values | Default |
|----------|--------|---------|
| `DW_LICENSE_TIER` | `community`, `pro`, `enterprise` | `community` |

### Data Platform Connectors

Set these to connect to your real data infrastructure instead of in-memory backends:

| Variable | Description |
|----------|-------------|
| `SNOWFLAKE_ACCOUNT` | Snowflake account identifier |
| `SNOWFLAKE_USERNAME` | Snowflake username |
| `SNOWFLAKE_PASSWORD` | Snowflake password |
| `SNOWFLAKE_WAREHOUSE` | Snowflake warehouse name |
| `SNOWFLAKE_DATABASE` | Snowflake database name |
| `GCP_PROJECT` | Google Cloud project ID (for BigQuery) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account key |
| `DBT_PROJECT_DIR` | Path to dbt project directory |
| `DBT_PROFILES_DIR` | Path to dbt profiles directory |
| `DATABRICKS_HOST` | Databricks workspace URL |
| `DATABRICKS_TOKEN` | Databricks personal access token |
| `REDSHIFT_HOST` | Amazon Redshift cluster endpoint |
| `REDSHIFT_DATABASE` | Redshift database name |
| `REDSHIFT_USER` | Redshift username |
| `REDSHIFT_PASSWORD` | Redshift password |

## How It Works

This package bundles the `dw-context-catalog` agent from the Data Workers platform as a standalone MCP server. It communicates via JSON-RPC 2.0 over stdio (stdin/stdout), which is the standard MCP transport for local tools.

- **Community tier** (default): All read-only tools work out of the box. Write tools return an upgrade prompt.
- **Pro tier**: Unlocks write tools for documentation generation, lineage management, tagging, and business rules.
- **Enterprise tier**: Adds admin tools for unstructured context ingestion and data steward workflows.

## License

Apache-2.0
