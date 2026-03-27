/**
 * Core type definitions for the MCP framework.
 * Covers Tools, Resources, Prompts per MCP spec (REQ-MCP-003).
 */

// ── Server Configuration ──

export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  protocolVersion?: string;
  circuitBreaker?: CircuitBreakerConfig;
  timeout?: TimeoutConfig;
}

export interface CircuitBreakerConfig {
  /** Max failures before circuit opens. Default: 3 (REQ-MCP-005) */
  maxFailures: number;
  /** Time window for failure counting in ms. Default: 60000 */
  windowMs: number;
  /** Cooldown before circuit resets in ms. Default: 30000 */
  resetMs: number;
}

export interface TimeoutConfig {
  /** Default timeout per tool call in ms. Default: 30000 (REQ-MCP-006) */
  defaultMs: number;
  /** Max timeout for async polling operations. Default: 600000 (10min) */
  maxMs: number;
}

// ── Tools (executable actions) ──

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<ToolResult>;

export interface ToolResult {
  content: ContentBlock[];
  isError?: boolean;
}

export interface ContentBlock {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

// ── Resources (read-only data) ──

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export type ResourceHandler = (
  uri: string,
) => Promise<ResourceResult>;

export interface ResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
  }>;
}

// ── Prompts (contextual templates) ──

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export type PromptHandler = (
  args: Record<string, string>,
) => Promise<PromptResult>;

export interface PromptResult {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: { type: 'text'; text: string };
  }>;
}

// ── JSON-RPC 2.0 ──

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ── Capability Manifest (REQ-MCP-004, REQ-MCP-007) ──

export interface CapabilityManifest {
  serverName: string;
  serverVersion: string;
  protocolVersion: string;
  tools: string[];
  resources: string[];
  prompts: string[];
  capturedAt: number;
}

export interface CapabilityDiff {
  addedTools: string[];
  removedTools: string[];
  addedResources: string[];
  removedResources: string[];
  addedPrompts: string[];
  removedPrompts: string[];
  hasChanges: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonSchema = Record<string, any>;
