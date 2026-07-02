/**
 * Streamable HTTP transport adapter for Data Workers MCP servers.
 *
 * Implements the request/response subset of the MCP Streamable HTTP
 * transport: a single endpoint accepting POSTed JSON-RPC messages, with
 * Mcp-Session-Id issued on initialize. This is what ChatGPT (Apps SDK /
 * Developer Mode full MCP connectors), Grok Connectors (bring-your-own-MCP),
 * and any remote MCP client speak.
 *
 * Server-push notifications (GET + SSE) are not implemented — every tool in
 * the Community Edition swarm is request/response, so clients receive
 * complete answers on the POST. GET returns 405 per the spec for servers
 * that do not offer a push stream.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { DataWorkersMCPServer } from './server.js';

export interface HttpTransportOptions {
  /** Port to listen on. Default 8808. */
  port?: number;
  /** Host to bind. Default 127.0.0.1 — local by default; bind 0.0.0.0 explicitly to expose. */
  host?: string;
  /** MCP endpoint path. Default "/mcp". */
  endpoint?: string;
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
}

function readBody(req: IncomingMessage, limitBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Start the MCP server on a Streamable HTTP endpoint.
 * Returns the node http.Server (already listening).
 */
export function startHttpTransport(
  server: DataWorkersMCPServer,
  options: HttpTransportOptions = {},
): Server {
  const port = options.port ?? 8808;
  const host = options.host ?? '127.0.0.1';
  const endpoint = options.endpoint ?? '/mcp';
  const sessions = new Set<string>();

  const httpServer = createServer(async (req, res) => {
    const url = (req.url ?? '/').split('?')[0];

    if (url === '/healthz') {
      sendJson(res, 200, { ok: true, name: server.config.name, version: server.config.version });
      return;
    }

    if (url !== endpoint) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    if (req.method === 'DELETE') {
      const sid = req.headers['mcp-session-id'];
      if (typeof sid === 'string') sessions.delete(sid);
      res.writeHead(200).end();
      return;
    }

    if (req.method !== 'POST') {
      // No server-push stream: GET (and anything else) is 405 per spec.
      res.writeHead(405, { allow: 'POST, DELETE' }).end();
      return;
    }

    let raw: string;
    try {
      raw = await readBody(req, MAX_BODY_BYTES);
    } catch {
      sendJson(res, 413, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Payload too large' } });
      return;
    }

    let parsed: JsonRpcMessage | JsonRpcMessage[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }

    const messages = Array.isArray(parsed) ? parsed : [parsed];
    const isInitialize = messages.some((m) => m.method === 'initialize');
    const responseHeaders: Record<string, string> = {};
    if (isInitialize) {
      const sid = randomUUID();
      sessions.add(sid);
      responseHeaders['mcp-session-id'] = sid;
    }

    // Notifications (no id) get no JSON-RPC response — 202 Accepted.
    const requests = messages.filter((m) => m.id !== undefined && m.id !== null);
    if (requests.length === 0) {
      res.writeHead(202, responseHeaders).end();
      return;
    }

    try {
      const responses = await Promise.all(
        requests.map((m) => server.handleMessage(JSON.stringify(m))),
      );
      sendJson(res, 200, Array.isArray(parsed) ? responses : responses[0], responseHeaders);
    } catch (err) {
      sendJson(res, 500, {
        jsonrpc: '2.0',
        id: requests[0]?.id ?? null,
        error: { code: -32603, message: err instanceof Error ? err.message : 'Internal error' },
      });
    }
  });

  httpServer.listen(port, host, () => {
    process.stderr.write(
      `[dw-http] ${server.config.name} v${server.config.version} listening on http://${host}:${port}${endpoint}\n`,
    );
  });

  return httpServer;
}

/**
 * Convenience: capture capabilities then start the HTTP transport.
 */
export function startHttpServer(server: DataWorkersMCPServer, options: HttpTransportOptions = {}): Server {
  server.captureCapabilities();
  return startHttpTransport(server, options);
}
