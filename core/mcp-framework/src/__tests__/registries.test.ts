import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../tool-registry.js';
import { ResourceRegistry } from '../resource-registry.js';
import { PromptRegistry } from '../prompt-registry.js';

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const reg = new ToolRegistry();
    const def = { name: 'test', description: 'Test tool', inputSchema: { type: 'object' } };
    const handler = async () => ({ content: [{ type: 'text' as const, text: 'ok' }] });
    reg.register(def, handler);

    expect(reg.has('test')).toBe(true);
    expect(reg.size()).toBe(1);
    expect(reg.list()).toHaveLength(1);
    expect(reg.listNames()).toEqual(['test']);
  });

  it('prevents duplicate registration', () => {
    const reg = new ToolRegistry();
    const def = { name: 'dup', description: 'Dup', inputSchema: {} };
    const handler = async () => ({ content: [{ type: 'text' as const, text: 'ok' }] });
    reg.register(def, handler);
    expect(() => reg.register(def, handler)).toThrow();
  });

  it('unregisters tools', () => {
    const reg = new ToolRegistry();
    const def = { name: 'rm', description: 'Remove me', inputSchema: {} };
    reg.register(def, async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }));
    expect(reg.unregister('rm')).toBe(true);
    expect(reg.has('rm')).toBe(false);
  });

  it('clears all tools', () => {
    const reg = new ToolRegistry();
    reg.register({ name: 'a', description: '', inputSchema: {} }, async () => ({ content: [] }));
    reg.register({ name: 'b', description: '', inputSchema: {} }, async () => ({ content: [] }));
    reg.clear();
    expect(reg.size()).toBe(0);
  });
});

describe('ResourceRegistry', () => {
  it('registers and retrieves resources', () => {
    const reg = new ResourceRegistry();
    reg.register(
      { uri: 'data://test', name: 'Test', description: 'Test resource' },
      async () => ({ contents: [{ uri: 'data://test', mimeType: 'text/plain', text: 'hello' }] }),
    );
    expect(reg.has('data://test')).toBe(true);
    expect(reg.size()).toBe(1);
    expect(reg.listUris()).toEqual(['data://test']);
  });

  it('prevents duplicate URIs', () => {
    const reg = new ResourceRegistry();
    const def = { uri: 'data://dup', name: 'Dup', description: 'Dup resource' };
    const handler = async () => ({ contents: [{ uri: 'data://dup', mimeType: 'text/plain' }] });
    reg.register(def, handler);
    expect(() => reg.register(def, handler)).toThrow();
  });
});

describe('PromptRegistry', () => {
  it('registers and retrieves prompts', () => {
    const reg = new PromptRegistry();
    reg.register(
      { name: 'greet', description: 'Greeting' },
      async () => ({ messages: [{ role: 'user', content: { type: 'text', text: 'hi' } }] }),
    );
    expect(reg.has('greet')).toBe(true);
    expect(reg.size()).toBe(1);
    expect(reg.listNames()).toEqual(['greet']);
  });

  it('prevents duplicate prompts', () => {
    const reg = new PromptRegistry();
    const def = { name: 'dup', description: 'Dup' };
    const handler = async () => ({ messages: [] as PromptRegistry extends never ? never : Array<{role: 'user' | 'assistant'; content: {type: 'text'; text: string}}> });
    reg.register(def, handler);
    expect(() => reg.register(def, handler)).toThrow();
  });
});
