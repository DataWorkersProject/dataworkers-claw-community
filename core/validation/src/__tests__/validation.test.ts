import { describe, it, expect } from 'vitest';
import { CodeValidationGate } from '../gates/code-validation.js';
import { ConfidenceGate } from '../gates/confidence-gate.js';
import { CitationTracker } from '../gates/citation-tracker.js';
import { FactualGroundingGate } from '../gates/factual-grounding.js';
import { OutputDiffGenerator } from '../gates/output-diff.js';
import { SandboxExecutor } from '../gates/sandbox-executor.js';
import { ValidationPipeline } from '../validation-pipeline.js';
import type { ValidationInput } from '../types.js';

const baseInput: ValidationInput = {
  content: '',
  contentType: 'sql',
  agentId: 'dw-pipelines',
  customerId: 'cust-1',
};

describe('CodeValidationGate (REQ-HALL-002)', () => {
  const gate = new CodeValidationGate();

  it('validates correct SQL', async () => {
    const result = await gate.validate({
      ...baseInput,
      content: 'SELECT id, name FROM users WHERE active = true',
    });
    expect(result.passed).toBe(true);
  });

  it('detects unbalanced parentheses', async () => {
    const result = await gate.validate({
      ...baseInput,
      content: 'SELECT COUNT(id FROM users',
    });
    expect(result.passed).toBe(false);
    expect(result.errors[0].code).toBe('UNCLOSED_PARENS');
  });

  it('detects DAG cycles', async () => {
    const result = await gate.validate({
      ...baseInput,
      contentType: 'dag',
      content: 'A -> B\nB -> C\nC -> A',
    });
    expect(result.passed).toBe(false);
    expect(result.errors[0].code).toBe('DAG_CYCLE');
  });

  it('passes valid DAG', async () => {
    const result = await gate.validate({
      ...baseInput,
      contentType: 'dag',
      content: 'A -> B\nB -> C\nA -> C',
    });
    expect(result.passed).toBe(true);
  });

  it('detects YAML tabs', async () => {
    const result = await gate.validate({
      ...baseInput,
      contentType: 'yaml',
      content: 'key:\n\tvalue: test',
    });
    expect(result.passed).toBe(false);
  });
});

describe('ConfidenceGate (REQ-HALL-003)', () => {
  const gate = new ConfidenceGate(0.85);

  it('passes at 85%+ confidence', async () => {
    const result = await gate.validate({
      ...baseInput,
      metadata: { confidence: 0.90 },
    });
    expect(result.passed).toBe(true);
    expect(result.metadata?.recommendation).toBe('auto-apply');
  });

  it('fails below 85% confidence', async () => {
    const result = await gate.validate({
      ...baseInput,
      metadata: { confidence: 0.75 },
    });
    expect(result.passed).toBe(false);
    expect(result.metadata?.recommendation).toBe('human-review');
  });
});

describe('CitationTracker (REQ-HALL-004)', () => {
  const tracker = new CitationTracker();

  it('extracts SOURCE citations', () => {
    const content = 'The table is stale. SOURCE: quality_monitoring.metric_history, row_id: 4521';
    const citations = tracker.extractCitations(content);
    expect(citations).toHaveLength(1);
    expect(citations[0].sourceId).toBe('metric_history');
  });

  it('extracts multiple citations', () => {
    const content = 'Based on SOURCE: catalog.orders_table and SOURCE: lineage.upstream_pipeline';
    const citations = tracker.extractCitations(content);
    expect(citations).toHaveLength(2);
  });
});

describe('FactualGroundingGate (REQ-HALL-001)', () => {
  it('passes when all entities exist', async () => {
    const gate = new FactualGroundingGate(async () => true);
    const result = await gate.validate({
      ...baseInput,
      content: 'SELECT * FROM users JOIN orders ON users.id = orders.user_id',
    });
    expect(result.passed).toBe(true);
  });

  it('fails when entity not found', async () => {
    const gate = new FactualGroundingGate(async (_cid, _type, name) => name !== 'nonexistent');
    const result = await gate.validate({
      ...baseInput,
      content: 'SELECT * FROM nonexistent',
    });
    expect(result.passed).toBe(false);
    expect(result.errors[0].code).toBe('ENTITY_NOT_FOUND');
  });
});

describe('OutputDiffGenerator (REQ-HALL-007)', () => {
  const differ = new OutputDiffGenerator();

  it('generates create diff', () => {
    const diff = differ.generateDiff('pipeline/new-etl', null, { name: 'new-etl', schedule: 'daily' });
    expect(diff.operation).toBe('create');
    expect(diff.riskLevel).toBe('medium');
  });

  it('generates delete diff as critical', () => {
    const diff = differ.generateDiff('schema/users', { columns: ['id', 'name'] }, null);
    expect(diff.operation).toBe('delete');
    expect(diff.riskLevel).toBe('critical');
  });

  it('generates modify diff with changed fields', () => {
    const diff = differ.generateDiff('schema/orders', { type: 'int' }, { type: 'bigint' });
    expect(diff.operation).toBe('modify');
    expect(diff.changedFields).toContain('type');
  });

  it('requires approval for high/critical risk', () => {
    const critical = differ.generateDiff('schema/x', { a: 1 }, null);
    expect(differ.requiresApproval(critical)).toBe(true);

    const low = differ.generateDiff('documentation/readme', null, { content: 'hi' });
    expect(differ.requiresApproval(low)).toBe(false);
  });

  it('formats diff as readable string', () => {
    const diff = differ.generateDiff('pipeline/etl', { version: 1 }, { version: 2 });
    const formatted = differ.formatDiff(diff);
    expect(formatted).toContain('Output Diff');
    expect(formatted).toContain('Before');
    expect(formatted).toContain('After');
  });
});

describe('SandboxExecutor (REQ-HALL-005)', () => {
  it('executes code in sandbox', async () => {
    const sandbox = new SandboxExecutor();
    const result = await sandbox.execute('SELECT 1', 'sql');
    expect(result.success).toBe(true);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('respects config defaults', () => {
    const sandbox = new SandboxExecutor();
    const config = sandbox.getConfig();
    expect(config.timeoutMs).toBe(30_000);
    expect(config.maxMemoryMB).toBe(256);
    expect(config.allowNetwork).toBe(false);
  });
});

describe('ValidationPipeline', () => {
  it('runs all gates in order', async () => {
    const pipeline = new ValidationPipeline();
    pipeline.addGate(new CodeValidationGate());
    pipeline.addGate(new ConfidenceGate(0.85));

    const result = await pipeline.validate({
      ...baseInput,
      content: 'SELECT * FROM users',
      metadata: { confidence: 0.90 },
    });

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  it('fails if any gate fails', async () => {
    const pipeline = new ValidationPipeline();
    pipeline.addGate(new CodeValidationGate());
    pipeline.addGate(new ConfidenceGate(0.85));

    const result = await pipeline.validate({
      ...baseInput,
      content: 'SELECT * FROM users',
      metadata: { confidence: 0.50 },
    });

    expect(result.passed).toBe(false);
    expect(result.overallConfidence).toBeLessThan(0.85);
  });

  it('lists gate names', () => {
    const pipeline = new ValidationPipeline();
    pipeline.addGate(new CodeValidationGate());
    pipeline.addGate(new ConfidenceGate());
    expect(pipeline.getGateNames()).toEqual(['code-validation', 'confidence']);
  });
});
