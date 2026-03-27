import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@data-workers/mcp-framework': path.resolve(__dirname, 'core/mcp-framework/src'),
      '@data-workers/context-layer': path.resolve(__dirname, 'core/context-layer/src'),
      '@data-workers/agent-lifecycle': path.resolve(__dirname, 'core/agent-lifecycle/src'),
      '@data-workers/validation': path.resolve(__dirname, 'core/validation/src'),
      '@data-workers/infrastructure-stubs': path.resolve(__dirname, 'core/infrastructure-stubs/src'),
      '@data-workers/enterprise': path.resolve(__dirname, 'core/enterprise/src'),
      '@data-workers/iceberg-connector': path.resolve(__dirname, 'connectors/iceberg/src'),
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
