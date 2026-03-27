# Architecture Guide

This document describes the architecture of **data-workers**, an open-source autonomous agent swarm for data engineering. It is written for contributors who want to understand the codebase, add features, or fix bugs.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     MCP Clients                         │
│  (Claude Desktop, VS Code Extension, CLI, Cursor, etc.) │
└──────────────────────┬──────────────────────────────────┘
                       │  MCP Protocol (JSON-RPC over stdio)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    Agent Layer (11 agents)               │
│  pipelines │ schema │ quality │ incidents │ governance   │
│  observability │ orchestration │ connectors │ catalog    │
│  usage-intel │ ml                                        │
└──────────────────────┬──────────────────────────────────┘
                       │  Factory-injected dependencies
                       ▼
┌─────────────────────────────────────────────────────────┐
│               Infrastructure Layer (9 interfaces)       │
│  KV Store │ Message Bus │ Relational │ Graph DB          │
│  Vector Store │ Full-Text Search │ LLM Client            │
│  Warehouse Connector │ Orchestrator API                  │
│                                                         │
│  InMemory stubs ◄── factory ──► Real adapters           │
│  (zero-dep dev)     (env vars)  (Redis, Kafka, PG, ...) │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Platforms                         │
│  Snowflake │ BigQuery │ Databricks │ Iceberg │ dbt      │
│  DataHub │ OpenMetadata │ Purview │ Glue │ Hive         │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
data-workers/
├── agents/              # 11 MCP-based autonomous agents
├── connectors/          # 14 catalog connectors
│   ├── shared/          # ICatalogProvider interface + CatalogRegistry
│   ├── snowflake/       # One dir per catalog connector
│   ├── bigquery/
│   └── ...
├── core/                # Shared infrastructure and frameworks
│   ├── mcp-framework/   # Base MCP server class (DataWorkersMCPServer)
│   ├── infrastructure-stubs/ # 9 interfaces, InMemory stubs, real adapters, factories
│   ├── llm-provider/    # Multi-provider LLM abstraction
│   ├── medallion/       # Bronze → Silver → Gold lakehouse management
│   ├── orchestrator/    # Multi-agent coordination
│   ├── context-layer/   # Shared context for cross-agent communication
│   ├── validation/      # Input validation utilities
│   ├── platform/        # Platform abstractions
│   ├── agent-lifecycle/ # Agent startup/shutdown lifecycle
│   └── conflict-resolution/ # Conflict handling between agents
├── packages/            # Distribution packages
│   ├── cli/             # @data-workers/cli
│   └── vscode-extension/# VS Code extension
├── tests/               # Cross-cutting tests
│   ├── contracts/       # Interface contract tests
│   ├── integration/     # Integration tests
│   ├── e2e/             # End-to-end smoke tests
│   └── eval/            # Evaluation / report card
├── docker/              # Dockerfiles and compose for agents
├── scripts/             # Health checks and utilities
└── seed-data/           # Sample data for development
```

## Agent Architecture

Every agent follows the same structure. Here is `dw-pipelines` as a representative example:

```
agents/dw-pipelines/
├── src/
│   ├── index.ts          # MCP server setup + tool registration
│   ├── tools/            # One file per MCP tool
│   │   ├── generate-pipeline.ts
│   │   ├── validate-pipeline.ts
│   │   ├── deploy-pipeline.ts
│   │   └── list-templates.ts
│   ├── backends.ts       # Business logic and data access
│   ├── connectors/       # Agent-specific connector integrations
│   ├── engine/           # Domain-specific processing engine
│   ├── llm/              # LLM prompt templates for this agent
│   ├── validation/       # Input validation schemas
│   └── types.ts          # TypeScript type definitions
└── package.json
```

**Pattern**: Each agent creates a `DataWorkersMCPServer` instance, registers its tools with `server.registerTool(definition, handler)`, and exports the server. The MCP framework handles JSON-RPC transport, tool dispatch, circuit breaking, and capability tracking.

### dw-pipelines — v2 Architecture

The pipeline agent received production-grade improvements in PRD v2:

```
agents/dw-pipelines/src/
├── llm/
│   └── llm-code-generator.ts   # Wraps ILLMClient with budget tracking + template fallback
├── validators/
│   └── sandbox-runner.ts        # Real Python AST, SQL syntax, and YAML validation
├── deployers/
│   └── airflow-deployer.ts      # Airflow deployment via filesystem/S3/git-sync + REST API
├── backends.ts                  # Singleton ConnectorBridge with LRU cache (500 entries, 5min TTL)
└── tools/
    └── generate-pipeline.ts     # `persist` parameter gates Community vs Pro tier
```

**LLMCodeGenerator** wraps the core `ILLMClient` interface with budget tracking (`LLM_BUDGET_LIMIT` env var) and automatic template fallback when the LLM budget is exhausted or the provider is unavailable.

**SandboxRunner** replaces the previous always-pass validation stub with real validation: Python code goes through AST parsing, SQL through syntax checking, and YAML through schema validation.

**AirflowDeployer** provides real Airflow deployment when configured (`AIRFLOW_DAG_PATH`, `AIRFLOW_API_URL`). It supports filesystem, S3, and git-sync DAG delivery, then verifies deployment via the Airflow REST API.

**Cross-agent communication** uses the message bus request/reply pattern. The pipeline agent requests asset registration from `dw-context-catalog` (`register_pipeline_asset`), quality test creation from `dw-quality` (`create_quality_tests_for_pipeline`), and compatibility checks from `dw-schema` (`check_compatibility`).

**ConnectorBridge** is exported as a singleton from `backends.ts` with an LRU cache (500 entries, 5-minute TTL) to avoid redundant connector lookups during pipeline generation.

**Tier split**: The `generate_pipeline` tool accepts a `persist` parameter. Community tier users get pipeline specs returned in-memory only. Pro tier users get specs persisted to the relational store with real git commits (SHA-1 hashes) when `GIT_REPO_PATH` is configured.

### The 11 Agents

| Agent | Purpose |
|-------|---------|
| `dw-pipelines` | NL-to-pipeline generation, validation, deployment. Write tools (`generate_pipeline`, `deploy_pipeline`) require Pro. |
| `dw-schema` | Schema evolution, drift detection, migration |
| `dw-quality` | Data quality rules, profiling, anomaly detection |
| `dw-incidents` | Incident detection, triage, root cause analysis |
| `dw-governance` | Access control, compliance, policy enforcement |
| `dw-observability` | Pipeline monitoring, alerting, SLO tracking |
| `dw-orchestration` | Workflow orchestration across platforms |
| `dw-connectors` | Connector management and health monitoring |
| `dw-context-catalog` | Cross-agent context and metadata catalog |
| `dw-usage-intelligence` | Usage analytics and optimization |
| `dw-ml` | Experiment tracking, model registry, feature pipelines, explainability, drift detection, A/B testing. Write tools require Pro. |

## Infrastructure Layer

The infrastructure layer provides 9 abstract interfaces so agents never depend on specific databases or services directly.

### Interfaces (`core/infrastructure-stubs/src/interfaces/`)

| Interface | Purpose | InMemory Stub | Real Adapter |
|-----------|---------|---------------|--------------|
| `IKeyValueStore` | Caching, state, config | `InMemoryKeyValueStore` | `RedisAdapter` |
| `IMessageBus` | Event pub/sub | `InMemoryMessageBus` | `KafkaAdapter` |
| `IRelationalStore` | Structured data, queries | `InMemoryRelationalStore` | `PostgresAdapter` |
| `IGraphDB` | Lineage, impact analysis | `InMemoryGraphDB` | `Neo4jAdapter` |
| `IVectorStore` | Semantic search, embeddings | `InMemoryVectorStore` | `PgVectorAdapter` |
| `IFullTextSearch` | Text search, indexing | `InMemoryFullTextSearch` | `PgFTSAdapter` |
| `ILLMClient` | LLM completions | `InMemoryLLMClient` | `LLMProviderBridge` |
| `IWarehouseConnector` | Schema inspection, DDL | `InMemoryWarehouseConnector` | `WarehouseBridge` |
| `IOrchestratorAPI` | DAG triggers, task mgmt | `InMemoryOrchestratorAPI` | `AirflowAdapter` |

### Factory Pattern (`core/infrastructure-stubs/src/adapters/factory.ts`)

Factory functions auto-detect real infrastructure from environment variables and fall back to InMemory stubs when nothing is configured:

```typescript
// Example: createKeyValueStore()
// If REDIS_URL or REDIS_HOST is set → RedisAdapter
// Otherwise → InMemoryKeyValueStore

const kv = await createKeyValueStore();
const bus = await createMessageBus();       // KAFKA_BROKERS → Kafka
const db = await createRelationalStore();   // DATABASE_URL  → PostgreSQL
const graph = await createGraphDB();        // NEO4J_URI     → Neo4j
```

This means `npm test` works with zero external dependencies -- every agent gets InMemory stubs automatically. In production, set environment variables to swap in real services.

## Connector Architecture

### Catalog Connectors (15)

Each catalog connector lives in its own workspace (`connectors/<name>/`) and implements the `ICatalogProvider` interface from `connectors/shared/types.ts`. The base interface (`IDataPlatformConnector`) requires: `connect()`, `disconnect()`, `healthCheck()`, `listNamespaces()`, `listTables()`, and `getTableMetadata()`.

**Connectors**: Snowflake, BigQuery, Databricks, Iceberg, Polaris, dbt, DataHub, OpenMetadata, Purview, Glue, Hive Metastore, OpenLineage, Nessie, Dataplex, plus a shared test harness.

Each connector uses a **StubClient** pattern -- the real API client can be swapped for a stub during testing, similar to how infrastructure factories work.

> **Enterprise features available in Data Workers Pro:** Additional enterprise connectors (35+) covering orchestration, alerting, quality, observability, BI, identity, and ITSM integrations are available in the enterprise edition.

### CatalogRegistry

The `CatalogRegistry` (`connectors/shared/catalog-registry.ts`) enables cross-catalog discovery. Agents register catalog connectors, then query across all catalogs through a single interface -- for example, searching for a table that might live in Snowflake or BigQuery without knowing which.

## Data Flow

A typical request flows through the system like this:

```
1. User (via Claude Desktop): "Create a pipeline to load CSV into Snowflake"
       │
2.     ▼  MCP tool call: generate_pipeline
   dw-pipelines agent receives the request
       │
3.     ▼  Agent calls factory-injected dependencies
   ILLMClient.complete() → generates pipeline spec
   IRelationalStore.insert() → persists pipeline metadata
   IMessageBus.publish() → notifies other agents
       │
4.     ▼  Connector interaction
   SnowflakeConnector.getTableMetadata() → validates target schema
       │
5.     ▼  Response returned via MCP
   Structured pipeline spec returned to the client
```

## LLM Integration

`core/llm-provider/` provides a multi-provider LLM abstraction with automatic fallback:

```
llm-provider/src/
├── anthropic-provider.ts     # Claude (Anthropic API)
├── openai-provider.ts        # GPT (OpenAI API)
├── azure-openai-provider.ts  # GPT (Azure-hosted)
├── bedrock-provider.ts       # AWS Bedrock
├── vertex-provider.ts        # Google Vertex AI
├── ollama-provider.ts        # Local models via Ollama
├── in-memory-provider.ts     # Deterministic stub for testing
├── model-router.ts           # Route requests to best provider
├── provider-fallback.ts      # Automatic failover chain
└── agent-migration.ts        # Migrate agents between providers
```

The `ILLMClient` infrastructure interface bridges into this provider layer. In tests, `InMemoryLLMClient` returns deterministic responses. In production, `LLMProviderBridge` delegates to whichever provider is configured via environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.).

## Medallion Architecture

`core/medallion/` implements autonomous Bronze-Silver-Gold lakehouse management:

- **Bronze**: Raw ingestion, schema capture, lineage tracking
- **Silver**: Deduplication, type casting, quality gates
- **Gold**: Business-level aggregations, promotion engine

Key modules: `medallion-coordinator.ts` (orchestrates transitions), `promotion-engine.ts` (rules for layer promotion), `quality-gate-evaluator.ts` (blocks bad data), `schema-drift-healer.ts` (auto-remediation), `iceberg-adapter.ts` (table format support).

## Testing Strategy

Tests live in two places: colocated with each workspace (`<workspace>/src/__tests__/`) and in the top-level `tests/` directory.

| Layer | Location | Purpose |
|-------|----------|---------|
| Unit tests | `agents/*/src/__tests__/`, `core/*/src/__tests__/` | Test individual tools, backends, connectors |
| Contract tests | `tests/contracts/` | Verify interface implementations match contracts |
| Integration tests | `tests/integration/` | Test cross-agent and cross-connector flows |
| E2E smoke tests | `tests/e2e/` | Full system validation |
| Eval / Report card | `tests/eval/` | Scoring and grading of agent capabilities |

Run all tests: `npm test` (uses Vitest, no external services required thanks to InMemory stubs).

> **Enterprise features available in Data Workers Pro:** Production-grade safety features including PII middleware, autonomy controller, rollback manager, HashiCorp Vault integration, OpenTelemetry distributed tracing, and Prometheus metrics are available in the enterprise edition.

## Key Design Decisions

### Why MCP (Model Context Protocol)?

MCP is an open standard for connecting AI models to tools. By building each agent as an MCP server, data-workers is client-agnostic -- it works with Claude Desktop, VS Code, Cursor, or any MCP-compatible client. No vendor lock-in.

### Why InMemory Stubs?

Contributors should be able to clone the repo and run `npm test` without installing Redis, Kafka, PostgreSQL, or Neo4j. InMemory stubs implement the same interfaces as real adapters, making tests fast, deterministic, and dependency-free.

### Why the Factory Pattern?

Factories (`createKeyValueStore()`, `createMessageBus()`, etc.) bridge development and production with zero code changes. The same agent code runs against InMemory stubs locally and against real services in production -- determined entirely by environment variables.

### Why a Monorepo with Workspaces?

All 11 agents, connectors, and shared infrastructure live in one npm workspace monorepo. This enables atomic cross-cutting changes (e.g., updating an interface and all its implementations in a single PR) while keeping each package independently buildable and testable.
