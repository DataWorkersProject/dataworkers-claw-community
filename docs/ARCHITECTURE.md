# Data Workers — Architecture

> Living document. Last updated: March 23, 2026.

## System Overview

Data Workers is a **coordinated mesh of 11 autonomous AI agents** for data engineering. Each agent is an **MCP server** exposing domain-specific tools via JSON-RPC 2.0. The agents coordinate through a shared event bus, lineage graph, and vector store to deliver cross-platform reasoning that no single-vendor tool can match.

**Principles:** Autonomous (not assistive), MCP-native, vendor-neutral, Claw Community Edition is open source (Apache 2.0) with read-only agents. Claw Pro and Enterprise unlock write tools on dw-pipelines and dw-ml, human-in-the-loop for destructive operations, read-only by default.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       MCP Clients                                │
│       (Claude Code, Cursor, OpenClaw, IDE Extensions, SDK)       │
└──────────────┬───────────────────────────────────┬───────────────┘
               │            MCP Protocol           │
┌──────────────▼───────────────────────────────────▼───────────────┐
│   Community Edition (11 agents, 160+ tools)                      │
│   ├─ dw-pipelines (write tools require Pro)                      │
│   ├─ dw-incidents    ├─ dw-observability                         │
│   ├─ dw-catalog      ├─ dw-orchestration (internal svc)          │
│   ├─ dw-schema       ├─ dw-connectors (49 connectors)            │
│   ├─ dw-quality      ├─ dw-usage-intelligence                    │
│   ├─ dw-governance   └─ dw-ml (write tools require Pro)          │
└──────────────┬───────────────────────────────────┬───────────────┘
               │        160+ MCP Tools Total        │
┌──────────────▼───────────────────────────────────▼───────────────┐
│    Infrastructure Adapters (9 real) + Stubs (9 in-memory)        │
│   VectorStore │ GraphDB │ FTS │ KV │ Relational │ MessageBus    │
│   LLMClient │ OrchestratorAPI │ WarehouseConnector              │
│   Redis │ Kafka │ PG+pgvector │ Neo4j │ Airflow │ LLM Bridge    │
│   Factory auto-detect from env vars │ All 11 agents via backends │
├──────────────────────────────────────────────────────────────────┤
│              Connectors (49: 14 catalog + 35 enterprise)          │
│   Iceberg │ Polaris │ Snowflake │ BigQuery │ dbt │ Databricks   │
│   Glue │ Hive │ OpenMetadata │ OpenLineage │ DataHub            │
│   Purview │ Dataplex │ Nessie │ Lake Formation (in Glue)        │
├──────────────────────────────────────────────────────────────────┤
│              Unified Interface: ICatalogProvider                  │
│   CatalogRegistry │ Capability negotiation │ Cross-catalog search│
└──────────────────────────────────────────────────────────────────┘
```

## Agent Inventory (11 agents, 160+ tools)

| # | Agent | Tools | Description | Key Algorithms |
|---|-------|-------|-------------|----------------|
| 1 | dw-pipelines | 4 | NL-to-pipeline generation with LLM fallback. Write tools (`generate_pipeline`, `deploy_pipeline`) require Pro. | Regex + LLM parsing, template engine, Iceberg MERGE INTO, Kafka events |
| 2 | dw-incidents | 4 | Anomaly detection, graph-based RCA, playbook execution | Z-score/IQR/moving-avg detection, BFS lineage RCA, vector similarity |
| 3 | dw-context-catalog | 6 | Hybrid search, lineage traversal, IcebergCrawler | Vector+BM25+Graph with Reciprocal Rank Fusion reranking |
| 4 | dw-schema | 4 | Schema diff, migration generation, Iceberg evolution | Levenshtein rename heuristic, snapshot-based evolution |
| 5 | dw-quality | 4 | Statistical profiling, weighted scoring, anomaly detection | 5-dimension scoring (completeness/freshness/uniqueness/accuracy/consistency) |
| 6 | dw-governance | 5 | Policy engine, 3-pass PII scanner, RBAC | Priority-based evaluation, regex+value+LLM PII detection |
| 7 | dw-usage-intelligence | 13 | Usage analytics, workflow patterns, adoption, session analytics + agent observability | SHA-256 hash chain, threshold-based drift, deterministic aggregation, zero-LLM |
| 8 | dw-orchestration | — | Priority scheduling, heartbeats, agent registry, events | P0-P3 queue with starvation prevention, graceful shutdown |
| 9 | dw-observability | 6 | Agent metrics, health monitoring, audit trail, drift detection | SHA-256 hash chain, threshold-based drift, zero-LLM |
| 10 | dw-connectors | 56 | Unified access to 15 data platforms | ICatalogProvider, CatalogRegistry, cross-catalog search |
| 11 | dw-ml | 16 | Experiment tracking, model registry, feature pipelines, explainability, drift detection, A/B testing. Write tools require Pro. | MLflow-compatible, SHAP, KS/PSI/Chi-squared drift tests |

## Infrastructure Adapter Layer (9 Interfaces, 9 Stubs, 9 Real Adapters)

All infrastructure is accessed through **9 async interfaces** with `Promise<T>` return types. Each interface has an InMemory stub for dev/test and a real adapter for production. **Factory functions** (e.g., `createKeyValueStore()`, `createGraphDB()`) auto-detect from environment variables — if a connection string is present, the real adapter is used; otherwise the in-memory stub is returned. All 11 agents consume infrastructure exclusively through these factories via a shared `backends.ts` module.

**9 Async Interfaces:**

`IKeyValueStore` | `IMessageBus` | `IRelationalStore` | `IGraphDB` | `IVectorStore` | `IFullTextSearch` | `IWarehouseConnector` | `ILLMClient` | `IOrchestratorAPI`

**In-Memory Stubs (9):**

| Stub | Simulates | Key Feature |
|------|-----------|-------------|
| InMemoryVectorStore | Pinecone | 384-dim cosine similarity (optimized dot product) |
| InMemoryGraphDB | Neo4j | BFS traversal, upstream/downstream, column lineage |
| InMemoryFullTextSearch | Elasticsearch | BM25-approximated TF-IDF |
| InMemoryKeyValueStore | Redis | TTL support, prefix scan |
| InMemoryWarehouseConnector | Snowflake | INFORMATION_SCHEMA, ALTER TABLE simulation |
| InMemoryRelationalStore | PostgreSQL | Query, aggregate, filter with seed data |
| InMemoryMessageBus | Kafka | Pub/sub with 1000-event retention cap |
| InMemoryLLMClient | Anthropic/OpenAI | Deterministic responses, budget tracking |
| InMemoryOrchestratorAPI | Airflow | DAG trigger, task restart, compute scaling |

**Real Adapters (9):**

| Adapter | Driver | Interface | Key Feature |
|---------|--------|-----------|-------------|
| RedisAdapter | ioredis | IKeyValueStore | Connection pooling, cluster mode, reconnection |
| KafkaAdapter | kafkajs | IMessageBus | Consumer groups, dead-letter queue, topic auto-creation |
| PostgresAdapter | pg | IRelationalStore | Connection pooling, prepared statements, migrations |
| Neo4jAdapter | neo4j-driver | IGraphDB | Cypher queries, read/write transactions, session cleanup |
| PgVectorAdapter | pg + pgvector | IVectorStore | HNSW indexing, cosine/L2/inner-product distance |
| PgFullTextSearchAdapter | pg (tsvector) | IFullTextSearch | PostgreSQL native full-text search with ts_rank |
| LLMProviderBridge | core/llm-provider | ILLMClient | Multi-provider (Anthropic, OpenAI, Bedrock, Vertex, Ollama) |
| WarehouseBridge | connector clients | IWarehouseConnector | Routes to Snowflake/BigQuery/Databricks connectors |
| AirflowAdapter | Airflow REST API | IOrchestratorAPI | DAG triggers, task management, connection management |

All adapters use dynamic `import()` — the project compiles without real driver dependencies installed.

**Docker Compose:** A `docker-compose.yml` provides Redis, Kafka (with Zookeeper), PostgreSQL (with pgvector extension), and Neo4j for local development with real adapters.

## Cross-Agent Communication

```
dw-quality ──quality_alert──► dw-incidents (auto-diagnosis)
dw-schema  ──schema_changed─► dw-pipelines (re-validation)
dw-pipelines─pipeline_created► dw-catalog (index new assets)
dw-incidents─incident_detected► dw-usage-intelligence (metrics)
```

## Connectors (15 platforms)

All connectors implement `ICatalogProvider` with capability-based feature negotiation. The `CatalogRegistry` enables cross-catalog discovery and routing.

| Connector | Capabilities | Protocol | Env Vars |
|-----------|-------------|----------|----------|
| Apache Iceberg | discovery | REST Catalog API | `ICEBERG_REST_URI` |
| Apache Polaris | discovery, governance | REST + OAuth2 | `POLARIS_ENDPOINT` |
| Snowflake | discovery | snowflake-sdk | `SNOWFLAKE_ACCOUNT` |
| BigQuery | discovery | @google-cloud/bigquery | `GOOGLE_CLOUD_PROJECT` |
| dbt | discovery, lineage | REST + manifest.json | `DBT_CLOUD_TOKEN` |
| Databricks | discovery | REST API | `DATABRICKS_HOST` |
| AWS Glue | discovery, search, governance | @aws-sdk/client-glue | `AWS_REGION` |
| Hive Metastore | discovery | Thrift (hive-driver) | `HIVE_METASTORE_URI` |
| OpenMetadata | discovery, lineage, governance, quality, search | REST API | `OPENMETADATA_URL` |
| OpenLineage/Marquez | discovery, lineage | REST + event producer | `MARQUEZ_URL` |
| DataHub | discovery, lineage, search, governance | GraphQL | `DATAHUB_URL` |
| Azure Purview | discovery, lineage, governance, search | Atlas REST | `AZURE_PURVIEW_ENDPOINT` |
| Google Dataplex | discovery, search | @google-cloud/dataplex | `GOOGLE_CLOUD_PROJECT` |
| Apache Nessie | discovery, versioning | REST v2 | `NESSIE_URL` |
| AWS Lake Formation | governance (within Glue) | @aws-sdk/client-lakeformation | AWS credential chain |

## Tech Stack

| Layer | Current | Production (Planned) |
|-------|---------|---------------------|
| Language | TypeScript (Node.js 20+) | Same |
| Test Framework | Vitest (3,061+ tests across 149+ files) | + contract tests, evals |
| Infrastructure | In-memory stubs + 9 real adapters | PostgreSQL+pgvector, Redis, Neo4j, Kafka, Airflow, LLM bridge, Warehouse bridge (all wired via factories) |
| Connectors | 49 platforms (14 catalog + 35 enterprise) | Connect via env vars |
| LLM | Stubbed (deterministic) | Claude Sonnet/Haiku via Anthropic SDK |
| Observability | Stub metrics | OpenTelemetry → Grafana/Datadog |
| Auth | None | OAuth 2.1 (MCP spec), Vault |

## Current Status

**Architecture: 100% complete** — 11 agents, 160+ MCP tools, 49 connectors (14 catalog + 35 enterprise), 9 infrastructure stubs + 9 real adapters, 3,061+ tests across 149+ files.

**Production readiness: ~40%** — All agents use in-memory stubs by default. 9 real infrastructure adapters are implemented with factory-based `fromEnv()` auto-detection. All 11 agents wired through `backends.ts`. Docker Compose available for local integration testing. See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup and [API.md](API.md) for the full tool reference.

## MCP Client Compatibility

Works with Claude Code, Cursor, Devin, Gemini, OpenClaw, and any MCP-compatible client.
