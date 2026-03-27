import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from './types.js';

/**
 * JSON-RPC 2.0 transport layer for MCP servers.
 * Handles message framing, parsing, and response construction.
 */

// JSON-RPC 2.0 error codes
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * Parse a raw JSON string into a JSON-RPC request.
 */
export function parseRequest(raw: string): JsonRpcRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new JsonRpcParseError('Invalid JSON');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('jsonrpc' in parsed) ||
    (parsed as JsonRpcRequest).jsonrpc !== '2.0'
  ) {
    throw new JsonRpcParseError('Not a valid JSON-RPC 2.0 message');
  }

  const msg = parsed as JsonRpcRequest;
  if (typeof msg.method !== 'string') {
    throw new JsonRpcParseError('Missing or invalid method');
  }

  return msg;
}

/**
 * Build a successful JSON-RPC response.
 */
export function buildResponse(
  id: string | number | null,
  result: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

/**
 * Build an error JSON-RPC response.
 */
export function buildErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

/**
 * Build a JSON-RPC notification (no id, no response expected).
 */
export function buildNotification(
  method: string,
  params?: Record<string, unknown>,
): JsonRpcNotification {
  return { jsonrpc: '2.0', method, params };
}

/**
 * Check if a message is a notification (no id field).
 */
export function isNotification(
  msg: JsonRpcRequest | JsonRpcNotification,
): msg is JsonRpcNotification {
  return !('id' in msg) || msg.id === undefined;
}

export class JsonRpcParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonRpcParseError';
  }
}
