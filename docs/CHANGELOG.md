# Changelog

Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### MLOps & Models Agent — v2 Release (dw-ml)

#### Added
- New `dw-ml` agent with 16 MCP tools for end-to-end ML lifecycle management
- Experiment tracking (`create_experiment`, `log_metrics`, `compare_experiments`) — MLflow-compatible
- Model registry (`register_model`, `get_model_versions`) with versioned staging (dev/staging/production)
- Feature engineering (`suggest_features`, `create_feature_pipeline`, `get_feature_stats`)
- Model training and evaluation (`select_model`, `train_model`, `evaluate_model`) with hyperparameter optimization
- Model deployment (`deploy_model`) and status monitoring (`get_ml_status`)
- SHAP-based model explainability (`explain_model`) for regulatory compliance and debugging
- Data and concept drift detection (`detect_model_drift`) with KS, PSI, and Chi-squared statistical tests
- A/B testing (`ab_test_models`) with traffic splitting and statistical significance testing
- Cross-agent integration with dw-quality (feature validation), dw-pipelines (feature pipeline orchestration), dw-context-catalog (model/feature lineage), and dw-governance (model approval workflows, PII detection)

### Pipeline Building Agent — PRD v2 Production-Grade Improvements

#### Added
- LLMCodeGenerator (`src/llm/llm-code-generator.ts`) — wraps core ILLMClient with budget tracking and template fallback
- SandboxRunner (`src/validators/sandbox-runner.ts`) — real Python AST, SQL syntax, and YAML validation
- AirflowDeployer (`src/deployers/airflow-deployer.ts`) — real Airflow deployment via filesystem/S3/git-sync + REST API verification
- `normalizeQualityChecks` utility for type-safe quality check handling
- `register_pipeline_asset` tool in catalog agent
- `create_quality_tests_for_pipeline` tool in quality agent
- `check_compatibility` tool in schema agent
- Message bus request/reply pattern in core IMessageBus
- ConnectorBridge LRU cache (500 entries, 5min TTL)
- Unified ConnectorContext types in core/types/
- `persist` parameter on generate_pipeline for Community/Pro tier split
- Real git operations with SHA-1 hashes when GIT_REPO_PATH configured

#### Changed
- PipelineSpec.metadata now includes typed fields (dagCode, dbtModels, reusableAssets, etc.)
- SQLGenerator accepts configurable deduplicateKey, orderByColumn, joinKey, joinRef
- DAGGenerator produces real task logic (no more TODO placeholders)
- ConnectorBridge exported as singleton from backends.ts
- Hardcoded values extracted to env vars (LLM_BUDGET_LIMIT, ICEBERG_ENDPOINT, etc.)

#### Removed
- Dead code: ModelRouter, RAGPipelineRetriever, custom LLMClient (see REMOVED_FILES.md)
- Hardcoded merge columns ['id', 'updated_at', 'value']
- Erroneous writeMode on SourceIntent (nl-parser.ts:174)

## [0.2.0] - 2026-03-22

### Added — Infrastructure Stubs
- `@data-workers/infrastructure-stubs` package with 9 in-memory backends
- InMemoryVectorStore (384-dim cosine similarity, deterministic embeddings)
- InMemoryGraphDB (BFS traversal, lineage, column-level edges)
- InMemoryFullTextSearch (BM25-approximated TF-IDF scoring)
- InMemoryKeyValueStore (Redis-like with TTL support)
- InMemoryWarehouseConnector (INFORMATION_SCHEMA simulation)
- InMemoryRelationalStore (PostgreSQL-like query/aggregate)
- InMemoryMessageBus (Kafka-like pub/sub, 1000-event retention)
- InMemoryLLMClient (deterministic responses, budget tracking)
- InMemoryOrchestratorAPI (Airflow-like task management)

### Added — Agent Wiring (through )
- dw-context-catalog: hybrid search engine (vector+BM25+graph with RRF reranking), graph-based lineage traversal, IcebergCrawler
- dw-schema: INFORMATION_SCHEMA diffs with Levenshtein rename detection, Iceberg snapshot-based schema evolution
- dw-quality: data profiler, weighted quality scoring (5 dimensions), z-score anomaly detection with 14-day bootstrap
- dw-governance: priority-based policy engine (8 seeded policies), 3-pass PII scanner (column names → regex on values → LLM)
- dw-pipelines: LLM fallback when NLParser confidence <0.8, template engine, cross-agent catalog search, Kafka events, Iceberg MERGE INTO
- dw-incidents: graph-based RCA, playbook execution via orchestrator API, event coordination, vector similarity search

### Added — New Agents (through )
- dw-observability: SHA-256 hash-chain audit trail, drift detection, agent metrics, health monitoring (zero LLM — anti-recursion enforced)
- dw-orchestration: priority task scheduler (P0-P3), heartbeat monitor (15s TTL), agent registry with per-tenant toggle, event choreographer with trace ID propagation

### Removed — Agents moved to Pro (through )
- dw-cost, dw-migration, dw-insights, dw-streaming removed from Community Edition (available in Pro/Enterprise)

### Added — Connectors (, )
- Apache Iceberg REST Catalog connector: table metadata, time travel, schema evolution, partition specs, snapshot statistics
- Apache Polaris connector: catalog browsing, OAuth2 authentication, permission policies, multi-catalog federation

### Added — Iceberg Enhancements (, )
- IcebergCrawler extending BaseCrawler for Iceberg table discovery and indexing
- MERGE INTO SQL generation for Iceberg upserts
- Iceberg-specific DAG tasks (compact, expire snapshots, rewrite manifests)
- Schema evolution detection from Iceberg snapshot history

### Added — Documentation
- `docs/ARCHITECTURE.md` — Full architecture reference and agent design patterns
- `docs/API.md` — Complete MCP tool reference for all 11 agents
- `docs/DEPLOYMENT.md` — Production deployment guide
- Updated README with 11 agents, 160+ MCP tools, 3,061+ tests across 149+ files

### Fixed — Code Quality (/simplify)
- Vector store: cosine similarity reduced to dot product (vectors pre-normalized)
- Message bus: added 1000-event retention cap per topic
- Orchestrator API: removed redundant double-write in restartTask
- Catalog search: clear setTimeout on resolve to prevent timer leak
- Full-text search: removed pointless getSeedAssetsForFTS wrapper

### Stats
- 11 agents, 160+ MCP tools
- 49 connectors (14 catalog + 35 enterprise)
- 9 infrastructure adapters (stubs + real adapters)
- 3,061+ passing tests across 149+ files
- 16,868 lines added

## [0.1.0] - 2026-03-22

### Added — Platform Foundation (M1–M8)
- Core packages: mcp-framework, context-layer, agent-lifecycle, validation, conflict-resolution, enterprise, orchestrator, platform
- 6 agent MCP servers: dw-pipelines, dw-incidents, dw-context-catalog, dw-schema, dw-quality, dw-governance
- GitHub Actions CI/CD pipeline
- Docker Compose for local dev infrastructure
