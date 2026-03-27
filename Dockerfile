# =============================================================================
# Data Workers - Multi-stage Dockerfile
# =============================================================================
# Build:  docker build -t data-workers .
# Run:    docker run -p 3000:3000 --env-file .env -e DW_AGENT_NAME=dw-pipelines data-workers
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Builder - install all deps and compile TypeScript
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build toolchain needed by native modules (pg, ioredis, etc.)
RUN apk add --no-cache python3 make g++

# Copy root package manifests first for layer caching
COPY package.json package-lock.json tsconfig.json ./

# Copy all workspace package.json files preserving directory structure.
# Each COPY creates the target directory and places the file correctly.
COPY agents/dw-pipelines/package.json ./agents/dw-pipelines/
COPY agents/dw-incidents/package.json ./agents/dw-incidents/
COPY agents/dw-context-catalog/package.json ./agents/dw-context-catalog/
COPY agents/dw-cost/package.json ./agents/dw-cost/
COPY agents/dw-governance/package.json ./agents/dw-governance/
COPY agents/dw-migration/package.json ./agents/dw-migration/
COPY agents/dw-insights/package.json ./agents/dw-insights/
COPY agents/dw-observability/package.json ./agents/dw-observability/
COPY agents/dw-streaming/package.json ./agents/dw-streaming/
COPY agents/dw-orchestration/package.json ./agents/dw-orchestration/
COPY agents/dw-schema/package.json ./agents/dw-schema/
COPY agents/dw-quality/package.json ./agents/dw-quality/
COPY agents/dw-connectors/package.json ./agents/dw-connectors/
COPY agents/dw-usage-intelligence/package.json ./agents/dw-usage-intelligence/

COPY core/mcp-framework/package.json ./core/mcp-framework/
COPY core/context-layer/package.json ./core/context-layer/
COPY core/agent-lifecycle/package.json ./core/agent-lifecycle/
COPY core/validation/package.json ./core/validation/
COPY core/infrastructure-stubs/package.json ./core/infrastructure-stubs/
COPY core/orchestrator/package.json ./core/orchestrator/
COPY core/llm-provider/package.json ./core/llm-provider/
COPY core/enterprise/package.json ./core/enterprise/
COPY core/license/package.json ./core/license/
COPY core/medallion/package.json ./core/medallion/
COPY core/metering/package.json ./core/metering/
COPY core/platform/package.json ./core/platform/
COPY core/conflict-resolution/package.json ./core/conflict-resolution/

COPY connectors/snowflake/package.json ./connectors/snowflake/
COPY connectors/bigquery/package.json ./connectors/bigquery/
COPY connectors/databricks/package.json ./connectors/databricks/
COPY connectors/datahub/package.json ./connectors/datahub/
COPY connectors/openmetadata/package.json ./connectors/openmetadata/
COPY connectors/dbt/package.json ./connectors/dbt/
COPY connectors/iceberg/package.json ./connectors/iceberg/
COPY connectors/nessie/package.json ./connectors/nessie/
COPY connectors/openlineage/package.json ./connectors/openlineage/
COPY connectors/purview/package.json ./connectors/purview/
COPY connectors/glue/package.json ./connectors/glue/
COPY connectors/hive-metastore/package.json ./connectors/hive-metastore/
COPY connectors/polaris/package.json ./connectors/polaris/
COPY connectors/dataplex/package.json ./connectors/dataplex/
COPY connectors/enterprise/package.json ./connectors/enterprise/
COPY connectors/shared/package.json ./connectors/shared/

COPY packages/cli/package.json ./packages/cli/
COPY packages/vscode-extension/package.json ./packages/vscode-extension/

# Install all dependencies (including devDependencies for building)
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy all source code and build
COPY agents/ ./agents/
COPY core/ ./core/
COPY connectors/ ./connectors/
COPY packages/ ./packages/
COPY scripts/ ./scripts/

# Build only the packages needed for agents (skip adapters that need native drivers)
# The --if-present flag means workspaces without a build script are skipped
RUN npm run build --workspace=core/mcp-framework --if-present 2>/dev/null; \
    npm run build --workspace=core/license --if-present 2>/dev/null; \
    npm run build --workspace=core/context-layer --if-present 2>/dev/null; \
    npm run build --workspace=core/validation --if-present 2>/dev/null; \
    npm run build --workspace=core/agent-lifecycle --if-present 2>/dev/null; \
    npm run build --workspace=packages/cli --if-present 2>/dev/null; \
    echo "Core packages built. Agent source runs via tsx at runtime."

# ---------------------------------------------------------------------------
# Stage 2: Runtime - use builder with cleanup for workspace symlink compat
# ---------------------------------------------------------------------------
FROM builder AS runtime

LABEL maintainer="Data Workers <hello@dataworkers.dev>"
LABEL description="Data Workers - autonomous agent swarm for data engineering"

# Install runtime extras
RUN apk add --no-cache tini wget

# Remove test files, docs, seed data to reduce size
RUN find /app -name '__tests__' -type d -exec rm -rf {} + 2>/dev/null; \
    find /app -name '*.test.ts' -delete 2>/dev/null; \
    rm -rf /app/tests /app/seed-data /app/scripts /app/docs /app/coverage 2>/dev/null; \
    true

# Create non-root user
RUN addgroup -S dwagent && adduser -S -G dwagent dwagent && \
    chown -R dwagent:dwagent /app

USER dwagent

# Health check against the agent HTTP health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${DW_HEALTH_PORT:-3000}/health || exit 1

EXPOSE 3000

ENV NODE_ENV=production
ENV DW_HEALTH_PORT=3000

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["tini", "--"]

# Default: run the pipelines agent. Override DW_AGENT_NAME for other agents.
# Uses tsx for TypeScript execution (agents ship as source, not compiled)
CMD ["npx", "tsx", "agents/dw-pipelines/src/index.ts"]
