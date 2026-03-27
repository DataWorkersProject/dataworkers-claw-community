import { describe, it, expect } from 'vitest';
import { PipelineValidator } from '../validation/pipeline-validator.js';
import { CrossAgentQueryClient } from '../validation/cross-agent-client.js';
import type { PipelineSpec } from '../types.js';

const mockSpec: PipelineSpec = {
  id: 'pipe-test-1',
  name: 'test_pipeline',
  description: 'Test pipeline',
  version: 1,
  status: 'draft',
  orchestrator: 'airflow',
  codeLanguage: 'sql',
  tasks: [
    {
      id: 'task_0',
      name: 'extract_source',
      type: 'extract',
      description: 'Extract data',
      code: 'SELECT * FROM source_table WHERE updated_at >= \'2024-01-01\'',
      codeLanguage: 'sql',
      dependencies: [],
      config: {},
    },
    {
      id: 'task_1',
      name: 'load_target',
      type: 'load',
      description: 'Load data',
      code: 'INSERT INTO target_table SELECT * FROM staging_table',
      codeLanguage: 'sql',
      dependencies: ['task_0'],
      config: {},
    },
  ],
  qualityTests: [
    { name: 'schema_check', type: 'schema', target: 'target_table', config: {}, severity: 'error' },
    { name: 'row_count', type: 'row_count', target: 'target_table', config: { minRows: 1 }, severity: 'error' },
  ],
  schedule: '0 0 * * *',
  retryPolicy: { maxRetries: 3, delaySeconds: 60, backoffMultiplier: 2 },
  metadata: {
    author: 'dw-pipelines',
    agentId: 'dw-pipelines',
    customerId: 'cust-1',
    sourceDescription: 'Test pipeline',
    generatedAt: Date.now(),
    confidence: 0.9,
    tags: ['etl'],
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('PipelineValidator (REQ-PIPE-005)', () => {
  const validator = new PipelineValidator();

  it('validates a correct pipeline', async () => {
    const report = await validator.validate(mockSpec, { customerId: 'cust-1' });
    expect(report.valid).toBe(true);
    expect(report.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects syntax errors', async () => {
    const badSpec = {
      ...mockSpec,
      tasks: [{
        ...mockSpec.tasks[0],
        code: 'SELECT COUNT(id FROM users', // Unclosed paren
      }],
    };
    const report = await validator.validate(badSpec, { customerId: 'cust-1' });
    expect(report.valid).toBe(false);
    expect(report.syntaxErrors.length).toBeGreaterThan(0);
  });

  it('generates semantic layer warnings', async () => {
    const specWithMetrics = {
      ...mockSpec,
      tasks: [{
        ...mockSpec.tasks[0],
        code: 'SELECT SUM(revenue) AS total_revenue FROM orders',
      }],
    };
    const report = await validator.validate(specWithMetrics, { customerId: 'cust-1' });
    expect(report.semanticWarnings.length).toBeGreaterThan(0);
  });

  it('skips sandbox when syntax invalid', async () => {
    const badSpec = {
      ...mockSpec,
      tasks: [{ ...mockSpec.tasks[0], code: 'SELECT (((' }],
    };
    const report = await validator.validate(badSpec, { customerId: 'cust-1' });
    expect(report.sandboxResult?.success).toBe(false);
  });
});

describe('CrossAgentQueryClient (REQ-PIPE-004)', () => {
  const client = new CrossAgentQueryClient();

  it('queries reusable assets', async () => {
    const assets = await client.queryReusableAssets('cust-1', 'customer data');
    expect(Array.isArray(assets)).toBe(true);
  });

  it('checks schema compatibility', async () => {
    const compat = await client.checkSchemaCompatibility('cust-1', 'orders', [
      { name: 'id', type: 'integer' },
    ]);
    expect(compat.compatible).toBe(true);
  });
});
