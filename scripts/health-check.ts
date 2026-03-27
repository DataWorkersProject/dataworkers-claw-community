/**
 * Programmatic health checker for CI.
 *
 * Checks connectivity to PostgreSQL, Redis, Neo4j, and Kafka.
 * Can run standalone or be imported as a library.
 */

import * as net from 'node:net';
import * as http from 'node:http';

export interface ServiceHealth {
  service: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Check if a TCP port is reachable.
 */
async function checkTcp(host: string, port: number, timeoutMs: number): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start, error: `Timeout after ${timeoutMs}ms` });
    }, timeoutMs);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: true, latencyMs: Date.now() - start });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start, error: err.message });
    });
  });
}

/**
 * Check if an HTTP endpoint returns a 2xx response.
 */
async function checkHttp(url: string, timeoutMs: number): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, latencyMs: Date.now() - start, error: `Timeout after ${timeoutMs}ms` });
    }, timeoutMs);

    http.get(url, (res) => {
      clearTimeout(timer);
      res.resume(); // Drain response
      const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
      resolve({ ok, latencyMs: Date.now() - start, error: ok ? undefined : `HTTP ${res.statusCode}` });
    }).on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, latencyMs: Date.now() - start, error: err.message });
    });
  });
}

/**
 * Check all infrastructure services and return their health status.
 */
export async function checkServices(options?: {
  postgresHost?: string;
  postgresPort?: number;
  redisHost?: string;
  redisPort?: number;
  neo4jHost?: string;
  neo4jHttpPort?: number;
  kafkaHost?: string;
  kafkaPort?: number;
  timeoutMs?: number;
}): Promise<ServiceHealth[]> {
  const opts = {
    postgresHost: options?.postgresHost ?? 'localhost',
    postgresPort: options?.postgresPort ?? 5432,
    redisHost: options?.redisHost ?? 'localhost',
    redisPort: options?.redisPort ?? 6379,
    neo4jHost: options?.neo4jHost ?? 'localhost',
    neo4jHttpPort: options?.neo4jHttpPort ?? 7474,
    kafkaHost: options?.kafkaHost ?? 'localhost',
    kafkaPort: options?.kafkaPort ?? 9092,
    timeoutMs: options?.timeoutMs ?? 5000,
  };

  const checks = [
    { service: 'PostgreSQL', check: () => checkTcp(opts.postgresHost, opts.postgresPort, opts.timeoutMs) },
    { service: 'Redis', check: () => checkTcp(opts.redisHost, opts.redisPort, opts.timeoutMs) },
    { service: 'Neo4j', check: () => checkHttp(`http://${opts.neo4jHost}:${opts.neo4jHttpPort}`, opts.timeoutMs) },
    { service: 'Kafka', check: () => checkTcp(opts.kafkaHost, opts.kafkaPort, opts.timeoutMs) },
  ];

  const results: ServiceHealth[] = [];

  for (const { service, check } of checks) {
    const result = await check();
    results.push({
      service,
      healthy: result.ok,
      latencyMs: result.latencyMs,
      error: result.error,
    });
  }

  return results;
}

/**
 * CLI entry point: run health checks and exit with appropriate code.
 */
async function main(): Promise<void> {
  console.log('=========================================');
  console.log('  Data Workers Health Check');
  console.log('=========================================\n');

  const results = await checkServices();
  let allHealthy = true;

  for (const r of results) {
    const status = r.healthy ? '\x1b[32mhealthy\x1b[0m' : '\x1b[31munhealthy\x1b[0m';
    const detail = r.error ? ` (${r.error})` : '';
    console.log(`  ${r.service.padEnd(12)} ${status} ${r.latencyMs}ms${detail}`);
    if (!r.healthy) allHealthy = false;
  }

  console.log(`\n${allHealthy ? 'All services healthy.' : 'Some services unhealthy.'}`);
  process.exit(allHealthy ? 0 : 1);
}

// Run CLI when executed directly
const isDirectRun = process.argv[1]?.endsWith('health-check.ts') || process.argv[1]?.endsWith('health-check.js');
if (isDirectRun) {
  main().catch((err) => {
    console.error('Health check failed:', err);
    process.exit(1);
  });
}
