import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { DataWorkersMCPServer } from '../server.js';
import { startHttpServer } from '../http-adapter.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

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

// Fresh port per test — the server restarts per test, and undici's keep-alive
// pool would otherwise reuse a dead socket from the previous server and
// ECONNRESET on the next request.
let PORT = 19881;
let BASE = `http://127.0.0.1:${PORT}`;

async function post(body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
}

describe('startHttpServer (Streamable HTTP adapter)', () => {
  let mcp: DataWorkersMCPServer;
  let httpServer: Server;

  beforeEach(async () => {
    PORT += 1;
    BASE = `http://127.0.0.1:${PORT}`;
    mcp = new DataWorkersMCPServer({
      name: 'test-http-server',
      version: '1.0.0',
      description: 'Test MCP server over HTTP',
    });
    mcp.registerTool(echoTool, echoHandler);
    httpServer = startHttpServer(mcp, { port: PORT });
    await new Promise<void>((resolve) => httpServer.on('listening', () => resolve()));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('answers initialize and issues an Mcp-Session-Id', async () => {
    const res = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } },
    });
    expect(res.status).toBe(200);
    expect(res.json.result.serverInfo.name).toBe('test-http-server');
    expect(res.headers.get('mcp-session-id')).toBeTruthy();
  });

  it('lists and calls tools over POST', async () => {
    const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(list.status).toBe(200);
    expect(list.json.result.tools.map((t: { name: string }) => t.name)).toContain('echo');

    const call = await post({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'echo', arguments: { message: 'hello-http' } },
    });
    expect(call.status).toBe(200);
    expect(call.json.result.content[0].text).toBe('hello-http');
  });

  it('returns 202 for notifications', async () => {
    const res = await fetch(`${BASE}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    expect(res.status).toBe(202);
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await post('{not json');
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe(-32700);
  });

  it('returns 405 for GET on the MCP endpoint (no push stream)', async () => {
    const res = await fetch(`${BASE}/mcp`);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('POST');
  });

  it('returns 404 off-endpoint and 200 on /healthz', async () => {
    expect((await fetch(`${BASE}/other`)).status).toBe(404);
    const health = await fetch(`${BASE}/healthz`);
    expect(health.status).toBe(200);
    expect((await health.json()).name).toBe('test-http-server');
  });

  it('accepts DELETE to end a session', async () => {
    const init = await post({
      jsonrpc: '2.0', id: 4, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } },
    });
    const sid = init.headers.get('mcp-session-id')!;
    const res = await fetch(`${BASE}/mcp`, { method: 'DELETE', headers: { 'mcp-session-id': sid, connection: 'close' } });
    expect(res.status).toBe(200);
  });
});
