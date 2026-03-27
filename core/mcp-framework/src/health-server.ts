/**
 * Lightweight HTTP health/metrics server for Data Workers MCP agents.
 *
 * MCP agents communicate over stdio, but container orchestrators (Docker,
 * Kubernetes) need HTTP endpoints for liveness/readiness probes.
 * This module provides an opt-in HTTP server that exposes:
 *
 *   GET /health  — JSON health status (200 if healthy, 503 otherwise)
 *   GET /metrics — Prometheus-compatible text metrics
 *
 * Usage:
 *   import { HealthChecker } from './health-check.js';
 *   import { startHealthServer } from './health-server.js';
 *
 *   const checker = new HealthChecker('dw-pipelines', 12);
 *   const server = startHealthServer(checker, 3000);
 *
 * The returned `http.Server` can be closed via `server.close()`.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { HealthChecker } from './health-check.js';

export interface HealthServerOptions {
  /** Port to listen on. Defaults to 3000; overridden by DW_HEALTH_PORT env var. */
  port?: number;
  /** Bind address. Defaults to '0.0.0.0'. */
  host?: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

/**
 * Start an HTTP server that exposes /health and /metrics endpoints.
 *
 * @returns The underlying `http.Server` instance so callers can `.close()` it.
 */
export function startHealthServer(
  checker: HealthChecker,
  options: HealthServerOptions = {},
): Server {
  const port = options.port ?? (Number(process.env.DW_HEALTH_PORT) || DEFAULT_PORT);
  const host = options.host ?? DEFAULT_HOST;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Strip query string for route matching
    const path = (req.url ?? '/').split('?')[0];

    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    try {
      if (path === '/health') {
        const status = await checker.getHealthStatus();
        const httpCode = status.status === 'healthy' ? 200 : 503;
        res.writeHead(httpCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      } else if (path === '/metrics') {
        const status = await checker.getHealthStatus();
        const healthValue = status.status === 'healthy' ? 1 : status.status === 'degraded' ? 0.5 : 0;
        const uptimeSeconds = Math.floor(status.uptime / 1000);

        const lines = [
          '# HELP agent_health Agent health status (1=healthy, 0.5=degraded, 0=unhealthy)',
          '# TYPE agent_health gauge',
          `agent_health{agent="${status.agent}"} ${healthValue}`,
          '',
          '# HELP agent_tools_total Number of registered tools',
          '# TYPE agent_tools_total gauge',
          `agent_tools_total{agent="${status.agent}"} ${status.tools}`,
          '',
          '# HELP agent_uptime_seconds Agent uptime in seconds',
          '# TYPE agent_uptime_seconds gauge',
          `agent_uptime_seconds{agent="${status.agent}"} ${uptimeSeconds}`,
          '',
          '# HELP agent_checks_total Number of registered health checks',
          '# TYPE agent_checks_total gauge',
          `agent_checks_total{agent="${status.agent}"} ${status.checks.length}`,
        ];

        // Per-check metrics
        for (const check of status.checks) {
          const checkValue = check.status === 'ok' ? 1 : check.status === 'warn' ? 0.5 : 0;
          lines.push(`agent_check_status{agent="${status.agent}",check="${check.name}"} ${checkValue}`);
        }

        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
        res.end(lines.join('\n') + '\n');
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });

  server.listen(port, host, () => {
    console.log(`Health server listening on ${host}:${port}`);
  });

  return server;
}
