import { describe, it, expect } from 'vitest';
import { server } from '../index.js';

describe('dw-pipelines MCP Server', () => {
  it('registers all 4 tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain('generate_pipeline');
    expect(names).toContain('validate_pipeline');
    expect(names).toContain('deploy_pipeline');
    expect(names).toContain('list_pipeline_templates');
  });

  it('is initialized with capability tracking', () => {
    expect(server.isInitialized()).toBe(true);
  });

  // generate_pipeline — returns upgrade CTA (write engine stripped)
  describe('generate_pipeline', () => {
    it('returns upgrade CTA', async () => {
      const result = await server.callTool('generate_pipeline', {
        description: 'Extract daily sales from Snowflake, transform with dbt, load into BigQuery',
        customerId: 'cust-1',
      });

      expect(result.isError).toBeUndefined();
      const body = JSON.parse(result.content[0].text!);
      expect(body.error).toBe('pro_feature');
      expect(body.message).toContain('Data Workers Pro');
      expect(body.upgrade_url).toBe('https://dataworkers.io/pricing');
      expect(body.tool).toBe('generate_pipeline');
    });
  });

  // validate_pipeline — read-only, still works
  describe('validate_pipeline', () => {
    it('validates a correct pipeline spec', async () => {
      const spec = {
        id: 'pipe-test',
        name: 'test_pipeline',
        description: 'Test',
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
            code: "SELECT * FROM source_table WHERE updated_at >= '2024-01-01'",
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
        ],
        schedule: '0 0 * * *',
        retryPolicy: { maxRetries: 3, delaySeconds: 60, backoffMultiplier: 2 },
        metadata: {
          author: 'dw-pipelines',
          agentId: 'dw-pipelines',
          customerId: 'cust-1',
          sourceDescription: 'Test',
          generatedAt: Date.now(),
          confidence: 0.9,
          tags: ['etl'],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const valResult = await server.callTool('validate_pipeline', {
        pipelineSpec: spec,
        customerId: 'cust-1',
      });

      const report = JSON.parse(valResult.content[0].text!);
      expect(report.valid).toBe(true);
      expect(report.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  // deploy_pipeline — returns upgrade CTA (write engine stripped)
  describe('deploy_pipeline', () => {
    it('returns upgrade CTA', async () => {
      const result = await server.callTool('deploy_pipeline', {
        pipelineSpec: { id: 'pipe-1', tasks: [{ id: 't0' }], status: 'validated' },
        customerId: 'cust-1',
        environment: 'staging',
      });

      const body = JSON.parse(result.content[0].text!);
      expect(body.error).toBe('pro_feature');
      expect(body.message).toContain('Data Workers Pro');
      expect(body.upgrade_url).toBe('https://dataworkers.io/pricing');
      expect(body.tool).toBe('deploy_pipeline');
    });
  });

  // list_pipeline_templates — read-only, still works
  describe('list_pipeline_templates', () => {
    it('returns all templates', async () => {
      const result = await server.callTool('list_pipeline_templates', {});
      const templates = JSON.parse(result.content[0].text!);
      expect(templates.length).toBeGreaterThanOrEqual(6);
    });

    it('filters by category', async () => {
      const result = await server.callTool('list_pipeline_templates', {
        category: 'etl',
      });
      const templates = JSON.parse(result.content[0].text!);
      expect(templates.every((t: { category: string }) => t.category === 'etl')).toBe(true);
    });

    it('filters by orchestrator', async () => {
      const result = await server.callTool('list_pipeline_templates', {
        orchestrator: 'dagster',
      });
      const templates = JSON.parse(result.content[0].text!);
      expect(templates.every((t: { orchestrator: string }) => t.orchestrator === 'dagster')).toBe(true);
    });
  });

  // JSON-RPC integration
  describe('JSON-RPC', () => {
    it('discovers tools via tools/list', async () => {
      const response = await server.handleMessage(
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      );
      const result = response.result as { tools: Array<{ name: string }> };
      expect(result.tools).toHaveLength(4);
    });

    it('calls generate_pipeline via tools/call and gets upgrade CTA', async () => {
      const response = await server.handleMessage(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'generate_pipeline',
            arguments: {
              description: 'Load CSV into BigQuery',
              customerId: 'cust-test',
            },
          },
        }),
      );
      expect(response.error).toBeUndefined();
    });
  });
});
