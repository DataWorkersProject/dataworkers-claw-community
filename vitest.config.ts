import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Core packages
      '@data-workers/mcp-framework': path.resolve(__dirname, 'core/mcp-framework/src'),
      '@data-workers/context-layer': path.resolve(__dirname, 'core/context-layer/src'),
      '@data-workers/agent-lifecycle': path.resolve(__dirname, 'core/agent-lifecycle/src'),
      '@data-workers/validation': path.resolve(__dirname, 'core/validation/src'),
      '@data-workers/infrastructure-stubs': path.resolve(__dirname, 'core/infrastructure-stubs/src'),
      '@data-workers/enterprise': path.resolve(__dirname, 'core/enterprise/src'),
      '@data-workers/license': path.resolve(__dirname, 'core/license/src'),
      '@data-workers/llm-provider': path.resolve(__dirname, 'core/llm-provider/src'),
      '@data-workers/medallion': path.resolve(__dirname, 'core/medallion/src'),
      '@data-workers/orchestrator': path.resolve(__dirname, 'core/orchestrator/src'),
      '@data-workers/platform': path.resolve(__dirname, 'core/platform/src'),
      '@data-workers/conflict-resolution': path.resolve(__dirname, 'core/conflict-resolution/src'),
      // Connectors
      '@data-workers/iceberg-connector': path.resolve(__dirname, 'connectors/iceberg/src'),
      '@data-workers/snowflake-connector': path.resolve(__dirname, 'connectors/snowflake/src'),
      '@data-workers/bigquery-connector': path.resolve(__dirname, 'connectors/bigquery/src'),
      '@data-workers/databricks-connector': path.resolve(__dirname, 'connectors/databricks/src'),
      '@data-workers/dbt-connector': path.resolve(__dirname, 'connectors/dbt/src'),
      '@data-workers/glue-connector': path.resolve(__dirname, 'connectors/glue/src'),
      '@data-workers/hive-metastore-connector': path.resolve(__dirname, 'connectors/hive-metastore/src'),
      '@data-workers/datahub-connector': path.resolve(__dirname, 'connectors/datahub/src'),
      '@data-workers/openmetadata-connector': path.resolve(__dirname, 'connectors/openmetadata/src'),
      '@data-workers/nessie-connector': path.resolve(__dirname, 'connectors/nessie/src'),
      '@data-workers/purview-connector': path.resolve(__dirname, 'connectors/purview/src'),
      '@data-workers/dataplex-connector': path.resolve(__dirname, 'connectors/dataplex/src'),
      '@data-workers/polaris-connector': path.resolve(__dirname, 'connectors/polaris/src'),
      '@data-workers/openlineage-connector': path.resolve(__dirname, 'connectors/openlineage/src'),
      '@data-workers/connector-shared': path.resolve(__dirname, 'connectors/shared'),
      // Agents (for cross-agent test imports)
      '@data-workers/dw-context-catalog': path.resolve(__dirname, 'agents/dw-context-catalog/src'),
      '@data-workers/dw-pipelines': path.resolve(__dirname, 'agents/dw-pipelines/src'),
      '@data-workers/dw-incidents': path.resolve(__dirname, 'agents/dw-incidents/src'),
      '@data-workers/dw-schema': path.resolve(__dirname, 'agents/dw-schema/src'),
      '@data-workers/dw-quality': path.resolve(__dirname, 'agents/dw-quality/src'),
      '@data-workers/dw-governance': path.resolve(__dirname, 'agents/dw-governance/src'),
      '@data-workers/dw-observability': path.resolve(__dirname, 'agents/dw-observability/src'),
      '@data-workers/dw-connectors': path.resolve(__dirname, 'agents/dw-connectors/src'),
      '@data-workers/dw-usage-intelligence': path.resolve(__dirname, 'agents/dw-usage-intelligence/src'),
      '@data-workers/dw-ml': path.resolve(__dirname, 'agents/dw-ml/src'),
      '@data-workers/dw-orchestration': path.resolve(__dirname, 'agents/dw-orchestration/src'),
    },
  },
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 4,
      },
    },
    include: ['**/src/__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'scripts/oss-overrides/**'],
    env: {
      // Default to enterprise tier in tests so tool-gate doesn't block write tools.
      // Individual gate tests can override via process.env within their suite.
      DW_LICENSE_TIER: 'enterprise',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      // Thresholds enforced in CI. Set to warn-only locally.
      // Target: lines 60%, branches 50%, functions 60%, statements 60%
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 60,
        statements: 60,
      },
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/index.ts',
        '**/types.ts',
        '**/__tests__/**',
        '**/vitest.config.*',
      ],
    },
  },
});
