/**
 * create_quality_tests_for_pipeline MCP tool — auto-generates quality tests
 * for a pipeline based on its sources, targets, and transformations.
 *
 * Called by the pipeline agent after pipeline generation to ensure
 * data quality checks are in place before deployment.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

export const createQualityTestsForPipelineDefinition: ToolDefinition = {
  name: 'create_quality_tests_for_pipeline',
  description: 'Auto-generate quality tests for a pipeline. Analyzes sources, targets, and transformations to produce appropriate null rate, uniqueness, freshness, row count, and schema tests.',
  inputSchema: {
    type: 'object',
    properties: {
      pipelineId: { type: 'string', description: 'Pipeline ID to generate tests for.' },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            table: { type: 'string' },
          },
        },
        description: 'Source tables consumed by the pipeline.',
      },
      targets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            table: { type: 'string' },
          },
        },
        description: 'Target tables produced by the pipeline.',
      },
      transformations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Transformation types applied (e.g., join, aggregate, filter).',
      },
      customerId: { type: 'string' },
    },
    required: ['pipelineId', 'customerId'],
  },
};

interface QualityTestSpec {
  id: string;
  name: string;
  type: string;
  target: string;
  config: Record<string, unknown>;
  severity: 'error' | 'warn';
}

export const createQualityTestsForPipelineHandler: ToolHandler = async (args) => {
  const pipelineId = args.pipelineId as string;
  const customerId = args.customerId as string;
  const sources = (args.sources as Array<{ platform: string; table: string }>) ?? [];
  const targets = (args.targets as Array<{ platform: string; table: string }>) ?? [];
  const transformations = (args.transformations as string[]) ?? [];

  try {
    const tests: QualityTestSpec[] = [];
    let testIndex = 0;

    // Generate tests for each target table
    for (const target of targets) {
      const tableName = target.table ?? target.platform;

      // Schema validation test
      tests.push({
        id: `qt-${pipelineId}-${testIndex++}`,
        name: `${tableName}_schema_check`,
        type: 'schema',
        target: `${target.platform}.${tableName}`,
        config: { expectColumns: true },
        severity: 'error',
      });

      // Row count test (ensure data was loaded)
      tests.push({
        id: `qt-${pipelineId}-${testIndex++}`,
        name: `${tableName}_row_count`,
        type: 'row_count',
        target: `${target.platform}.${tableName}`,
        config: { minRows: 1 },
        severity: 'error',
      });

      // Freshness test
      tests.push({
        id: `qt-${pipelineId}-${testIndex++}`,
        name: `${tableName}_freshness`,
        type: 'freshness',
        target: `${target.platform}.${tableName}`,
        config: { maxAgeHours: 24 },
        severity: 'warn',
      });

      // Null rate test for critical columns
      tests.push({
        id: `qt-${pipelineId}-${testIndex++}`,
        name: `${tableName}_null_rate`,
        type: 'not_null',
        target: `${target.platform}.${tableName}`,
        config: { maxNullRate: 0.1 },
        severity: 'error',
      });
    }

    // Add transformation-specific tests
    if (transformations.includes('join') || transformations.includes('merge')) {
      // Join operations need uniqueness checks
      for (const target of targets) {
        tests.push({
          id: `qt-${pipelineId}-${testIndex++}`,
          name: `${target.table ?? target.platform}_join_uniqueness`,
          type: 'uniqueness',
          target: `${target.platform}.${target.table ?? target.platform}`,
          config: { minDistinctRatio: 0.99 },
          severity: 'error',
        });
      }
    }

    if (transformations.includes('aggregate') || transformations.includes('group')) {
      // Aggregation operations need volume comparison
      for (const source of sources) {
        tests.push({
          id: `qt-${pipelineId}-${testIndex++}`,
          name: `${source.table ?? source.platform}_source_volume`,
          type: 'volume',
          target: `${source.platform}.${source.table ?? source.platform}`,
          config: { minRows: 100 },
          severity: 'warn',
        });
      }
    }

    // Source freshness checks
    for (const source of sources) {
      tests.push({
        id: `qt-${pipelineId}-${testIndex++}`,
        name: `${source.table ?? source.platform}_source_freshness`,
        type: 'freshness',
        target: `${source.platform}.${source.table ?? source.platform}`,
        config: { maxAgeHours: 48 },
        severity: 'warn',
      });
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          pipelineId,
          customerId,
          testsGenerated: tests.length,
          tests,
          generatedAt: Date.now(),
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Failed to create quality tests: ${err instanceof Error ? err.message : String(err)}`,
          pipelineId,
        }, null, 2),
      }],
      isError: true,
    };
  }
};
