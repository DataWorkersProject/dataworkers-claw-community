/**
 * @data-workers/mcp-framework
 *
 * Base MCP server class and protocol utilities for Data Workers agents.
 * Each agent extends DataWorkersMCPServer to register domain-specific
 * tools, resources, and prompts.
 *
 * REQ coverage: REQ-MCP-002 through REQ-MCP-007, REQ-ARCH-002
 */

export { DataWorkersMCPServer } from './server.js';
export { ToolRegistry } from './tool-registry.js';
export { ResourceRegistry } from './resource-registry.js';
export { PromptRegistry } from './prompt-registry.js';
export { CircuitBreaker } from './circuit-breaker.js';
export type { CircuitBreakerState } from './circuit-breaker.js';
export { CapabilityTracker } from './capability-tracker.js';
export {
  parseRequest,
  buildResponse,
  buildErrorResponse,
  buildNotification,
  isNotification,
  JsonRpcParseError,
  JSON_RPC_ERRORS,
} from './transport.js';
export { ToolError, wrapToolHandler } from './error-handler.js';
export {
  DataWorkersError,
  ClientToolCallError,
  InvalidParameterError,
  AssetNotFoundError,
  ServerToolCallError,
  ConnectorUnavailableError,
  TimeoutError,
} from './errors.js';
export { createGatedHandler, registerToolWithGate } from './tool-registration.js';
export type { ToolErrorCode, ToolErrorPayload } from './error-handler.js';
export { startStdioTransport, startStdioServer } from './stdio-adapter.js';
export { HealthChecker } from './health-check.js';
export type { HealthStatus, HealthCheck, HealthCheckFn, CheckStatus, OverallStatus } from './health-check.js';
export { startHealthServer } from './health-server.js';
export type { HealthServerOptions } from './health-server.js';

export type {
  MCPServerConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  ToolDefinition,
  ToolHandler,
  ToolResult,
  ContentBlock,
  ResourceDefinition,
  ResourceHandler,
  ResourceResult,
  PromptDefinition,
  PromptArgument,
  PromptHandler,
  PromptResult,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,
  CapabilityManifest,
  CapabilityDiff,
  JsonSchema,
} from './types.js';
