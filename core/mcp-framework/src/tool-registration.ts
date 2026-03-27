/**
 * CLAW-002 / Tool-gate integration for MCP tool registration.
 *
 * Wraps tool registration to enforce license-tier gating at the framework level.
 * Community tier gets read-only tools; write tools return an upgrade prompt.
 * Pro tier gets read + write; admin tools return an upgrade prompt.
 * Enterprise tier gets everything.
 *
 * This module is consumed by DataWorkersMCPServer.registerTool() so that
 * ALL agents inherit gating automatically — no per-agent wiring needed.
 */

import { isToolAllowed, gateCheck } from '../../license/src/tool-gate.js';
import type { ToolDefinition, ToolHandler, ToolResult } from './types.js';

/**
 * Create a gated handler that enforces the license tier at call time.
 *
 * We always register the tool (so it appears in `tools/list` for discovery),
 * but if the tier doesn't allow it, the handler returns a structured error
 * with upgrade instructions instead of executing the real logic.
 */
export function createGatedHandler(
  definition: ToolDefinition,
  handler: ToolHandler,
): ToolHandler {
  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    if (isToolAllowed(definition.name)) {
      return handler(args);
    }

    const { reason } = gateCheck(definition.name);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: reason || 'This tool requires Claw Pro or Enterprise',
          tool: definition.name,
          tier: process.env.DW_LICENSE_TIER || 'community',
          upgrade: 'https://dataworkers.io/pricing',
        }),
      }],
      isError: true,
    };
  };
}

/**
 * Standalone helper: register a tool on any MCP server with gate enforcement.
 * Useful for agents that need explicit control over registration.
 */
export function registerToolWithGate(
  server: { registerTool(definition: ToolDefinition, handler: ToolHandler): void },
  definition: ToolDefinition,
  handler: ToolHandler,
): void {
  server.registerTool(definition, createGatedHandler(definition, handler));
}
