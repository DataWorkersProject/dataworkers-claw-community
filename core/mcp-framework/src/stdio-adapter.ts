/**
 * Stdio transport adapter for Data Workers MCP servers.
 *
 * Enables any agent to run as a standalone MCP server over stdin/stdout,
 * compatible with OpenCode, Claude Code, and other MCP clients.
 */

import { createInterface } from 'node:readline';
import type { DataWorkersMCPServer } from './server.js';

/**
 * Start reading newline-delimited JSON-RPC from stdin,
 * pass each message to the server, and write responses to stdout.
 */
export function startStdioTransport(server: DataWorkersMCPServer): void {
  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on('line', async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      // Notifications (e.g. notifications/initialized) have no id — don't respond
      const parsed = JSON.parse(trimmed);
      if (!parsed.id && parsed.id !== 0) return;

      const response = await server.handleMessage(trimmed);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      process.stderr.write(
        `[dw-stdio] Error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      // Write JSON-RPC error so the client doesn't hang
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: null,
        error: { code: -32700, message: 'Parse error' },
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  });

  const shutdown = () => {
    rl.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  process.stderr.write(
    `[dw-stdio] ${server.config.name} v${server.config.version} ready (pid=${process.pid})\n`,
  );
}

/**
 * Convenience: capture capabilities then start stdio transport.
 */
export function startStdioServer(server: DataWorkersMCPServer): void {
  server.captureCapabilities();
  startStdioTransport(server);
}
