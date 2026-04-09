<p align="center">
  <h1 align="center">Data Workers - Open-Source Community Edition</h1>
  <p align="center"><strong>Open-source autonomous AI agents for data engineering</strong></p>
  <p align="center">Stop writing boilerplate pipelines. Stop debugging data incidents manually.<br/>Describe what you need in natural language. The agents handle execution.</p>
</p>

<p align="center">
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQyIDAtOC0zLjU4LTgtOHMzLjU4LTggOC04IDggMy41OCA4IDgtMy41OCA4LTggOHoiLz48L3N2Zz4=" alt="MCP Compatible" /></a>
  <a href="https://claude.ai/claude-code"><img src="https://img.shields.io/badge/Claude_Code-ready-F96854?logo=anthropic&logoColor=white" alt="Claude Code" /></a>
  <a href="https://cursor.com"><img src="https://img.shields.io/badge/Cursor-ready-000000?logo=cursor&logoColor=white" alt="Cursor" /></a>
</p>
<p align="center">
  <a href="https://github.com/DataWorkersProject/dataworkers-claw-community/actions"><img src="https://github.com/DataWorkersProject/dataworkers-claw-community/actions/workflows/ci.yml/badge.svg" alt="Build Status" /></a>
  <a href="https://github.com/DataWorkersProject/dataworkers-claw-community/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <a href="https://github.com/DataWorkersProject/dataworkers-claw-community/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/org/data-workers"><img src="https://img.shields.io/badge/npm-v0.1.0-cb3837?logo=npm" alt="npm" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
</p>

<p align="center">
  11 AI agents &middot; 160+ MCP tools &middot; 15 connectors &middot; 2,900+ tests &middot; Zero config to start
</p>

---

## What is Data Workers?

Data Workers is a coordinated swarm of AI agents that automate the full spectrum of data engineering workflows. Each agent is a standalone [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes domain-specific tools to Claude Code, OpenCode, Cursor, VS Code, and any MCP-compatible client.

**The problem:** Data engineers spend 60%+ of their time on undifferentiated work -- writing pipeline boilerplate, debugging data incidents at 2am, chasing schema changes across teams, manually cataloging assets, and fighting governance paperwork.

**The solution:** 11 autonomous agents that understand your data stack end-to-end. They build pipelines, detect anomalies, manage catalogs, enforce governance, track ML experiments, and more -- all through natural language via the MCP protocol your AI tools already speak.

Everything runs locally with in-memory stubs by default. No external services required. No data leaves your machine. BYO model -- use any LLM provider.

Read more: [Why We Open-Sourced Data Workers](https://dataworkers.io/blog/why-we-open-sourced-14-autonomous-data-engineering-agents)

## Get Started

```bash
git clone https://github.com/DataWorkersProject/dataworkers-claw-community.git
cd dataworkers-claw-community
npm install
```

Then add agents to Claude Code (run from inside the cloned repo):

```bash
claude mcp add dw-pipelines -- "$(pwd)/start-agent.sh" dw-pipelines && \
claude mcp add dw-incidents -- "$(pwd)/start-agent.sh" dw-incidents && \
claude mcp add dw-catalog -- "$(pwd)/start-agent.sh" dw-context-catalog && \
claude mcp add dw-schema -- "$(pwd)/start-agent.sh" dw-schema && \
claude mcp add dw-quality -- "$(pwd)/start-agent.sh" dw-quality && \
claude mcp add dw-governance -- "$(pwd)/start-agent.sh" dw-governance && \
claude mcp add dw-usage -- "$(pwd)/start-agent.sh" dw-usage-intelligence && \
claude mcp add dw-observability -- "$(pwd)/start-agent.sh" dw-observability && \
claude mcp add dw-connectors -- "$(pwd)/start-agent.sh" dw-connectors && \
claude mcp add dw-ml -- "$(pwd)/start-agent.sh" dw-ml
```

Start Claude Code and ask:

- *"Search the catalog for customer-related tables"*
- *"Show me the full lineage for the orders table"*
- *"Why did the orders table row count drop 40% yesterday?"*
- *"Scan the customer schema for PII and suggest masking policies"*
- *"Compare the last two ML experiments and explain the accuracy difference"*

Everything works instantly with in-memory seed data — no infrastructure required.

### Client configuration

Each agent can be started via the `start-agent.sh` script, which handles working directory and dependency resolution. Replace `/path/to/dataworkers-claw-community` with your clone location.

**Claude Code** (`.mcp.json` in your project root):

```json
{
  "mcpServers": {
    "dw-pipelines": {
      "command": "/path/to/dataworkers-claw-community/start-agent.sh",
      "args": ["dw-pipelines"]
    },
    "dw-catalog": {
      "command": "/path/to/dataworkers-claw-community/start-agent.sh",
      "args": ["dw-context-catalog"]
    },
    "dw-quality": {
      "command": "/path/to/dataworkers-claw-community/start-agent.sh",
      "args": ["dw-quality"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`) — same format:

```json
{
  "mcpServers": {
    "dw-pipelines": {
      "command": "/path/to/dataworkers-claw-community/start-agent.sh",
      "args": ["dw-pipelines"]
    },
    "dw-incidents": {
      "command": "/path/to/dataworkers-claw-community/start-agent.sh",
      "args": ["dw-incidents"]
    }
  }
}
```

**OpenCode** (`opencode.json` in your project root):

```json
{
  "mcp": {
    "dw-pipelines": {
      "type": "local",
      "command": ["/path/to/dataworkers-claw-community/start-agent.sh", "dw-pipelines"],
      "enabled": true
    },
    "dw-catalog": {
      "type": "local",
      "command": ["/path/to/dataworkers-claw-community/start-agent.sh", "dw-context-catalog"],
      "enabled": true
    }
  }
}
```

---

## Agents

| Agent | Package | Description | Tools |
|-------|---------|-------------|:-----:|
| **Pipelines** | `dw-pipelines` | NL-to-pipeline generation, template engine, Iceberg MERGE INTO, Kafka events, Airflow deployment. Write tools (`generate_pipeline`, `deploy_pipeline`) require Pro. | 4 |
| **Incidents** | `dw-incidents` | Statistical anomaly detection, graph-based root cause analysis, playbook execution | 5 |
| **Catalog** | `dw-context-catalog` | Hybrid search (vector + BM25 + graph), lineage traversal, Iceberg crawler | 35 |
| **Schema** | `dw-schema` | INFORMATION_SCHEMA diffs, rename detection, Iceberg snapshot evolution | 9 |
| **Quality** | `dw-quality` | Weighted 5-dimension scoring, z-score anomaly detection, 14-day baselines | 6 |
| **Governance** | `dw-governance` | Priority-based policy engine, 3-pass PII scanner (regex + values + LLM) | 6 |
| **Usage Intelligence** | `dw-usage-intelligence` | Practitioner analytics, workflow patterns, adoption dashboards, heatmaps (zero LLM) | 26 |
| **Observability** | `dw-observability` | SHA-256 audit trail, drift detection, agent metrics (p50/p95/p99), health monitoring | 6 |
| **Connectors** | `dw-connectors` | Unified MCP gateway to 15 catalog connectors | 56 |
| **Orchestration** | `dw-orchestration` | Priority scheduler, heartbeat monitor, agent registry, event choreography | internal (not MCP) |
| **MLOps & Models** | `dw-ml` | Experiment tracking, model registry, feature pipelines, SHAP explainability, drift detection, A/B testing. Write tools (`train_model`, `deploy_model`, `create_experiment`, `log_metrics`, `register_model`, `create_feature_pipeline`, `ab_test_models`) require Pro. | 16 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Clients                             │
│  Claude Code · OpenCode · Cursor · VS Code · Any MCP Client    │
└────────────────────────────┬────────────────────────────────────┘
                             │  MCP Protocol (JSON-RPC 2.0 / stdio)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     11 AI Agents (160+ tools)                   │
│                                                                 │
│  pipelines · incidents · catalog · schema · quality · governance│
│  usage-intelligence · observability · connectors · orchestration│
│  ml                                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │  Factory-injected dependencies
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Core Platform (9 packages)                    │
│  MCP Framework · Context Layer · Agent Lifecycle · Validation   │
│  Conflict Resolution · Enterprise · Orchestrator · Platform     │
│  Medallion (Bronze → Silver → Gold lakehouse management)        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              Infrastructure Adapters (auto-detect)              │
│  Redis · Kafka · PostgreSQL · Neo4j · pgvector · PG FTS        │
│  LLM Bridge · Warehouse Bridge · Airflow                       │
│  (falls back to InMemory stubs when services unavailable)       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  15 Catalog Connectors                          │
│  Snowflake · BigQuery · Databricks · dbt · Iceberg · Glue      │
│  Hive · DataHub · OpenMetadata · Purview · Dataplex · Nessie   │
│  Polaris · OpenLineage · Lake Formation                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Connectors

Data Workers includes 15 catalog connectors out of the box. Additional enterprise connectors are available in Pro/Enterprise editions.

<details>
<summary><strong>Catalog Connectors (15)</strong></summary>

| Connector | Description |
|-----------|-------------|
| Snowflake | Databases, tables, DDL, usage stats |
| BigQuery | Datasets, tables, schema, cost estimation |
| Databricks | Unity Catalog, tables, query history |
| AWS Glue | Databases, tables, partitions |
| Lake Formation | Permissions, grants, resource listing |
| Hive Metastore | Thrift-based database/table/partition access |
| dbt | Models, lineage, test results, run history |
| DataHub | Entity search, metadata, lineage, usage stats |
| OpenMetadata | Entity search, lineage, tags, glossary |
| Purview | Catalog search, entity metadata, classifications |
| Dataplex | Lakes, zones, assets, data quality, discovery |
| Nessie | Git-like branching, commits, merges, content versioning |
| Apache Iceberg | REST Catalog, time travel, schema evolution, statistics |
| Apache Polaris | Multi-catalog federation, OAuth2, permission policies |
| OpenLineage | Lineage graphs, job runs, column lineage, event emission |

</details>

<details>
<summary><strong>Enterprise Connectors (35) -- available in Pro/Enterprise editions</strong></summary>

| Category | Connectors |
|----------|------------|
| **Orchestration** (11) | Airflow, Dagster, Prefect, AWS Step Functions, Azure Data Factory, dbt Cloud, Cloud Composer, Temporal, Mage, Kestra, Argo |
| **Alerting** (5) | PagerDuty, Slack, Microsoft Teams, OpsGenie, New Relic |
| **Quality** (6) | Great Expectations, Soda, Monte Carlo, Anomalo, Bigeye, Elementary |
| **BI** (5) | Looker, Tableau, Metabase, Sigma, Superset |
| **Observability** (2) | OpenTelemetry, Datadog |
| **Identity** (2) | Okta, Azure AD |
| **ITSM** (2) | ServiceNow, Jira Service Management |
| **Cost** (1) | AWS Cost Explorer |
| **Streaming** (1) | Kafka Schema Registry |

Community Edition includes up to 3 enterprise connectors. See [pricing](https://dataworkers.io/pricing) for details.

</details>

---

## Project Structure

```
dataworkers-claw-community/
├── agents/                    # 11 agent MCP servers
│   ├── dw-pipelines/          # Write tools (generate, deploy) require Pro
│   ├── dw-incidents/
│   ├── dw-context-catalog/
│   ├── dw-schema/
│   ├── dw-quality/
│   ├── dw-governance/
│   ├── dw-usage-intelligence/
│   ├── dw-observability/
│   ├── dw-connectors/
│   ├── dw-orchestration/
│   └── dw-ml/                 # Write tools require Pro
├── core/                      # 9 shared platform packages
│   ├── mcp-framework/         # Base MCP server class
│   ├── infrastructure-stubs/  # 9 interfaces + InMemory stubs + real adapters
│   ├── llm-provider/          # Multi-provider LLM abstraction
│   ├── medallion/             # Bronze/Silver/Gold lakehouse management
│   ├── enterprise/            # Enterprise middleware shim (no-op in Community Edition)
│   ├── orchestrator/          # Multi-agent coordination
│   ├── context-layer/         # Shared context for cross-agent communication
│   └── ...
├── connectors/                # 15 catalog connectors
├── packages/                  # CLI (dw-claw) and VS Code extension
├── tests/                     # Contract, integration, e2e, and eval tests
├── docker/                    # Dockerfiles and compose
└── docs/                      # Architecture specs and guides
```

---

## Development

```bash
npm test          # Run all tests (2,900+, no external services required)
npm run build     # Build all packages
npm run lint      # Lint
npm run typecheck # Type-check
cd agents/dw-pipelines && npm run dev  # Run a single agent in dev mode
```

---

## Troubleshooting

**Agent fails to start:** Ensure you're using `start-agent.sh` (not `node` directly). The script sets the working directory correctly for tsx module resolution. See [docs/MCP-STARTUP-BUG-REPORT.md](docs/MCP-STARTUP-BUG-REPORT.md) for details.

**Module not found errors:** Run `npm install` from the repo root. The monorepo uses npm workspaces — all dependencies are hoisted.

**Tests fail on fresh clone:** Make sure Node.js >= 20 is installed. Run `npm install` before `npm test`.

---

## Known Limitations

- **npm packages require the cloned repo.** `npx dw-claw` and `npx data-context-mcp` depend on workspace packages that aren't published individually. Use the `start-agent.sh` approach for now.
- **dw-orchestration is an internal service**, not an MCP agent. It provides task scheduling and agent coordination APIs used by other agents.
- **Write operations require Pro.** Tools like `generate_pipeline`, `deploy_model`, and `train_model` return upgrade prompts in the Community Edition.

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on reporting bugs, setting up your dev environment, submitting PRs, and code style.

Join the [Data Workers Community on Discord](https://discord.com/invite/b8DR5J53) to ask questions and connect with other contributors.

---

## Further Reading

| Topic | Link |
|-------|------|
| Infrastructure details | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Configuration (env vars) | [.env.example](.env.example) |
| Tiers & Pricing | [dataworkers.io/pricing](https://dataworkers.io/pricing) |
| Security | [SECURITY.md](SECURITY.md) |
| License | [LICENSE](LICENSE) (Apache 2.0) |
| LLM Data Disclosure | [docs/LLM-DATA-DISCLOSURE.md](docs/LLM-DATA-DISCLOSURE.md) |
| API Reference | [docs/API.md](docs/API.md) |

---

<p align="center">
  Built by <a href="https://dataworkers.io">Data Workers</a> &middot;
  <a href="https://discord.com/invite/b8DR5J53">Discord</a> &middot;
  <a href="https://twitter.com/dataworkers">Twitter</a> &middot;
  <a href="https://dataworkers.io">Website</a>
</p>
