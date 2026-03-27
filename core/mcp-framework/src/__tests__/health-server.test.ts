import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startHealthServer } from '../health-server.js';
import { HealthChecker } from '../health-check.js';
import type { Server } from 'node:http';

/** Helper: make a GET request to the health server. */
async function get(port: number, path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = await res.text();
  return { status: res.status, body };
}

describe('startHealthServer', () => {
  let checker: HealthChecker;
  let server: Server;
  // Use a high port to avoid conflicts in CI
  const port = 19876;

  beforeEach(() => {
    checker = new HealthChecker('test-agent', 10);
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // ── /health ──

  it('GET /health returns 200 when healthy', async () => {
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const { status, body } = await get(port, '/health');
    expect(status).toBe(200);

    const json = JSON.parse(body);
    expect(json.agent).toBe('test-agent');
    expect(json.status).toBe('healthy');
    expect(json.tools).toBe(10);
    expect(json.uptime).toBeGreaterThanOrEqual(0);
    expect(json.checks).toEqual([]);
    expect(json.timestamp).toBeDefined();
  });

  it('GET /health returns 503 when unhealthy', async () => {
    checker.register('db', () => ({ name: 'db', status: 'fail', message: 'down' }));
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const { status, body } = await get(port, '/health');
    expect(status).toBe(503);

    const json = JSON.parse(body);
    expect(json.status).toBe('unhealthy');
    expect(json.checks[0].status).toBe('fail');
  });

  it('GET /health returns 503 when degraded', async () => {
    checker.register('cache', () => ({ name: 'cache', status: 'warn', message: 'slow' }));
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const { status, body } = await get(port, '/health');
    expect(status).toBe(503);

    const json = JSON.parse(body);
    expect(json.status).toBe('degraded');
  });

  // ── /metrics ──

  it('GET /metrics returns Prometheus-formatted text', async () => {
    checker.register('db', () => ({ name: 'db', status: 'ok' }));
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const { status, body } = await get(port, '/metrics');
    expect(status).toBe(200);

    expect(body).toContain('# HELP agent_health');
    expect(body).toContain('# TYPE agent_health gauge');
    expect(body).toContain('agent_health{agent="test-agent"} 1');
    expect(body).toContain('agent_tools_total{agent="test-agent"} 10');
    expect(body).toContain('agent_uptime_seconds{agent="test-agent"}');
    expect(body).toContain('agent_checks_total{agent="test-agent"} 1');
    expect(body).toContain('agent_check_status{agent="test-agent",check="db"} 1');
  });

  it('GET /metrics reports 0.5 for degraded status', async () => {
    checker.register('cache', () => ({ name: 'cache', status: 'warn' }));
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const { status, body } = await get(port, '/metrics');
    expect(status).toBe(200);
    expect(body).toContain('agent_health{agent="test-agent"} 0.5');
    expect(body).toContain('agent_check_status{agent="test-agent",check="cache"} 0.5');
  });

  it('GET /metrics reports 0 for unhealthy status', async () => {
    checker.register('db', () => ({ name: 'db', status: 'fail' }));
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const { status, body } = await get(port, '/metrics');
    expect(status).toBe(200);
    expect(body).toContain('agent_health{agent="test-agent"} 0');
  });

  // ── Error handling ──

  it('returns 404 for unknown paths', async () => {
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const { status, body } = await get(port, '/unknown');
    expect(status).toBe(404);
    expect(JSON.parse(body).error).toBe('Not Found');
  });

  it('returns 405 for non-GET methods', async () => {
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const res = await fetch(`http://127.0.0.1:${port}/health`, { method: 'POST' });
    expect(res.status).toBe(405);
  });

  it('ignores query strings when routing', async () => {
    server = startHealthServer(checker, { port, host: '127.0.0.1' });
    await new Promise((r) => server.once('listening', r));

    const { status } = await get(port, '/health?verbose=true');
    expect(status).toBe(200);
  });
});
