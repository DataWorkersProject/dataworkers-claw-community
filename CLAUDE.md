# DataWorkers — AI Agent Platform for Data Engineering

## Quick Start

All MCP servers work out of the box with in-memory seed data. Use `customerId: "cust-001"` for the demo tenant.

**Hero tool** — get a 360-degree view of any table:
```
explain_table({ assetId: "orders" })
```

**Search the catalog:**
```
search_datasets({ query: "customer revenue", customerId: "cust-001" })
```

## Architecture

- **Monorepo**: `agents/`, `core/`, `connectors/`, `packages/`
- **Language**: TypeScript, Node.js 20+
- **Tests**: Vitest (`npm test`)
- **Build**: `npm run build`
- **MCP Config**: `.mcp.json` — 10 MCP servers launched via `start-agent.sh`

## 10 MCP Servers

| Server | Key Tools | What It Does |
|--------|-----------|--------------|
| dw-catalog | explain_table, search_datasets, get_lineage, resolve_metric | Data catalog, search, lineage, semantic layer |
| dw-quality | run_quality_check, get_quality_summary, get_anomalies | Quality profiling, anomaly detection, SLAs |
| dw-schema | detect_schema_change, generate_migration, check_compatibility | Schema evolution, migrations, breaking change detection |
| dw-incidents | diagnose_incident, get_root_cause, remediate | Incident diagnosis, root cause analysis |
| dw-governance | check_policy, scan_pii, enforce_rbac | Policy enforcement, PII scanning (Pro: scan_pii) |
| dw-connectors | list_all_catalogs, get_table_from_any_catalog, 90+ tools | 15 platform connectors (Snowflake, BigQuery, dbt, etc.) |
| dw-pipelines | generate_pipeline, list_pipeline_templates, validate_pipeline | Pipeline generation from 13 templates |
| dw-observability | list_active_agents, check_agent_health, detect_drift | Agent health monitoring |
| dw-usage-intelligence | get_adoption_dashboard, get_tool_usage_metrics | Usage analytics, adoption metrics, cost enrichment |
| dw-ml | register_model, train_model, detect_model_drift | ML experiment tracking, model registry |

## Seed Data (Demo Tenant: cust-001)

22 pre-seeded assets with full lineage:
```
raw_orders (postgres) → stg_orders (dbt) → dim_orders (dbt) → Revenue Dashboard (looker)
raw_customers (postgres) → stg_customers (dbt) → dim_customers (dbt) → Customer Analytics (looker)
raw_events (bigquery) → stg_events (dbt) → fct_events (dbt) → Customer Analytics (looker)
```

Plus: orders, customers, daily_revenue, user_events, product_catalog, payment_transactions, inventory_levels, churn_prediction, monthly_active_users, 2 pipelines.

35+ metric definitions across finance, product, marketing, engineering domains.

## Infrastructure

- **Community Edition**: In-memory stubs (`InMemory*` classes in `core/infrastructure-stubs/`)
- **Production**: Factory pattern swaps in PostgreSQL, Neo4j, Redis, pgvector
- **Docker Compose**: `docker compose up -d` for Postgres (pgvector), Redis, Neo4j
- **15 Connectors**: Snowflake, BigQuery, Databricks, dbt, Glue, DataHub, OpenMetadata, Purview, Dataplex, Nessie, Iceberg, Polaris, OpenLineage, Hive, Lake Formation

## Key Patterns

- Each agent: `agents/<name>/src/index.ts` → `DataWorkersMCPServer` → `registerTool()`
- Backends: `agents/<name>/src/backends.ts` — shared store instances
- Enterprise middleware wraps all handlers (no-op in Community Edition)
- Strict tenant isolation: all queries filter by `customerId`
