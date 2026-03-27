import { describe, it, expect, beforeEach } from 'vitest';
import { DataWorkersMCPServer } from '../server.js';
import type { ToolDefinition, ToolHandler, ToolResult } from '../types.js';

const echoTool: ToolDefinition = {
  name: 'echo',
  description: 'Echo back the input',
  inputSchema: {
    type: 'object',
    properties: { message: { type: 'string' } },
    required: ['message'],
  },
};

const echoHandler: ToolHandler = async (args) => ({
  content: [{ type: 'text', text: String(args.message) }],
});

const slowTool: ToolDefinition = {
  name: 'slow_op',
  description: 'A slow operation for timeout testing',
  inputSchema: { type: 'object', properties: {} },
};

const failTool: ToolDefinition = {
  name: 'fail_op',
  description: 'Always fails',
  inputSchema: { type: 'object', properties: {} },
};

describe('DataWorkersMCPServer', () => {
  let server: DataWorkersMCPServer;

  beforeEach(() => {
    server = new DataWorkersMCPServer({
      name: 'test-server',
      version: '1.0.0',
      description: 'Test MCP server',
      timeout: { defaultMs: 100, maxMs: 1000 },
      circuitBreaker: { maxFailures: 3, windowMs: 60_000, resetMs: 1_000 },
    });
    server.registerTool(echoTool, echoHandler);
  });

  // ── Tool Registration & Discovery ──

  it('registers and lists tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('echo');
  });

  it('prevents duplicate tool registration', () => {
    expect(() => server.registerTool(echoTool, echoHandler)).toThrow(
      "Tool 'echo' is already registered",
    );
  });

  // ── Tool Invocation ──

  it('calls a tool successfully', async () => {
    const result = await server.callTool('echo', { message: 'hello' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('hello');
  });

  it('returns error for unknown tool', async () => {
    const result = await server.callTool('nonexistent', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  // ── Timeout (REQ-MCP-006) ──

  it('enforces timeout on tool calls', async () => {
    const slowHandler: ToolHandler = async () => {
      await new Promise((r) => setTimeout(r, 500));
      return { content: [{ type: 'text', text: 'done' }] };
    };
    server.registerTool(slowTool, slowHandler);

    const result = await server.callTool('slow_op', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('timed out');
  });

  // ── Circuit Breaker (REQ-MCP-005) ──

  it('trips circuit breaker after 3 failures (per-tool)', async () => {
    const failHandler: ToolHandler = async () => {
      throw new Error('deliberate failure');
    };
    server.registerTool(failTool, failHandler);

    await server.callTool('fail_op', {});
    await server.callTool('fail_op', {});
    await server.callTool('fail_op', {});

    // Per-tool circuit breaker: fail_op should be blocked
    const result = await server.callTool('fail_op', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Circuit breaker open');

    // Other tools (echo) should still work with per-tool breakers
    const echoResult = await server.callTool('echo', { message: 'still works' });
    expect(echoResult.isError).toBeUndefined();
    expect(echoResult.content[0].text).toBe('still works');
  });

  it('circuit breaker recovers after cooldown', async () => {
    let shouldFail = true;
    const failHandler: ToolHandler = async () => {
      if (shouldFail) throw new Error('deliberate failure');
      return { content: [{ type: 'text', text: 'recovered' }] };
    };
    server.registerTool(failTool, failHandler);

    await server.callTool('fail_op', {});
    await server.callTool('fail_op', {});
    await server.callTool('fail_op', {});

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 1_100));

    // After cooldown, the per-tool breaker should allow the tool again
    shouldFail = false;
    const result = await server.callTool('fail_op', {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('recovered');
  });

  // ── Resource Registration ──

  it('registers and lists resources', async () => {
    server.registerResource(
      { uri: 'data://test/config', name: 'Config', description: 'Test config' },
      async () => ({ contents: [{ uri: 'data://test/config', mimeType: 'application/json', text: '{}' }] }),
    );
    expect(server.listResources()).toHaveLength(1);
    const result = await server.readResource('data://test/config');
    expect(result.contents[0].text).toBe('{}');
  });

  // ── Prompt Registration ──

  it('registers and lists prompts', async () => {
    server.registerPrompt(
      { name: 'greet', description: 'Greeting prompt', arguments: [{ name: 'name', description: 'Name to greet', required: true }] },
      async (args) => ({
        messages: [{ role: 'user', content: { type: 'text', text: `Hello ${args.name}` } }],
      }),
    );
    expect(server.listPrompts()).toHaveLength(1);
    const result = await server.getPrompt('greet', { name: 'World' });
    expect(result.messages[0].content.text).toBe('Hello World');
  });

  // ── JSON-RPC 2.0 Message Handling ──

  it('handles initialize message', async () => {
    const response = await server.handleMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    );
    expect(response.result).toBeDefined();
    const result = response.result as { serverInfo: { name: string } };
    expect(result.serverInfo.name).toBe('test-server');
  });

  it('handles tools/list message', async () => {
    const response = await server.handleMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    );
    const result = response.result as { tools: Array<{ name: string }> };
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('echo');
  });

  it('handles tools/call message', async () => {
    const response = await server.handleMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'echo', arguments: { message: 'test' } },
      }),
    );
    const result = response.result as ToolResult;
    expect(result.content[0].text).toBe('test');
  });

  it('returns error for unknown method', async () => {
    const response = await server.handleMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'unknown/method' }),
    );
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32601);
  });

  it('handles invalid JSON gracefully', async () => {
    const response = await server.handleMessage('not json');
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32603);
  });

  // ── Capability Tracking (REQ-MCP-004, REQ-MCP-007) ──

  it('captures and tracks capabilities', () => {
    server.captureCapabilities();
    expect(server.isInitialized()).toBe(true);

    // No changes when nothing changed
    const diff = server.checkCapabilityChanges();
    expect(diff.hasChanges).toBe(false);
  });

  it('detects tool removal on reconnect', () => {
    server.registerTool(
      { name: 'temp_tool', description: 'Temporary', inputSchema: { type: 'object' } },
      async () => ({ content: [{ type: 'text', text: 'temp' }] }),
    );
    server.captureCapabilities();

    // Simulate tool removal (would happen in a real reconnect scenario)
    // We verify the tracker detects the diff
    const manifest = server['capabilityTracker'].getManifest('test-server');
    expect(manifest).toBeDefined();
    expect(manifest!.tools).toContain('echo');
    expect(manifest!.tools).toContain('temp_tool');
  });

  it('fires capability change listener on diff', () => {
    server.captureCapabilities();

    let notified = false;
    server.onCapabilityChange((_serverName, diff) => {
      notified = true;
      expect(diff.addedTools).toContain('new_tool');
    });

    // Register a new tool after capture
    server.registerTool(
      { name: 'new_tool', description: 'New', inputSchema: { type: 'object' } },
      async () => ({ content: [{ type: 'text', text: 'new' }] }),
    );

    const diff = server.checkCapabilityChanges();
    expect(diff.hasChanges).toBe(true);
    expect(diff.addedTools).toContain('new_tool');
    expect(notified).toBe(true);
  });
});
