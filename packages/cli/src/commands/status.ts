/**
 * status command - Check which agents are currently running.
 */

import * as net from 'node:net';
import { AGENTS } from './init.js';

interface AgentStatus {
  name: string;
  port: number;
  running: boolean;
  latencyMs: number;
}

/**
 * Check if a port is open (agent is running).
 */
async function checkPort(host: string, port: number, timeoutMs: number): Promise<{ open: boolean; latencyMs: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ open: false, latencyMs: Date.now() - start });
    }, timeoutMs);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ open: true, latencyMs: Date.now() - start });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ open: false, latencyMs: Date.now() - start });
    });
  });
}

export async function statusCommand(args: string[]): Promise<void> {
  const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : 'localhost';
  const timeout = args.includes('--timeout') ? parseInt(args[args.indexOf('--timeout') + 1], 10) : 2000;

  console.log('\nData Workers Agent Status\n');
  console.log(`Checking ${AGENTS.length} agents on ${host}...\n`);

  const statuses: AgentStatus[] = [];

  for (const agent of AGENTS) {
    const result = await checkPort(host, agent.port, timeout);
    statuses.push({
      name: agent.name,
      port: agent.port,
      running: result.open,
      latencyMs: result.latencyMs,
    });
  }

  for (const status of statuses) {
    const icon = status.running ? '\x1b[32mrunning\x1b[0m' : '\x1b[31mstopped\x1b[0m';
    const latency = status.running ? ` (${status.latencyMs}ms)` : '';
    console.log(`  ${status.name.padEnd(24)} :${status.port}  ${icon}${latency}`);
  }

  const running = statuses.filter((s) => s.running).length;
  const stopped = statuses.filter((s) => !s.running).length;

  console.log(`\n  Running: ${running}  Stopped: ${stopped}  Total: ${statuses.length}`);
}
