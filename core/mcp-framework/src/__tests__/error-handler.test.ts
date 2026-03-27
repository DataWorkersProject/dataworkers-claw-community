import { describe, it, expect, vi } from 'vitest';
import { ToolError, wrapToolHandler } from '../error-handler.js';
import type { ToolResult, ToolErrorPayload } from '../error-handler.js';

// Helper to parse the JSON error payload from a ToolResult
function parsePayload(result: ToolResult): ToolErrorPayload {
  return JSON.parse(result.content[0].text!);
}

describe('ToolError', () => {
  it('creates an error with code, toolName, and details', () => {
    const err = new ToolError('not found', 'NOT_FOUND', 'list-tables', { table: 'users' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ToolError');
    expect(err.message).toBe('not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.toolName).toBe('list-tables');
    expect(err.details).toEqual({ table: 'users' });
  });

  it('works without optional details', () => {
    const err = new ToolError('bad input', 'VALIDATION_ERROR', 'run-query');
    expect(err.details).toBeUndefined();
  });
});

describe('wrapToolHandler', () => {
  it('passes through a successful result unchanged', async () => {
    const expected: ToolResult = {
      content: [{ type: 'text', text: 'ok' }],
    };
    const handler = wrapToolHandler('test-tool', async () => expected);
    const result = await handler({ foo: 1 });
    expect(result).toEqual(expected);
  });

  it('converts a ToolError into a structured isError response', async () => {
    const handler = wrapToolHandler('catalog-search', async () => {
      throw new ToolError('Table not found', 'NOT_FOUND', 'catalog-search', { table: 'orders' });
    });

    const result = await handler({});
    expect(result.isError).toBe(true);

    const payload = parsePayload(result);
    expect(payload.error).toBe('Table not found');
    expect(payload.code).toBe('NOT_FOUND');
    expect(payload.tool).toBe('catalog-search');
    expect(payload.details).toEqual({ table: 'orders' });
    expect(payload.timestamp).toBeDefined();
  });

  it('converts an unexpected Error into INTERNAL_ERROR', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = wrapToolHandler('run-pipeline', async () => {
      throw new Error('connection refused');
    });

    const result = await handler({});
    expect(result.isError).toBe(true);

    const payload = parsePayload(result);
    expect(payload.error).toBe('Internal error');
    expect(payload.code).toBe('INTERNAL_ERROR');
    expect(payload.tool).toBe('run-pipeline');
    expect(payload.details).toBeUndefined();

    // Verify logging occurred
    expect(consoleSpy).toHaveBeenCalledWith(
      '[run-pipeline] Unexpected error:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('handles non-Error throws (strings, numbers) as INTERNAL_ERROR', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = wrapToolHandler('odd-tool', async () => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });

    const result = await handler({});
    expect(result.isError).toBe(true);

    const payload = parsePayload(result);
    expect(payload.code).toBe('INTERNAL_ERROR');

    consoleSpy.mockRestore();
  });

  it('forwards arguments to the inner handler', async () => {
    const spy = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'done' }] }));
    const handler = wrapToolHandler('my-tool', spy);
    await handler({ query: 'SELECT 1' });
    expect(spy).toHaveBeenCalledWith({ query: 'SELECT 1' });
  });
});
