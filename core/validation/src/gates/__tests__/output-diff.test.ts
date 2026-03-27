import { describe, it, expect } from 'vitest';
import { OutputDiffGenerator } from '../output-diff.js';

describe('OutputDiffGenerator', () => {
  it('exports OutputDiffGenerator class', () => {
    expect(OutputDiffGenerator).toBeDefined();
  });

  it('generates create diff when before is null', () => {
    const gen = new OutputDiffGenerator();
    const diff = gen.generateDiff('users_table', null, { name: 'users', columns: 5 });
    expect(diff.operation).toBe('create');
    expect(diff.resource).toBe('users_table');
    expect(diff.before).toBeNull();
    expect(diff.after).toBeTruthy();
  });

  it('generates delete diff when after is null', () => {
    const gen = new OutputDiffGenerator();
    const diff = gen.generateDiff('old_table', { name: 'old' }, null);
    expect(diff.operation).toBe('delete');
    expect(diff.before).toBeTruthy();
    expect(diff.after).toBeNull();
  });

  it('generates modify diff when both exist', () => {
    const gen = new OutputDiffGenerator();
    const diff = gen.generateDiff('users', { columns: 3 }, { columns: 5 });
    expect(diff.operation).toBe('modify');
    expect(diff.changedFields.length).toBeGreaterThanOrEqual(0);
  });

  it('formats diff as human-readable string', () => {
    const gen = new OutputDiffGenerator();
    const diff = gen.generateDiff('test', null, { x: 1 });
    const formatted = gen.formatDiff(diff);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('test');
  });
});
