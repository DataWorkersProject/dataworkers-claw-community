# MCP Tool Reference

> **Auto-generated** from source tool definitions across all Data Workers agents.

**Total tools: 160+** across 11 agents (including 35 enterprise connectors).

---

## Summary by Agent

| Agent | Tool Count | Description |
|-------|-----------|-------------|
| [dw-pipelines](#dw-pipelines) | 4 | Pipeline generation, validation, deployment, templates. Write tools (`generate_pipeline`, `deploy_pipeline`) require Pro. |
| [dw-context-catalog](#dw-context-catalog) | 8 | Data catalog search, lineage, freshness, context, semantic layer |
| [dw-schema](#dw-schema) | 4 | Schema change detection, migration generation, impact assessment |
| [dw-quality](#dw-quality) | 4 | Data quality scoring, anomaly detection, SLA management |
| [dw-incidents](#dw-incidents) | 4 | Incident diagnosis, root cause analysis, auto-remediation |
| [dw-governance](#dw-governance) | 5 | Policy enforcement, RBAC, PII scanning, audit reports, access provisioning |
| [dw-observability](#dw-observability) | 6 | Agent health, drift detection, metrics, audit trail, evaluations |
| [dw-usage-intelligence](#dw-usage-intelligence) | 13 | Usage analytics, adoption dashboards, session analysis, workflow patterns |
| [dw-ml](#dw-ml) | 16 | Experiment tracking, model registry, feature pipelines, explainability, drift detection, A/B testing. Write tools require Pro. |
| [dw-connectors (catalog)](#dw-connectors--catalog-connectors) | 76 | Snowflake, BigQuery, dbt, Databricks, Glue, Hive, OpenMetadata, DataHub, Purview, Dataplex, OpenLineage, Nessie, Lake Formation, unified catalog |
| [dw-connectors (enterprise)](#dw-connectors--enterprise-integrations) | 56 | Orchestration, alerting, streaming, cost, identity, observability, quality, BI, ITSM |

---

## Table of Contents

- [dw-pipelines](#dw-pipelines)
- [dw-context-catalog](#dw-context-catalog)
- [dw-schema](#dw-schema)
- [dw-quality](#dw-quality)
- [dw-incidents](#dw-incidents)
- [dw-governance](#dw-governance)
- [dw-observability](#dw-observability)
- [dw-usage-intelligence](#dw-usage-intelligence)
- [dw-ml](#dw-ml)
- [dw-connectors -- Catalog Connectors](#dw-connectors--catalog-connectors)
  - [Snowflake](#snowflake)
  - [BigQuery](#bigquery)
  - [dbt](#dbt)
  - [Databricks Unity Catalog](#databricks-unity-catalog)
  - [AWS Glue](#aws-glue)
  - [Hive Metastore](#hive-metastore)
  - [OpenMetadata](#openmetadata)
  - [DataHub](#datahub)
  - [Azure Purview](#azure-purview)
  - [Google Cloud Dataplex](#google-cloud-dataplex)
  - [OpenLineage / Marquez](#openlineage--marquez)
  - [Apache Nessie](#apache-nessie)
  - [AWS Lake Formation](#aws-lake-formation)
  - [Unified Catalog](#unified-catalog)
- [dw-connectors -- Enterprise Integrations](#dw-connectors--enterprise-integrations)
  - [Orchestration](#orchestration)
  - [Alerting](#alerting)
  - [Streaming (Kafka Schema Registry)](#streaming-kafka-schema-registry)
  - [Cost (AWS)](#cost-aws)
  - [Identity](#identity)
  - [Observability (OTel & Datadog)](#observability-otel--datadog)
  - [Quality (GX, Soda, Monte Carlo)](#quality-gx-soda-monte-carlo)
  - [BI (Looker & Tableau)](#bi-looker--tableau)
  - [ITSM (ServiceNow & Jira SM)](#itsm-servicenow--jira-sm)

---

## dw-pipelines

### `generate_pipeline` *(Pro)*
Generate a data pipeline from a natural language description. Decomposes the description into extraction, transformation, loading, testing, and deployment tasks. Uses LLMCodeGenerator for code generation with budget tracking and template fallback. Cross-agent calls register the pipeline asset in the catalog, create quality tests, and check schema compatibility.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | string | Yes | Natural language description of the desired pipeline |
| customerId | string | Yes | Customer ID for tenant context |
| orchestrator | string | No | Target orchestrator: `airflow`, `dagster`, `prefect` (default: airflow) |
| codeLanguage | string | No | Primary code language: `sql`, `python`, `dbt` (default: sql) |
| templateId | string | No | Optional template ID to base the pipeline on |
| sourceConnections | string[] | No | Source connection identifiers |
| targetConnections | string[] | No | Target connection identifiers |
| persist | boolean | No | Whether to persist the pipeline spec to the relational store and Git. Pro tier only — Community tier returns specs in-memory only (default: false) |
| principal | object | No | Caller identity for audit and tier gating. Contains `userId`, `tenantId`, and `tier` (community/pro/enterprise) |

### `validate_pipeline`
Validate a pipeline specification using real sandbox execution. SandboxRunner performs Python AST parsing, SQL syntax checking, and YAML schema validation. Semantic layer validation is available when the catalog agent is reachable via message bus.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pipelineSpec | object | Yes | The pipeline specification to validate |
| customerId | string | Yes | Customer ID for tenant context |
| validateSemanticLayer | boolean | No | Whether to validate against the semantic layer (default: true) |
| sandboxExecution | boolean | No | Whether to run in sandbox (default: true) |

### `deploy_pipeline` *(Pro)*
Deploy a validated pipeline to the target orchestrator. When Airflow is configured (`AIRFLOW_DAG_PATH`, `AIRFLOW_API_URL`), AirflowDeployer writes DAG files via filesystem, S3, or git-sync and verifies deployment through the Airflow REST API. Optionally commits the pipeline specification as versioned YAML to Git with real SHA-1 commit hashes when `GIT_REPO_PATH` is set.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pipelineSpec | object | Yes | The validated pipeline specification to deploy |
| customerId | string | Yes | Customer ID for tenant context |
| environment | string | Yes | Deployment target: `staging` or `production` |
| gitCommit | boolean | No | Whether to commit the spec to Git (default: true) |
| gitBranch | string | No | Git branch for the commit (default: main) |

### `list_pipeline_templates`
List available pipeline templates for common data engineering patterns. Templates can be used as starting points for pipeline generation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | No | Filter by category: `etl`, `elt`, `cdc`, `streaming`, `reverse-etl`, `data-quality` |
| orchestrator | string | No | Filter by orchestrator: `airflow`, `dagster`, `prefect` |

---

## dw-context-catalog

### `search_datasets`
Search the data catalog using natural language. Returns matching datasets with relevance scores. Supports filtering by platform, type, tags, and quality score.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Natural language search query |
| customerId | string | Yes | Customer ID |
| platform | string | No | Filter by platform (snowflake, bigquery, etc.) |
| type | string | No | Filter by type: `table`, `view`, `model`, `pipeline`, `dashboard`, `metric` |
| tags | string[] | No | Filter by tags |
| limit | number | No | Max results (default: 20) |

### `get_lineage`
Get the lineage graph for a data asset. Returns upstream sources and downstream consumers with column-level lineage when available.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| assetId | string | Yes | Asset ID or fully qualified name |
| customerId | string | Yes | Customer ID |
| direction | string | No | Traversal direction: `upstream`, `downstream`, `both` (default: both) |
| maxDepth | number | No | Max traversal depth (default: 5) |
| includeColumnLineage | boolean | No | Include column-level lineage (default: true) |

### `get_context`
Get complete context for a data asset in a single call. Returns schema, lineage, quality, freshness, trust score, documentation, and related metrics.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| assetId | string | Yes | Asset ID or name |
| customerId | string | Yes | Customer ID |

### `check_freshness`
Check the freshness of a data asset. Returns freshness score (0-100), last-updated timestamp, SLA compliance status, and staleness alerts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| assetId | string | Yes | Asset ID or name |
| customerId | string | Yes | Customer ID |
| slaTargetMs | number | No | SLA target in milliseconds (default: 86400000 / 24h) |

### `assess_impact`
Assess the downstream impact of changing a data asset. Returns blast radius, affected dashboards/models/pipelines, severity classification, and recommendations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| assetId | string | Yes | Asset ID or name to assess |
| customerId | string | Yes | Customer ID |
| maxDepth | number | No | Maximum depth for impact traversal (default: 5) |

### `get_documentation`
Get auto-generated documentation for a data asset including description, column details, lineage summary, usage stats, and quality score.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| assetId | string | Yes | Asset ID or name |
| customerId | string | Yes | Customer ID |

### `list_semantic_definitions`
List all semantic layer definitions (metrics, dimensions, entities). Supports filtering by domain, type, and source.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| domain | string | No | Filter by domain (finance, product, marketing) |
| type | string | No | Filter: `metric`, `dimension`, `entity` |
| source | string | No | Filter: `dbt`, `looker`, `cube`, `custom` |
| limit | number | No | Max results (default: 50) |

### `resolve_metric`
Resolve an ambiguous metric name to its canonical semantic layer definition. If multiple definitions match, returns all candidates for disambiguation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| metricName | string | Yes | Metric name to resolve (e.g., "revenue", "MRR") |
| customerId | string | Yes | Customer ID |
| domain | string | No | Optional domain filter |

---

## dw-schema

### `detect_schema_change`
Detect schema changes on a data asset. Monitors INFORMATION_SCHEMA, schema registries, and Git webhooks for real-time modifications. Classifies changes as breaking or non-breaking.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source | string | Yes | Data source (snowflake, bigquery, postgres, etc.) |
| customerId | string | Yes | Customer ID |
| database | string | No | Database name |
| schema | string | No | Schema name |
| table | string | No | Table to check (omit to scan all tables) |

### `generate_migration`
Generate backward-compatible migration scripts for a schema change. Includes forward SQL, rollback SQL, and affected system updates. Validates via sqlglot.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| change | object | Yes | The schema change to migrate |
| customerId | string | Yes | Customer ID |
| targetSystems | string[] | No | Systems to generate migrations for (sql, dbt, api) |

### `apply_migration`
Apply a validated migration using blue/green deployment strategy. Includes automatic rollback capability and downstream agent notification.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| migration | object | Yes | The migration script to apply |
| customerId | string | Yes | Customer ID |
| strategy | string | No | Deployment strategy: `blue_green`, `rolling`, `immediate` (default: blue_green) |
| dryRun | boolean | No | If true, validate without executing (default: false) |

### `assess_impact`
Assess downstream impact of a schema change via lineage graph traversal. Identifies all affected pipelines, views, dashboards, ML models, and APIs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| change | object | Yes | The schema change to assess |
| customerId | string | Yes | Customer ID |
| maxDepth | number | No | Max lineage traversal depth (default: 5) |

---

## dw-quality

### `run_quality_check`
Execute data quality profiling on a dataset. Checks null rates, uniqueness, distributions, referential integrity, freshness, and volume. Returns quality score and detected anomalies.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| datasetId | string | Yes | Dataset or table to check |
| customerId | string | Yes | Customer ID |
| metrics | string[] | No | Specific metrics to check (omit for all) |
| columns | string[] | No | Specific columns (omit for all) |

### `get_quality_score`
Retrieve the real-time data quality score (0-100) for a dataset. Includes breakdown by dimension (completeness, accuracy, consistency, freshness, uniqueness) and trend.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| datasetId | string | Yes | Dataset ID |
| customerId | string | Yes | Customer ID |

### `get_anomalies`
List detected data quality anomalies with classification. Supports filtering by severity, dataset, and time range. Anomalies are deduplicated (50-100 raw to 5-10 actionable).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| datasetId | string | No | Filter by dataset |
| severity | string | No | Filter: `critical`, `warning`, `info` |
| fromTimestamp | number | No | Start of time range |
| limit | number | No | Max results (default: 20) |
| deduplicatedOnly | boolean | No | Only show deduplicated/actionable (default: true) |

### `set_sla`
Define data quality SLAs for a dataset. SLA rules specify metric thresholds with severity levels. Violations trigger alerts within 60 seconds.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| datasetId | string | Yes | Dataset ID |
| customerId | string | Yes | Customer ID |
| rules | object[] | Yes | SLA rules: `{ metric, operator (lt/gt/lte/gte/eq), threshold, severity, description }` |

---

## dw-incidents

### `diagnose_incident`
Diagnose a data incident from anomaly signals. Classifies into one of 6 types (schema_change, source_delay, resource_exhaustion, code_regression, infrastructure, quality_degradation), determines severity, and suggests remediation actions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| anomalySignals | object[] | Yes | Anomaly signals: `{ metric, value, expected, deviation, source, timestamp }` |
| customerId | string | Yes | Customer ID |

### `get_root_cause`
Perform root cause analysis for a diagnosed incident. Traverses the lineage graph up to 5+ hops upstream, queries execution logs, cross-references incident history, and returns a causal chain with confidence scores.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| incidentId | string | Yes | ID of the diagnosed incident |
| incidentType | string | Yes | Incident type (schema_change, source_delay, etc.) |
| affectedResources | string[] | Yes | Resources affected by the incident |
| customerId | string | Yes | Customer ID |
| maxDepth | number | No | Max lineage traversal depth (default: 5) |

### `remediate`
Execute auto-remediation for a diagnosed incident. For known patterns with >95% confidence, executes a remediation playbook automatically. For novel incidents, generates a diagnosis report and routes to human approval.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| incidentId | string | Yes | Incident ID |
| incidentType | string | Yes | Incident type |
| confidence | number | Yes | Diagnosis confidence (0-1). Auto-remediation requires >0.95 |
| customerId | string | Yes | Customer ID |
| playbook | string | No | Specific playbook: `restart_task`, `scale_compute`, `apply_schema_migration`, `switch_backup_source`, `backfill_data`, `custom` |
| dryRun | boolean | No | Simulate remediation without executing (default: false) |

### `get_incident_history`
Query past incidents for pattern matching and learning. Supports filtering by type, severity, time range, and similarity to a current incident. Uses vector similarity for finding related historical incidents.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| type | string | No | Filter by incident type |
| severity | string | No | Filter by severity |
| fromTimestamp | number | No | Start of time range (epoch ms) |
| toTimestamp | number | No | End of time range (epoch ms) |
| limit | number | No | Max results (default: 20) |
| similarTo | string | No | Incident description to find similar incidents for |

---

## dw-governance

### `check_policy`
Validate an action against active governance policies. Uses OPA/Rego policy engine with <100ms evaluation. Returns allow/deny/review decision with matched rules.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | Action to validate (read, write, delete, deploy, etc.) |
| resource | string | Yes | Resource being accessed |
| agentId | string | Yes | Agent requesting the action |
| customerId | string | Yes | Customer ID |
| context | object | No | Additional context (user, environment, data classification) |

### `enforce_rbac`
Apply role-based access control to a resource. Supports column-level permissions and role hierarchy.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| resource | string | Yes | Resource identifier |
| userId | string | Yes | User ID |
| role | string | Yes | Role: viewer, editor, admin, data_engineer, analyst |
| customerId | string | Yes | Customer ID |
| columnRestrictions | string[] | No | Columns to restrict access to |

### `provision_access`
Process an access request with least-privilege enforcement. Supports natural language requests. Applies column-level permissions, 90-day auto-expiration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string | Yes | User ID |
| resource | string | Yes | Resource identifier |
| accessLevel | string | Yes | Access level: `read`, `write`, `admin` |
| justification | string | Yes | NL justification for access |
| customerId | string | Yes | Customer ID |
| durationDays | number | No | Access duration in days (default: 90) |

### `scan_pii`
Scan a dataset for PII (Personally Identifiable Information). Uses three-pass detection: (1) column-name heuristic, (2) regex on cell values, (3) LLM stub. >95% precision target.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| datasetId | string | Yes | Dataset ID |
| customerId | string | Yes | Customer ID |
| columns | string[] | No | Specific columns (omit for all) |
| sampleSize | number | No | Rows to sample (default: 100) |

### `generate_audit_report`
Generate a compliance audit report with full evidence chain. Supports on-demand and scheduled generation. Covers agent actions, policy evaluations, access grants, PII detections.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| fromTimestamp | number | No | Period start |
| toTimestamp | number | No | Period end (default: now) |
| reportType | string | No | Report scope: `full`, `access`, `pii`, `violations` (default: full) |

---

## dw-observability

### `list_active_agents`
List all active agent instances with their current health status and key metrics.

*No required parameters.*

### `check_agent_health`
Check per-agent health status based on error rate and heartbeat recency. Returns healthy/degraded/unhealthy classification.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | No | Specific agent to check (omit for all) |

### `get_agent_metrics`
Get p50/p95/p99 latency, error rates, token consumption, and confidence for an agent over a time period. Deterministic -- no LLM in collection path.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | Yes | Agent name (e.g. "pipelines", "incidents") |
| period | string | No | Time period: `1d`, `7d` (default: 7d) |

### `detect_drift`
Detect behavioral drift by comparing recent metrics against 7-day baseline. Alerts on error rate spikes (>5%) and latency anomalies (p99 > 2x baseline).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | No | Specific agent to check (omit for all) |

### `get_audit_trail`
Retrieve SHA-256 hash-chain audit log entries. Each entry is cryptographically linked to the previous one. Supports filtering by agent name and limiting results.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | No | Filter by agent name (omit for all) |
| limit | number | No | Max entries to return (default: 20) |

### `get_evaluation_report`
Get aggregated human evaluation scores for an agent. Breaks down by accuracy, completeness, safety, and helpfulness.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | Yes | Agent name |
| period | string | No | Time period: `7d`, `30d` (default: 7d) |

---

## dw-usage-intelligence

### `get_tool_usage_metrics`
Get usage volume, unique users, trend direction, and response times for MCP tools. Supports grouping by tool, agent, or user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| toolName | string | No | Filter by specific MCP tool name |
| agentName | string | No | Filter by agent |
| period | string | No | Time period: `1d`, `7d`, `30d` (default: 7d) |
| groupBy | string | No | Group by: `tool`, `agent`, or `user` (default: tool) |

### `get_session_analytics`
Analyze practitioner interaction sessions: duration, depth (tools per session), agents per session, and user type classification (power_user, regular, occasional).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string | No | Specific user (omit for all) |
| period | string | No | `7d`, `30d` (default: 7d) |
| sessionGapMinutes | number | No | Minutes of inactivity before a new session (default: 30) |

### `get_usage_heatmap`
Get usage heatmap data showing when and where practitioners interact with the platform. Supports hourly, daily, and agent_x_user dimensions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dimension | string | No | `hourly`, `daily`, or `agent_x_user` (default: hourly) |
| period | string | No | `7d`, `30d` (default: 7d) |
| agentName | string | No | Filter by agent |

### `get_workflow_patterns`
Identify common multi-tool and multi-agent workflow sequences. Reveals how practitioners chain tools together and what percentage of usage is standalone vs. part of workflows.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string | No | Analyze for specific user (omit for all) |
| minSequenceLength | number | No | Minimum tools in a sequence (default: 2) |
| period | string | No | `7d`, `30d` (default: 30d) |
| topN | number | No | Return top N patterns (default: 10) |

### `detect_usage_anomalies`
Detect anomalies in practitioner usage patterns: sudden drops (friction), unusual spikes (automation loops or incidents), and behavior shifts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | No | Check specific agent (omit for all) |
| sensitivity | string | No | `low`, `medium`, `high` (default: medium) |

### `get_adoption_dashboard`
Get platform adoption metrics: which agents and tools are being adopted, growing, underused, or shelfware.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | string | No | `7d`, `30d`, `90d` (default: 30d) |
| threshold | number | No | Minimum calls per user to count as "adopted" (default: 5) |

### `get_usage_activity_log`
Retrieve SHA-256 hash-chained practitioner activity log. Shows who called which tool, when, and with what outcome. Verifies chain integrity for compliance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string | No | Filter by user ID |
| agentName | string | No | Filter by agent |
| toolName | string | No | Filter by specific tool |
| since | string | No | Relative time: `1h`, `24h`, `7d`, `30d` (default: 24h) |
| limit | number | No | Max entries (default: 50) |

### `list_active_agents`
List all active agent instances with health status and key metrics.

*No required parameters.*

### `check_agent_health`
Check per-agent health status based on error rate and heartbeat recency.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | No | Specific agent to check (omit for all) |

### `get_agent_metrics`
Get p50/p95/p99 latency, error rates, token consumption, and confidence for an agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | Yes | Agent name |
| period | string | No | `1d`, `7d` (default: 7d) |

### `detect_drift`
Detect behavioral drift by comparing recent metrics against 7-day baseline.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | No | Specific agent (omit for all) |

### `get_audit_trail`
Retrieve SHA-256 hash-chain audit log entries.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | No | Filter by agent |
| limit | number | No | Max entries (default: 20) |

### `get_evaluation_report`
Get aggregated human evaluation scores for an agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| agentName | string | Yes | Agent name |
| period | string | No | `7d`, `30d` (default: 7d) |

---

## dw-ml

### `suggest_features`
Analyze a dataset and suggest feature engineering transformations for ML model training. Returns ranked feature suggestions with expected impact scores.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| datasetId | string | Yes | Dataset or table identifier to analyze |
| customerId | string | Yes | Customer ID for tenant context |
| targetColumn | string | No | Target variable for supervised learning suggestions |
| maxSuggestions | number | No | Maximum number of feature suggestions (default: 20) |

### `select_model`
Recommend ML model architectures based on data characteristics, problem type, and constraints. Returns ranked model suggestions with estimated training time and resource requirements.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| datasetId | string | Yes | Dataset identifier |
| customerId | string | Yes | Customer ID |
| problemType | string | Yes | `classification`, `regression`, `clustering`, `time-series`, `anomaly-detection` |
| constraints | object | No | Resource constraints: `maxTrainingTime`, `maxMemory`, `preferInterpretable` |

### `train_model` *(Pro)*
Train an ML model with automatic hyperparameter optimization. Supports early stopping, cross-validation, and distributed training.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| experimentId | string | Yes | Experiment to log training under |
| customerId | string | Yes | Customer ID |
| modelType | string | Yes | Model architecture identifier |
| datasetId | string | Yes | Training dataset identifier |
| hyperparameters | object | No | Override default hyperparameters |
| validationSplit | number | No | Validation set ratio (default: 0.2) |
| crossValidation | number | No | Number of CV folds (default: 5) |

### `evaluate_model`
Evaluate a trained model with comprehensive metrics. Returns accuracy, precision, recall, F1, AUC-ROC, confusion matrix, and custom metrics.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| modelId | string | Yes | Trained model identifier |
| customerId | string | Yes | Customer ID |
| testDatasetId | string | No | Test dataset (uses held-out set if not provided) |
| metrics | string[] | No | Specific metrics to compute |

### `deploy_model` *(Pro)*
Deploy a trained model to serving infrastructure. Supports canary deployments, shadow mode, and automatic rollback.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| modelId | string | Yes | Model identifier |
| customerId | string | Yes | Customer ID |
| environment | string | Yes | `staging` or `production` |
| strategy | string | No | `canary`, `shadow`, `blue-green`, `direct` (default: canary) |
| trafficPercent | number | No | Initial traffic percentage for canary (default: 10) |

### `get_ml_status`
Get the status of ML pipelines, training jobs, and deployed models. Returns health, latency, and throughput metrics.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| modelId | string | No | Specific model ID (returns all if omitted) |
| includeMetrics | boolean | No | Include serving metrics (default: true) |

### `create_experiment` *(Pro)*
Create an MLflow-compatible experiment for tracking training runs, metrics, and artifacts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Experiment name |
| customerId | string | Yes | Customer ID |
| description | string | No | Experiment description |
| tags | Record<string, string> | No | Key-value tags for organization |

### `log_metrics` *(Pro)*
Log metrics for an active training run. Supports step-based logging for training curves.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| experimentId | string | Yes | Experiment identifier |
| runId | string | Yes | Run identifier |
| customerId | string | Yes | Customer ID |
| metrics | Record<string, number> | Yes | Key-value metric pairs |
| step | number | No | Training step number |

### `compare_experiments`
Compare metrics across multiple experiments or runs. Returns tabular comparison and statistical significance tests.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| experimentIds | string[] | Yes | Experiment IDs to compare |
| customerId | string | Yes | Customer ID |
| metrics | string[] | No | Specific metrics to compare (default: all) |
| sortBy | string | No | Metric to sort by |

### `register_model` *(Pro)*
Register a trained model in the model registry with version tracking and stage management.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| modelId | string | Yes | Trained model identifier |
| customerId | string | Yes | Customer ID |
| name | string | Yes | Registry name for the model |
| stage | string | No | Initial stage: `development`, `staging`, `production` (default: development) |
| description | string | No | Model description |

### `get_model_versions`
List all versions of a registered model with stage history, metrics, and lineage information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| modelName | string | Yes | Registered model name |
| customerId | string | Yes | Customer ID |
| stage | string | No | Filter by stage |
| limit | number | No | Max versions to return (default: 20) |

### `create_feature_pipeline` *(Pro)*
Generate a feature engineering pipeline from feature definitions. Creates scheduled jobs for feature computation and storage.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| features | object[] | Yes | Feature definitions with source tables and transformations |
| customerId | string | Yes | Customer ID |
| schedule | string | No | Cron schedule for feature refresh |
| sink | string | No | Feature store sink: `snowflake`, `bigquery`, `redis` |

### `get_feature_stats`
Get statistical summaries and drift metrics for features. Returns distributions, null rates, and drift scores relative to training baselines.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| featureNames | string[] | Yes | Feature names to analyze |
| customerId | string | Yes | Customer ID |
| baselineRunId | string | No | Run ID to compare against (uses training baseline if omitted) |

### `explain_model`
Generate SHAP-based model explanations. Returns feature importance scores, interaction effects, and individual prediction explanations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| modelId | string | Yes | Model identifier |
| customerId | string | Yes | Customer ID |
| datasetId | string | No | Dataset for generating explanations |
| predictionId | string | No | Specific prediction to explain (individual explanation) |
| method | string | No | Explanation method: `shap`, `lime`, `permutation` (default: shap) |

### `detect_model_drift`
Detect data drift and concept drift for deployed models. Uses KS test, PSI, and Chi-squared tests with configurable thresholds.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| modelId | string | Yes | Deployed model identifier |
| customerId | string | Yes | Customer ID |
| windowDays | number | No | Lookback window in days (default: 7) |
| threshold | number | No | Drift significance threshold (default: 0.05) |

### `ab_test_models` *(Pro)*
Configure and monitor A/B tests between model versions. Returns traffic split configuration, metric comparison, and statistical significance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| modelAId | string | Yes | Control model identifier |
| modelBId | string | Yes | Challenger model identifier |
| customerId | string | Yes | Customer ID |
| trafficSplit | number | No | Percentage of traffic to challenger (default: 50) |
| primaryMetric | string | Yes | Primary evaluation metric |
| minSampleSize | number | No | Minimum samples before significance test (default: 1000) |

---

## dw-connectors -- Catalog Connectors

### Snowflake

#### `list_snowflake_databases`
List all databases in Snowflake warehouse.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `list_snowflake_tables`
List all tables in a specific Snowflake database and schema.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| database | string | Yes | Database name |
| schema | string | Yes | Schema name |

#### `get_snowflake_table_ddl`
Get column definitions (DDL) for a specific Snowflake table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| database | string | Yes | Database name |
| schema | string | Yes | Schema name |
| table | string | Yes | Table name |

#### `get_snowflake_usage`
Get warehouse usage metrics from Snowflake.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

### BigQuery

#### `list_bigquery_datasets`
List all datasets in a BigQuery project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `list_bigquery_tables`
List all tables in a specific BigQuery dataset.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| datasetId | string | Yes | BigQuery dataset ID |

#### `get_bigquery_table_schema`
Get the schema for a specific BigQuery table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| datasetId | string | Yes | BigQuery dataset ID |
| tableId | string | Yes | BigQuery table ID |

#### `estimate_bigquery_cost`
Estimate the cost of running a BigQuery query.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| queryText | string | Yes | SQL query text to estimate cost for |

### dbt

#### `list_dbt_models`
List all dbt models with their materialization type.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `get_dbt_model_lineage`
Get upstream and downstream lineage edges for a dbt model.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| modelId | string | Yes | Unique model identifier (e.g. model.project.name) |

#### `get_dbt_test_results`
Get dbt test pass/fail results, optionally filtered by run ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| runId | string | No | Optional run ID to filter results |

#### `get_dbt_run_history`
Get recent dbt run history, optionally limited.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| limit | number | No | Maximum number of runs to return |

### Databricks Unity Catalog

#### `list_databricks_catalogs`
List all Unity Catalog catalogs in Databricks.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `list_databricks_tables`
List all tables across all schemas in a Databricks catalog.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| catalog | string | Yes | Catalog name |

#### `get_databricks_table`
Get detailed information for a specific Databricks table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| catalog | string | Yes | Catalog name |
| schema | string | Yes | Schema name |
| table | string | Yes | Table name |

#### `get_databricks_query_history`
Get recent query history from Databricks.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| limit | number | No | Maximum number of queries to return |

### AWS Glue

#### `list_glue_databases`
List all databases in AWS Glue Data Catalog.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `list_glue_tables`
List all tables in an AWS Glue database.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| database | string | Yes | Glue database name |

#### `get_glue_table`
Get detailed metadata for a specific AWS Glue table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| database | string | Yes | Glue database name |
| table | string | Yes | Table name |

#### `search_glue_tables`
Search for tables across AWS Glue databases by name or column.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| query | string | Yes | Search query string |

### Hive Metastore

#### `list_hive_databases`
List all databases in Hive Metastore.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `list_hive_tables`
List all tables in a Hive Metastore database.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| database | string | Yes | Hive database name |

#### `get_hive_table_schema`
Get schema and metadata for a specific Hive table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| database | string | Yes | Hive database name |
| table | string | Yes | Table name |

#### `get_hive_partitions`
Get partitions for a Hive table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| database | string | Yes | Hive database name |
| table | string | Yes | Table name |

### OpenMetadata

#### `list_om_tables`
List all tables in an OpenMetadata database.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| database | string | Yes | Database name |

#### `get_om_table`
Get detailed metadata for an OpenMetadata table by ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| tableId | string | Yes | OpenMetadata table ID |

#### `search_om_tables`
Search for tables across OpenMetadata by name or column.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| query | string | Yes | Search query string |

#### `get_om_lineage`
Get data lineage for an OpenMetadata table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| tableId | string | Yes | OpenMetadata table ID |
| direction | string | Yes | `upstream` or `downstream` |

#### `get_om_quality_tests`
Get data quality test results for an OpenMetadata table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| tableId | string | Yes | OpenMetadata table ID |

### DataHub

#### `search_datahub_datasets`
Search for datasets in DataHub by name, platform, or tag.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| query | string | Yes | Search query string |

#### `get_datahub_dataset`
Get detailed metadata for a specific DataHub dataset by URN.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| urn | string | Yes | Dataset URN |

#### `get_datahub_lineage`
Get lineage (upstream or downstream) for a DataHub dataset.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| urn | string | Yes | Dataset URN |
| direction | string | Yes | `upstream` or `downstream` |

#### `list_datahub_domains`
List all domains in DataHub.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

### Azure Purview

#### `search_purview_entities`
Search for entities in Azure Purview by name, type, or classification.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| query | string | Yes | Search query string |

#### `get_purview_entity`
Get detailed metadata for a specific Azure Purview entity by GUID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| guid | string | Yes | Entity GUID |

#### `get_purview_lineage`
Get lineage information for an Azure Purview entity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| guid | string | Yes | Entity GUID |

#### `list_purview_glossary`
List all glossary terms in Azure Purview.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

### Google Cloud Dataplex

#### `list_dataplex_lakes`
List all lakes in Google Cloud Dataplex.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `list_dataplex_entities`
List entities in a Dataplex zone.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| zone | string | Yes | Fully qualified zone name |

#### `get_dataplex_entity`
Get detailed metadata for a specific Dataplex entity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| name | string | Yes | Fully qualified entity name |

#### `search_dataplex_entries`
Search for entries in Google Cloud Dataplex.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| query | string | Yes | Search query string |

### OpenLineage / Marquez

#### `list_lineage_datasets`
List datasets tracked in Marquez/OpenLineage for a namespace.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| namespace | string | Yes | Marquez namespace |

#### `list_lineage_jobs`
List data pipeline jobs tracked in Marquez/OpenLineage.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| namespace | string | Yes | Marquez namespace |

#### `get_lineage_graph`
Get the full lineage graph for a dataset or job in Marquez.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| nodeId | string | Yes | Node ID (e.g., "dataset:namespace.name") |
| depth | number | No | Lineage depth (default: 5) |

#### `emit_lineage_event`
Emit an OpenLineage run event to track data pipeline execution.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| eventType | string | Yes | `START`, `RUNNING`, `COMPLETE`, `FAIL`, `ABORT` |
| jobNamespace | string | Yes | Job namespace |
| jobName | string | Yes | Job name |
| runId | string | Yes | Run identifier |

### Apache Nessie

#### `list_nessie_branches`
List all branches and tags in Nessie catalog.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `list_nessie_tables`
List all tables on a Nessie branch or tag.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| ref | string | Yes | Branch or tag name |

#### `get_nessie_content`
Get table metadata from Nessie at a specific branch and key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| ref | string | Yes | Branch or tag name |
| key | string | Yes | Content key (dot-separated, e.g. "warehouse.analytics.customers") |

#### `create_nessie_branch`
Create a new branch in Nessie from an existing reference.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| name | string | Yes | New branch name |
| from | string | Yes | Source reference to branch from |

#### `diff_nessie_refs`
Show diff between two Nessie references (branches or tags).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| from | string | Yes | Source reference name |
| to | string | Yes | Target reference name |

### AWS Lake Formation

#### `list_lf_permissions`
List Lake Formation permissions for a resource (database or table).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| resource | string | Yes | Resource identifier (e.g. "analytics_db" or "analytics_db.user_events") |

#### `list_lf_tags`
List Lake Formation tags for a resource.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| resource | string | Yes | Resource identifier |

#### `search_lf_by_tags`
Search for resources by Lake Formation tag values.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| tags | string[] | Yes | Tag values to search for |

### Unified Catalog

#### `list_all_catalogs`
List all registered catalog providers and their capabilities.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |

#### `search_across_catalogs`
Search tables across all catalog providers that support the search capability.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| query | string | Yes | Search query for table names |

#### `get_table_from_any_catalog`
Get table metadata from a specific catalog provider.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer identifier |
| provider | string | Yes | Provider type (e.g., snowflake, bigquery, dbt) |
| namespace | string | Yes | Namespace or schema identifier |
| table | string | Yes | Table name |

---

## dw-connectors -- Enterprise Integrations

### Orchestration

Tools follow a consistent pattern per orchestrator: **list** jobs/DAGs, **trigger** a run, **get** run status, **list** tasks/steps.

#### Airflow (4 tools)

| Tool | Description |
|------|-------------|
| `list_airflow_dags` | List all DAGs from Apache Airflow |
| `trigger_airflow_dag` | Trigger an Airflow DAG run. Params: `dagId`, `conf` (optional) |
| `get_airflow_dag_run` | Get the status of an Airflow DAG run. Params: `dagId`, `runId` |
| `list_airflow_tasks` | List task instances for an Airflow DAG run. Params: `dagId`, `runId` |

#### Dagster (4 tools)

| Tool | Description |
|------|-------------|
| `list_dagster_jobs` | List all jobs from Dagster |
| `trigger_dagster_job` | Trigger a Dagster job run. Params: `dagId`, `conf` (optional) |
| `get_dagster_run` | Get the status of a Dagster run. Params: `dagId`, `runId` |
| `list_dagster_ops` | List ops/steps for a Dagster run. Params: `dagId`, `runId` |

#### Prefect (4 tools)

| Tool | Description |
|------|-------------|
| `list_prefect_flows` | List all flows from Prefect |
| `trigger_prefect_flow` | Trigger a Prefect flow run. Params: `dagId`, `conf` (optional) |
| `get_prefect_flow_run` | Get status of a Prefect flow run. Params: `dagId`, `runId` |
| `list_prefect_tasks` | List tasks for a Prefect flow run. Params: `dagId`, `runId` |

#### AWS Step Functions (4 tools)

| Tool | Description |
|------|-------------|
| `list_step_function_machines` | List AWS Step Functions state machines |
| `trigger_step_function` | Start a Step Functions execution. Params: `dagId`, `conf` (optional) |
| `get_step_function_execution` | Get Step Functions execution status. Params: `dagId`, `runId` |
| `list_step_function_steps` | List steps for a Step Functions execution. Params: `dagId`, `runId` |

#### Azure Data Factory (4 tools)

| Tool | Description |
|------|-------------|
| `list_adf_pipelines` | List Azure Data Factory pipelines |
| `trigger_adf_pipeline` | Trigger an ADF pipeline run. Params: `dagId`, `conf` (optional) |
| `get_adf_pipeline_run` | Get ADF pipeline run status. Params: `dagId`, `runId` |
| `list_adf_activities` | List activities for an ADF pipeline run. Params: `dagId`, `runId` |

#### dbt Cloud (4 tools)

| Tool | Description |
|------|-------------|
| `list_dbt_cloud_jobs` | List dbt Cloud jobs |
| `trigger_dbt_cloud_job` | Trigger a dbt Cloud job run. Params: `dagId`, `conf` (optional) |
| `get_dbt_cloud_run` | Get dbt Cloud run status. Params: `dagId`, `runId` |
| `list_dbt_cloud_steps` | List steps for a dbt Cloud run. Params: `dagId`, `runId` |

#### Cloud Composer (4 tools)

| Tool | Description |
|------|-------------|
| `list_composer_dags` | List Cloud Composer DAGs |
| `trigger_composer_dag` | Trigger a Cloud Composer DAG run. Params: `dagId`, `conf` (optional) |
| `get_composer_dag_run` | Get Cloud Composer DAG run status. Params: `dagId`, `runId` |
| `list_composer_tasks` | List tasks for a Cloud Composer DAG run. Params: `dagId`, `runId` |

### Alerting

All alerting tools follow a **send** / **resolve** pattern per provider. Send params: `title`, `message`, `severity` (critical/warning/info), `source`. Resolve params: `alertId`.

| Tool | Description |
|------|-------------|
| `send_pagerduty_alert` | Create a PagerDuty incident |
| `resolve_pagerduty_alert` | Resolve a PagerDuty incident |
| `send_slack_alert` | Send an alert message to Slack |
| `resolve_slack_alert` | Post a resolution message to Slack |
| `send_teams_alert` | Send an alert to Microsoft Teams |
| `resolve_teams_alert` | Post a resolution message to Microsoft Teams |
| `send_opsgenie_alert` | Create an Opsgenie alert |
| `resolve_opsgenie_alert` | Resolve an Opsgenie alert |
| `send_newrelic_alert` | Create a New Relic incident |
| `resolve_newrelic_alert` | Resolve a New Relic incident |

### Streaming (Kafka Schema Registry)

| Tool | Description |
|------|-------------|
| `list_kafka_schemas` | List all schemas in the Kafka Schema Registry |
| `get_kafka_schema` | Get a specific schema. Params: `subject` |
| `register_kafka_schema` | Register a new schema. Params: `subject`, `schema` |
| `check_kafka_compatibility` | Check schema compatibility. Params: `subject`, `schema` |

### Cost (AWS)

| Tool | Description |
|------|-------------|
| `get_aws_cost_by_service` | Get AWS cost breakdown by service. Params: `startDate`, `endDate` |
| `get_aws_cost_forecast` | Get AWS cost forecast. Params: `months` |
| `get_aws_cost_recommendations` | Get AWS cost optimization recommendations |

### Identity

| Tool | Description |
|------|-------------|
| `list_okta_users` | List users from Okta. Optional: `filter` |
| `get_okta_user` | Get a specific Okta user. Params: `userId` |
| `list_azure_ad_users` | List users from Azure AD / Entra ID. Optional: `filter` |
| `get_azure_ad_user` | Get a specific Azure AD user. Params: `userId` |

### Observability (OTel & Datadog)

| Tool | Description |
|------|-------------|
| `query_otel_metrics` | Query metrics from OpenTelemetry. Params: `query`, `start`, `end` |
| `list_otel_alerts` | List alerts from OpenTelemetry |
| `get_otel_trace` | Get a trace by ID from OpenTelemetry. Params: `traceId` |
| `query_datadog_metrics` | Query metrics from Datadog. Params: `query`, `start`, `end` |
| `list_datadog_monitors` | List monitors from Datadog |
| `get_datadog_trace` | Get a trace by ID from Datadog. Params: `traceId` |

### Quality (GX, Soda, Monte Carlo)

All quality connectors follow a consistent pattern: **list suites**, **run suite**, **get results**, **list monitors**.

| Tool | Description |
|------|-------------|
| `list_gx_suites` | List Great Expectations Cloud suites |
| `run_gx_suite` | Run a Great Expectations suite. Params: `suiteId` |
| `get_gx_results` | Get Great Expectations check results. Params: `suiteId` |
| `list_gx_monitors` | List Great Expectations monitors |
| `list_soda_suites` | List Soda Cloud check suites |
| `run_soda_suite` | Run a Soda Cloud check suite. Params: `suiteId` |
| `get_soda_results` | Get Soda Cloud check results. Params: `suiteId` |
| `list_soda_monitors` | List Soda Cloud monitors |
| `list_monte_carlo_suites` | List Monte Carlo monitor suites |
| `run_monte_carlo_suite` | Run a Monte Carlo monitor suite. Params: `suiteId` |
| `get_monte_carlo_results` | Get Monte Carlo check results. Params: `suiteId` |
| `list_monte_carlo_monitors` | List Monte Carlo monitors |

### BI (Looker & Tableau)

Both BI connectors follow a consistent pattern: **list dashboards**, **get dashboard**, **list reports**, **get data sources**.

| Tool | Description |
|------|-------------|
| `list_looker_dashboards` | List Looker dashboards |
| `get_looker_dashboard` | Get Looker dashboard detail. Params: `dashboardId` |
| `list_looker_reports` | List Looker reports (Looks) |
| `get_looker_data_sources` | Get Looker data source connections |
| `list_tableau_dashboards` | List Tableau dashboards |
| `get_tableau_dashboard` | Get Tableau dashboard detail. Params: `dashboardId` |
| `list_tableau_reports` | List Tableau workbooks |
| `get_tableau_data_sources` | Get Tableau data source connections |

### ITSM (ServiceNow & Jira SM)

Both ITSM connectors follow a consistent pattern: **create**, **get**, **list**, **update** tickets.

#### ServiceNow (4 tools)

| Tool | Description |
|------|-------------|
| `create_servicenow_ticket` | Create a ServiceNow incident. Params: `summary`, `description`, `priority`, `category` |
| `get_servicenow_ticket` | Get a ServiceNow incident. Params: `ticketId` |
| `list_servicenow_tickets` | List ServiceNow incidents. Optional: `status`, `priority` |
| `update_servicenow_ticket` | Update a ServiceNow incident. Params: `ticketId`, optional: `summary`, `priority` |

#### Jira Service Management (4 tools)

| Tool | Description |
|------|-------------|
| `create_jira_sm_ticket` | Create a Jira SM ticket. Params: `summary`, `description`, `priority`, `category` |
| `get_jira_sm_ticket` | Get a Jira SM ticket. Params: `ticketId` |
| `list_jira_sm_tickets` | List Jira SM tickets. Optional: `status`, `priority` |
| `update_jira_sm_ticket` | Update a Jira SM ticket. Params: `ticketId`, optional: `summary`, `priority` |

---

> **Note:** All enterprise connector tools require a `customerId` parameter for multi-tenant isolation. This parameter is omitted from the compact tables above for brevity.
