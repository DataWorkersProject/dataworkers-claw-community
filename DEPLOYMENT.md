# Data Workers -- Production Deployment Guide

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | >= 20.0.0 | LTS recommended (20.x or 22.x) |
| npm | >= 10 | Ships with Node 20+ |
| Docker | >= 24 | Optional -- for containerized deployment |
| Kubernetes | >= 1.28 | Optional -- for orchestrated deployment |

Build the project before deploying:

```bash
npm ci
npm run build
```

## 2. Infrastructure Requirements

### Required Services

| Service | Purpose | Image |
|---|---|---|
| **PostgreSQL 16** | Relational store, full-text search, pgvector embeddings | `ankane/pgvector:v0.8.0-pg16` |
| **Redis 7** | Key-value cache, queue, pub/sub | `redis:7-alpine` |
| **LLM Provider** | At least one: Anthropic, OpenAI, Bedrock, Vertex, Ollama, Azure OpenAI | -- |

### Optional Services

| Service | Purpose | Image |
|---|---|---|
| **Neo4j 5** | Lineage graphs, relationship queries | `neo4j:5-community` |
| **Kafka** | Event streaming, message bus | `confluentinc/cp-kafka:7.6.0` |
| **Airflow 2.x** | DAG orchestration | -- |

The factory pattern auto-detects real infrastructure from environment variables. If a service is not configured, agents fall back to in-memory stubs (not suitable for production).

## 3. Environment Variables

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | -- | Set to `production` |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `DW_AGENT_NAME` | Yes | -- | Agent identifier (e.g., `dw-pipelines`) |
| `DW_AGENT_PORT` | No | `3000` | HTTP port for agent health/metrics |

### PostgreSQL (relational store + FTS + pgvector)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Recommended | -- | Full connection string, e.g., `postgresql://user:pass@host:5432/db` |
| `PG_HOST` | Alt | `localhost` | Used if `DATABASE_URL` is not set |
| `PG_PORT` | No | `5432` | |
| `PG_DATABASE` | No | `dataworkers` | |
| `PG_USER` | No | `postgres` | |
| `PG_PASSWORD` | No | -- | |
| `PGVECTOR_ENABLED` | No | -- | Set to `true` to enable pgvector adapter |
| `PG_FTS_ENABLED` | No | -- | Set to `true` to enable PostgreSQL full-text search |

### Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_URL` | Recommended | -- | Full connection string, e.g., `redis://:pass@host:6379/0` |
| `REDIS_HOST` | Alt | `localhost` | Used if `REDIS_URL` is not set |
| `REDIS_PORT` | No | `6379` | |
| `REDIS_PASSWORD` | No | -- | |

### Neo4j (optional -- lineage graphs)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEO4J_URI` | No | `bolt://localhost:7687` | Bolt protocol URI |
| `NEO4J_USERNAME` | No | `neo4j` | |
| `NEO4J_PASSWORD` | No | `neo4j` | |
| `NEO4J_DATABASE` | No | -- | Named database (Enterprise edition) |

### Kafka (optional -- event streaming)

| Variable | Required | Default | Description |
|---|---|---|---|
| `KAFKA_BROKERS` | No | `localhost:9092` | Comma-separated broker list |
| `KAFKA_CLIENT_ID` | No | `data-workers` | |
| `KAFKA_GROUP_ID` | No | -- | Consumer group ID |

### Airflow (optional -- orchestration)

| Variable | Required | Default | Description |
|---|---|---|---|
| `AIRFLOW_URL` | No | `http://localhost:8080` | Airflow webserver URL |
| `AIRFLOW_USERNAME` | No | `airflow` | Basic auth username |
| `AIRFLOW_PASSWORD` | No | `airflow` | Basic auth password |

### LLM Providers (at least one required)

| Variable | Provider | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic | Claude API key |
| `OPENAI_API_KEY` | OpenAI | GPT API key |
| `AWS_BEDROCK_REGION` | AWS Bedrock | AWS region for Bedrock |
| `GOOGLE_CLOUD_PROJECT` | Vertex AI | GCP project ID |
| `OLLAMA_HOST` | Ollama | Local Ollama endpoint |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI | Azure OpenAI resource URL |

### Warehouse Connectors (optional)

| Variable | Description |
|---|---|
| `WAREHOUSE_TYPE` | `snowflake`, `bigquery`, or `databricks` |
| `SNOWFLAKE_ACCOUNT` | Snowflake account identifier |
| `SNOWFLAKE_USERNAME` | |
| `SNOWFLAKE_PASSWORD` | |
| `SNOWFLAKE_WAREHOUSE` | |
| `GOOGLE_CLOUD_PROJECT` | BigQuery project |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account JSON |
| `DATABRICKS_HOST` | Databricks workspace URL |
| `DATABRICKS_TOKEN` | Databricks personal access token |

### Catalog Connectors (optional)

| Variable | Description |
|---|---|
| `DATAHUB_URL` | DataHub GMS endpoint |
| `DATAHUB_TOKEN` | DataHub auth token |
| `OPENMETADATA_URL` | OpenMetadata server URL |
| `OPENMETADATA_TOKEN` | OpenMetadata auth token |
| `DBT_API_TOKEN` | dbt Cloud API token |
| `DBT_ACCOUNT_ID` | dbt Cloud account ID |
| `NESSIE_URL` | Nessie catalog URL |
| `MARQUEZ_URL` | Marquez / OpenLineage endpoint |
| `AZURE_PURVIEW_ENDPOINT` | Azure Purview endpoint |

### Observability

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OpenTelemetry collector |
| `OTEL_SERVICE_NAME` | `data-workers` | Service name for traces |

## 4. Docker Deployment

### Full Stack with docker-compose

The repository includes two compose files. Run the full agent swarm with all infrastructure:

```bash
# Start infrastructure + all 11 agents
docker compose -f docker-compose.yml -f docker/docker-compose.agents.yml up -d
```

For production, override credentials and add your LLM key:

```bash
# Create a .env file (do NOT commit this)
cat > .env <<'EOF'
NODE_ENV=production
POSTGRES_PASSWORD=<strong-password>
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://dw_user:<strong-password>@postgres:5432/data_workers
NEO4J_URI=bolt://neo4j:7687
NEO4J_PASSWORD=<strong-password>
KAFKA_BROKERS=kafka:9092
PGVECTOR_ENABLED=true
PG_FTS_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...
EOF

docker compose -f docker-compose.yml -f docker/docker-compose.agents.yml --env-file .env up -d
```

### Building a Single Agent Image

```bash
docker build -f docker/Dockerfile.agent -t data-workers/dw-pipelines .
docker run -d \
  --name dw-pipelines \
  -p 3001:3000 \
  -e DW_AGENT_NAME=dw-pipelines \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  data-workers/dw-pipelines
```

## 5. Kubernetes Deployment

### Agent Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dw-pipelines
  labels:
    app: data-workers
    agent: dw-pipelines
spec:
  replicas: 2
  selector:
    matchLabels:
      agent: dw-pipelines
  template:
    metadata:
      labels:
        agent: dw-pipelines
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
        - name: agent
          image: ghcr.io/dhanushashetty/data-workers:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DW_AGENT_NAME
              value: "dw-pipelines"
          envFrom:
            - secretRef:
                name: dw-infra-secrets
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: dw-pipelines
spec:
  selector:
    agent: dw-pipelines
  ports:
    - port: 3000
      targetPort: 3000
```

### Secrets

```bash
kubectl create secret generic dw-infra-secrets \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=REDIS_URL='redis://...' \
  --from-literal=ANTHROPIC_API_KEY='sk-ant-...' \
  --from-literal=NEO4J_URI='bolt://...' \
  --from-literal=NEO4J_PASSWORD='...'
```

Repeat the Deployment manifest for each agent, changing `DW_AGENT_NAME` and the metadata name. All 11 agents share the same container image.

## 6. Health Checks

Each agent exposes HTTP `/health` and `/metrics` endpoints when the `DW_HEALTH_PORT` environment variable is set. The health server starts automatically — no code changes needed. Agents using stdio transport (the default) do not expose HTTP endpoints unless `DW_HEALTH_PORT` is configured.

```bash
# Enable health endpoint on port 3001
DW_HEALTH_PORT=3001 node agents/dw-quality/dist/index.js
```

Check agent health:

```bash
# Check a single agent
curl http://localhost:3001/health
# Expected: HTTP 200 with JSON status

# Check all agents (docker-compose)
for port in $(seq 3001 3014); do
  echo "Port $port: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$port/health)"
done
```

### Infrastructure Health

```bash
# PostgreSQL
pg_isready -h localhost -U dw_user -d data_workers

# Redis
redis-cli ping    # Expected: PONG

# Neo4j
curl -s http://localhost:7474    # Expected: JSON with neo4j info

# Kafka
kafka-broker-api-versions --bootstrap-server localhost:9092
```

## 7. Monitoring

### OpenTelemetry

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to point at your OTel collector. Traces include:

- Agent invocation spans (tool calls, LLM requests)
- Cross-agent context propagation
- Error status and attributes

Recommended stack: OTel Collector -> Jaeger or Grafana Tempo.

### Prometheus Metrics

The `PrometheusMetrics` class exports text-format metrics. Built-in metrics:

| Metric | Type | Description |
|---|---|---|
| `agent_invocations_total` | Counter | Total agent invocations |
| `llm_tokens_total` | Counter | Total LLM tokens consumed |
| `errors_total` | Counter | Total errors |
| `request_duration_seconds` | Histogram | Request latency |
| `llm_latency_seconds` | Histogram | LLM call latency |
| `active_agents` | Gauge | Currently active agents |
| `circuit_breaker_state` | Gauge | 0=closed, 1=open, 2=half-open |

Scrape the `/metrics` endpoint from each agent for Prometheus.

## 8. Scaling

### Horizontal Scaling

- **Stateless agents**: All 11 agents are stateless. Scale any agent independently by increasing replicas.
- **Redis**: Use Redis Cluster for high availability. The `RedisAdapter` supports cluster mode.
- **PostgreSQL**: Use read replicas for read-heavy agents (catalog, insights). Connection pooling via PgBouncer is recommended.
- **Kafka**: Add partitions to scale consumer throughput. Set `KAFKA_GROUP_ID` per agent type so multiple replicas share the load.

### Recommended Starting Point

| Component | Replicas | Notes |
|---|---|---|
| dw-pipelines | 2-3 | High throughput |
| dw-incidents | 2 | Needs fast response |
| dw-ml | 1-2 | Scale based on load |
| Other agents | 1-2 | Scale based on load |
| PostgreSQL | 1 primary + 1 replica | |
| Redis | 3-node cluster | |

### Resource Sizing

Each agent container typically needs 256Mi-512Mi RAM and 0.25-1 CPU. LLM-heavy agents (insights, quality) may spike higher during inference calls; the bottleneck is usually LLM API latency, not local compute.

## 9. Security Checklist

- [ ] **Secrets management**: Never put API keys in docker-compose files or manifests. Use `.env` files (local) or Kubernetes Secrets.
- [ ] **Non-root containers**: The Dockerfile creates a `dwagent` user. Verify with `docker exec <container> whoami`.
- [ ] **Network isolation**: Place infrastructure services (Postgres, Redis, Neo4j, Kafka) on an internal network. Only expose agent ports.
- [ ] **TLS everywhere**: Enable SSL for PostgreSQL (`ssl: true` in config), Redis (use `rediss://` URLs), Neo4j (`neo4j+s://`), and Kafka (configure SASL/SSL).
- [ ] **Rotate credentials**: Rotate all database passwords, API keys, and tokens on a regular schedule.
- [ ] **Audit logging**: Set `LOG_LEVEL=info` minimum. Ship logs to a centralized system (ELK, Loki).

> **Note:** Advanced security features such as PII middleware, autonomy controls, usage metering, and HashiCorp Vault integration are available in Data Workers Pro.

## 10. Troubleshooting

### Agent fails to start: "InMemory stub active"

**Cause**: The factory function did not detect real infrastructure env vars.
**Fix**: Verify the environment variable is set and the service is reachable. Check for typos -- the factory checks specific names:
- Key-value: `REDIS_URL` or `REDIS_HOST`
- Relational: `DATABASE_URL` or `PG_HOST`
- Graph: `NEO4J_URI`
- Message bus: `KAFKA_BROKERS`

### Connection refused to PostgreSQL/Redis

**Cause**: Service not ready or network misconfigured.
**Fix**: In Docker, ensure `depends_on` with health checks. In Kubernetes, use init containers or readiness probes. Verify the hostname resolves correctly inside the container network.

### "Cannot find module 'ioredis'" / "Cannot find module 'pg'"

**Cause**: The adapter dynamically imports its driver. Production builds must include peer dependencies.
**Fix**: Ensure `npm ci --production` installs all workspace dependencies. The adapters need: `ioredis`, `pg`, `neo4j-driver`, `kafkajs`.

### LLM calls timing out

**Cause**: Network latency or rate limiting from the LLM provider.
**Fix**: Check `llm_latency_seconds` metrics. Consider using the provider fallback chain (`core/llm-provider/src/provider-fallback.ts`) to route to a backup provider. For self-hosted, verify `OLLAMA_HOST` connectivity.

### High memory usage

**Cause**: In-memory stubs holding too much state (should not be active in production).
**Fix**: Confirm all factories resolved to real adapters by checking startup logs. Set `NODE_OPTIONS=--max-old-space-size=512` per container if needed.

### Kafka consumer lag

**Cause**: Agent processing slower than event production rate.
**Fix**: Scale the agent replicas. Ensure all replicas share the same `KAFKA_GROUP_ID` so Kafka distributes partitions across them.
