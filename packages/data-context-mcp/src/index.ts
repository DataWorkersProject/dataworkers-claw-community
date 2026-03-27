/**
 * data-context-mcp — Standalone MCP server entry point.
 *
 * Run via: npx data-context-mcp
 *
 * Starts a JSON-RPC 2.0 MCP server on stdio transport.
 * Reads JSON-RPC requests from stdin, writes responses to stdout.
 */

import { createServer } from './server.js';
import { startStdioTransport } from '@data-workers/mcp-framework';

const server = createServer();
startStdioTransport(server);
