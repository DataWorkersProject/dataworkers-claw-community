/**
 * Production-grade error handling utilities for MCP tools.
 *
 * Provides a consistent error response format across all Data Workers agents.
 * Agents opt in by wrapping tool handlers with `wrapToolHandler`.
 *
 * Error codes follow a fixed vocabulary so consumers can programmatically
 * react to failures without parsing free-text messages.
 */

import type { ToolResult } from './types.js';

// ── Error Codes ──

export type ToolErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'DEPENDENCY_ERROR'
  | 'INTERNAL_ERROR';

// ── ToolError ──

/**
 * Structured error that tool handlers can throw to communicate a specific
 * error code and optional machine-readable details back to the caller.
 *
 * When caught by `wrapToolHandler`, it is serialised into a standard
 * `{ isError: true, content: [...] }` ToolResult.
 */
export class ToolError extends Error {
  constructor(
    message: string,
    public code: ToolErrorCode,
    public toolName: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

// ── Structured error response shape ──

export interface ToolErrorPayload {
  error: string;
  code: ToolErrorCode;
  tool: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ── Handler wrapper ──

/**
 * Wrap a tool handler so that *any* thrown error is converted into a
 * structured `ToolResult` with `isError: true`.
 *
 * - `ToolError` instances preserve their code and details.
 * - All other errors are logged and returned as `INTERNAL_ERROR`.
 *
 * Usage:
 * ```ts
 * server.registerTool(definition, wrapToolHandler('my-tool', async (args) => {
 *   // ... implementation
 * }));
 * ```
 */
export function wrapToolHandler(
  toolName: string,
  handler: (args: Record<string, unknown>) => Promise<ToolResult>,
): (args: Record<string, unknown>) => Promise<ToolResult> {
  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      return await handler(args);
    } catch (error: unknown) {
      if (error instanceof ToolError) {
        const payload: ToolErrorPayload = {
          error: error.message,
          code: error.code,
          tool: error.toolName,
          details: error.details,
          timestamp: new Date().toISOString(),
        };
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify(payload) }],
        };
      }

      // Unexpected error — log for observability and return a safe generic message.
      console.error(`[${toolName}] Unexpected error:`, error);

      const payload: ToolErrorPayload = {
        error: 'Internal error',
        code: 'INTERNAL_ERROR',
        tool: toolName,
        timestamp: new Date().toISOString(),
      };
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      };
    }
  };
}
