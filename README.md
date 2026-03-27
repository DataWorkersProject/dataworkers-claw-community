<p align="center">
  <h1 align="center">Data Workers</h1>
  <p align="center"><strong>Open-source autonomous AI agents for data engineering</strong></p>
  <p align="center">Stop writing boilerplate pipelines. Stop debugging data incidents manually.<br/>Describe what you need in natural language. The agents handle execution.</p>
</p>

<p align="center">
  <a href="https://github.com/DhanushAShetty/dw-claw-community/actions"><img src="https://github.com/DhanushAShetty/dw-claw-community/actions/workflows/ci.yml/badge.svg" alt="Build Status" /></a>
  <a href="https://codecov.io/gh/DhanushAShetty/dw-claw-community"><img src="https://codecov.io/gh/DhanushAShetty/dw-claw-community/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://github.com/DhanushAShetty/dw-claw-community/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/org/data-workers"><img src="https://img.shields.io/npm/v/@data-workers/mcp-framework?label=npm" alt="npm" /></a>
  <a href="https://discord.com/invite/b8DR5J53"><img src="https://img.shields.io/discord/placeholder?label=Discord&logo=discord&color=5865F2" alt="Discord" /></a>
</p>

<p align="center">
  11 AI agents &middot; 160+ MCP tools &middot; 15 connectors &middot; 2,900+ tests &middot; Zero config to start
</p>

---

## What is Data Workers?

Data Workers is a coordinated swarm of AI agents that automate the full spectrum of data engineering workflows. Each agent is a standalone [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes domain-specific tools to Claude Code, OpenCode, Cursor, VS Code, and any MCP-compatible client.

**The problem:** Data engineers spend 60%+ of their time on undifferentiated work -- writing pipeline boilerplate, debugging data incidents at 2am, chasing schema changes across teams, manually cataloging assets, and fighting governance paperwork.

**The solution:** 11 autonomous agents that understand your data stack end-to-end. They build pipelines, detect anomalies, manage catalogs, enforce governance, track ML experiments, and more -- all through natural language via the MCP protocol your AI tools already speak.

Everything runs locally with in-memory stubs by default. No external services required to get started. No data leaves your machine. BYO model -- use any LLM provider.

---

## Quick Start

### Try the free data context MCP (5 tools, zero config)

```bash
npx data-context-mcp
```

Search your data catalog, trace lineage, and check quality across dbt, Snowflake, and BigQuery -- instantly.

### Install the full agent suite

```bash
# One command to register all 11 agents with your MCP client
npx dw-claw
```

### Or install from source

```bash
git clone https://github.com/DhanushAShetty/dw-claw-community.git
cd data-workers
npm install
npm run build
```

### Other installation methods

```bash
# Homebrew
brew install data-workers/tap/dw-claw

# Docker
docker pull ghcr.io/dhanushashetty/data-workers:latest
docker run -it ghcr.io/dhanushashetty/data-workers:latest
```

---

## Client Integration

Add agents to your MCP client configuration to start using them immediately.

**Claude Code** (`.mcp.json` in your project root):

```json
{
  "mcpServers": {
    "dw-pipelines": {
      "command": "npx",
      "args": ["-y", "@data-workers/dw-pipelines"]
    },
    "dw-catalog": {
      "command": "npx",
      "args": ["-y", "@data-workers/dw-context-catalog"]
    },
    "dw-quality": {
      "command": "npx",
      "args": ["-y", "@data-workers/dw-quality"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "dw-pipelines": {
      "command": "npx",
      "args": ["-y", "@data-workers/dw-pipelines"]
    },
    "dw-incidents": {
      "command": "npx",
      "args": ["-y", "@data-workers/dw-incidents"]
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
      "command": ["npx", "-y", "@data-workers/dw-pipelines"],
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
    }
  }
}
```

Or generate the full config with all 11 agents:

```bash
npx dw-claw opencode
```

Once registered, just ask your AI assistant naturally:

- *"Build a pipeline that ingests from S3 into Snowflake with deduplication"*
- *"Why did the orders table row count drop 40% yesterday?"*
- *"Show me the full lineage for the revenue dashboard"*
- *"Scan the customer schema for PII and suggest masking policies"*
- *"Compare the last two ML experiments and explain the accuracy difference"*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Clients                             │
│     Claude Code  ·  OpenCode  ·  Cursor  ·  VS Code  ·  Any MCP Client      │
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
| **Orchestration** | `dw-orchestration` | Priority scheduler, heartbeat monitor, agent registry, event choreography | internal |
| **MLOps & Models** | `dw-ml` | Experiment tracking, model registry, feature pipelines, SHAP explainability, drift detection, A/B testing. Write tools (`train_model`, `deploy_model`, `create_experiment`, `log_metrics`, `register_model`, `create_feature_pipeline`, `ab_test_models`) require Pro. | 16 |

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

Community Edition includes up to 3 enterprise connectors. See [pricing](https://dataworkers.dev/pricing) for details.

</details>

---

## Infrastructure

Data Workers uses a factory pattern that auto-detects available services from environment variables. When a service is unavailable, it falls back to a fully functional in-memory stub -- so agents work out of the box with zero configuration.

| Adapter | Real Service | Stub Fallback | Factory |
|---------|-------------|---------------|---------|
| Key-Value Store | Redis | InMemoryKeyValueStore | `createKeyValueStore()` |
| Message Bus | Kafka | InMemoryMessageBus | `createMessageBus()` |
| Relational DB | PostgreSQL | InMemoryRelationalStore | `createRelationalStore()` |
| Graph DB | Neo4j | InMemoryGraphDB | `createGraphDB()` |
| Vector Store | pgvector | InMemoryVectorStore | `createVectorStore()` |
| Full-Text Search | PostgreSQL FTS | InMemoryFullTextSearch | `createFullTextSearch()` |
| LLM Client | Anthropic/OpenAI/Bedrock/Vertex/Ollama/Azure | InMemoryLLMClient | `createLLMClient()` |
| Warehouse | Snowflake/BigQuery/Databricks | InMemoryWarehouseConnector | `createWarehouseConnector()` |
| Orchestrator API | Airflow | InMemoryOrchestratorAPI | `createOrchestratorAPI()` |

```typescript
import { createKeyValueStore } from '@data-workers/infrastructure-stubs';

// Automatically uses Redis if REDIS_URL is set, otherwise InMemory
const kv = createKeyValueStore();
```

---

## Configuration

Set environment variables to connect agents to real infrastructure. All are optional -- agents default to in-memory stubs.

| Variable | Service | Example |
|----------|---------|---------|
| `REDIS_URL` | Redis | `redis://localhost:6379` |
| `KAFKA_BROKERS` | Kafka | `localhost:9092` |
| `DATABASE_URL` | PostgreSQL | `postgresql://user:pass@localhost:5432/dw` |
| `NEO4J_URI` | Neo4j | `bolt://localhost:7687` |
| `PGVECTOR_ENABLED` | pgvector (uses `DATABASE_URL` + this flag) | `true` |
| `ANTHROPIC_API_KEY` | Anthropic Claude | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI | `sk-...` |
| `SNOWFLAKE_ACCOUNT` | Snowflake | `xy12345.us-east-1` |
| `GOOGLE_CLOUD_PROJECT` | BigQuery | `my-project` |
| `AIRFLOW_URL` | Airflow | `http://localhost:8080` |

<details>
<summary><strong>LLM Provider Configuration</strong></summary>

Data Workers supports multiple LLM providers with automatic fallback. Set the provider-specific key and optionally configure the model:

| Provider | Required Variable | Model Variable |
|----------|------------------|----------------|
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| AWS Bedrock | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | `BEDROCK_MODEL` |
| Google Vertex | `GOOGLE_APPLICATION_CREDENTIALS` | `VERTEX_MODEL` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_MODEL` |
| Ollama | `OLLAMA_HOST` | `OLLAMA_MODEL` |

</details>

---

## Tiers

| Feature | Community (Free, Open Source) | Pro | Enterprise |
|---------|:----------------------------:|:---:|:----------:|
| All 11 agents | Yes | Yes | Yes |
| Catalog connectors (15) | Yes | Yes | Yes |
| Enterprise connectors (35) | 3 max | Unlimited | Unlimited |
| In-memory stubs | Yes | Yes | Yes |
| Real infrastructure adapters | Yes | Yes | Yes |
| Pipeline persistence + git commits | -- | Yes | Yes |
| Email support | -- | Yes | Yes |
| SSO / SCIM / RBAC | -- | -- | Yes |
| PII middleware + audit trails | -- | -- | Yes |
| Autonomy controller + approval gates | -- | -- | Yes |
| SLA guarantee | -- | -- | Yes |

See [dataworkers.dev/pricing](https://dataworkers.dev/pricing) for plan details.

---

## Development

```bash
# Clone and install
git clone https://github.com/DhanushAShetty/dw-claw-community.git
cd data-workers
npm install

# Build all packages
npm run build

# Run all tests (2,900+ tests, no external services required)
npm test

# Lint and type-check
npm run lint
npm run typecheck

# Run a single agent in dev mode
cd agents/dw-pipelines
npm run dev
```

### Project Structure

```
data-workers/
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

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Reporting bugs and requesting features
- Setting up your development environment
- Submitting pull requests
- Code style and testing requirements

Join the [Data Workers Community on Discord](https://discord.com/invite/b8DR5J53) to ask questions, share what you're building, and connect with other contributors.

## Security

If you discover a security vulnerability, please report it responsibly. See [SECURITY.md](SECURITY.md) for our disclosure policy and contact information.

## License

Apache 2.0 -- see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://dataworkers.dev">Data Workers</a> &middot;
  <a href="https://discord.com/invite/b8DR5J53">Discord</a> &middot;
  <a href="https://twitter.com/dataworkers">Twitter</a> &middot;
  <a href="https://dataworkers.io">Website</a>
</p>
