import { ToolRegistry } from './tool-registry.js';
import { ResourceRegistry } from './resource-registry.js';
import { PromptRegistry } from './prompt-registry.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { CapabilityTracker } from './capability-tracker.js';
import { createGatedHandler } from './tool-registration.js';
import { HealthChecker } from './health-check.js';
import { startHealthServer } from './health-server.js';
import {
  parseRequest,
  buildResponse,
  buildErrorResponse,
  JSON_RPC_ERRORS,
} from './transport.js';
import type {
  MCPServerConfig,
  ToolDefinition,
  ToolHandler,
  ToolResult,
  ResourceDefinition,
  ResourceHandler,
  ResourceResult,
  PromptDefinition,
  PromptHandler,
  PromptResult,
  JsonRpcResponse,
  CapabilityDiff,
} from './types.js';

/**
 * Base MCP server class for Data Workers agents.
 *
 * Every Data Workers agent extends this class to create an MCP server
 * that exposes domain-specific Tools, Resources, and Prompts.
 *
 * Built-in features:
 * - Tool/Resource/Prompt registries with JSON Schema (REQ-MCP-003)
 * - Circuit breaker: 3 failures/60s per server (REQ-MCP-005)
 * - Tool timeout: 30s default, 10min async max (REQ-MCP-006)
 * - Version pinning & capability tracking (REQ-MCP-004)
 * - Tool removal detection on reconnect (REQ-MCP-007)
 * - JSON-RPC 2.0 message handling
 */
export class DataWorkersMCPServer {
  readonly config: MCPServerConfig;
  protected toolRegistry: ToolRegistry;
  protected resourceRegistry: ResourceRegistry;
  protected promptRegistry: PromptRegistry;
  /** @deprecated Use per-tool breakers via toolCircuitBreakers instead. */
  protected circuitBreaker: CircuitBreaker;
  /** Per-tool circuit breakers — each tool gets its own failure counter. */
  protected toolCircuitBreakers: Map<string, CircuitBreaker> = new Map();
  protected capabilityTracker: CapabilityTracker;
  protected healthChecker: HealthChecker;

  private initialized = false;
  private healthServer: import('node:http').Server | null = null;

  constructor(config: MCPServerConfig) {
    this.config = {
      protocolVersion: '2024-11-05',
      ...config,
    };
    this.toolRegistry = new ToolRegistry();
    this.resourceRegistry = new ResourceRegistry();
    this.promptRegistry = new PromptRegistry();
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.capabilityTracker = new CapabilityTracker();
    this.healthChecker = new HealthChecker(config.name, 0);
  }

  // ── Registration API ──

  registerTool(definition: ToolDefinition, handler: ToolHandler): void {
    this.toolRegistry.register(definition, createGatedHandler(definition, handler));
  }

  registerResource(definition: ResourceDefinition, handler: ResourceHandler): void {
    this.resourceRegistry.register(definition, handler);
  }

  registerPrompt(definition: PromptDefinition, handler: PromptHandler): void {
    this.promptRegistry.register(definition, handler);
  }

  // ── Discovery API ──

  listTools(): ToolDefinition[] {
    return this.toolRegistry.list();
  }

  listResources(): ResourceDefinition[] {
    return this.resourceRegistry.list();
  }

  listPrompts(): PromptDefinition[] {
    return this.promptRegistry.list();
  }

  // ── Invocation API ──

  /**
   * Get or create a per-tool circuit breaker.
   * Each tool gets its own failure counter so one flaky tool
   * doesn't block all other tools on the same server.
   */
  private getToolBreaker(toolName: string): CircuitBreaker {
    let breaker = this.toolCircuitBreakers.get(toolName);
    if (!breaker) {
      breaker = new CircuitBreaker(this.config.circuitBreaker);
      this.toolCircuitBreakers.set(toolName, breaker);
    }
    return breaker;
  }

  /**
   * Call a tool with per-tool circuit breaker and timeout protection.
   * Circuit breaker is now scoped per-tool instead of per-server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const toolBreaker = this.getToolBreaker(name);

    if (toolBreaker.isOpen()) {
      return {
        content: [{
          type: 'text',
          text: `Circuit breaker open for tool '${name}' on server '${this.config.name}'. Service recovering — retry after cooldown.`,
        }],
        isError: true,
      };
    }

    const tool = this.toolRegistry.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool '${name}' not found on server '${this.config.name}'.` }],
        isError: true,
      };
    }

    const timeoutMs = this.config.timeout?.defaultMs ?? 30_000;

    try {
      const result = await this.withTimeout(tool.handler(args), timeoutMs, name);
      toolBreaker.recordSuccess();
      return result;
    } catch (error) {
      toolBreaker.recordFailure();
      return {
        content: [{
          type: 'text',
          text: `Tool '${name}' failed: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }

  /**
   * Read a resource by URI.
   */
  async readResource(uri: string): Promise<ResourceResult> {
    const resource = this.resourceRegistry.get(uri);
    if (!resource) {
      throw new Error(`Resource '${uri}' not found on server '${this.config.name}'.`);
    }
    return resource.handler(uri);
  }

  /**
   * Get a prompt by name with arguments.
   */
  async getPrompt(name: string, args: Record<string, string>): Promise<PromptResult> {
    const prompt = this.promptRegistry.get(name);
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found on server '${this.config.name}'.`);
    }
    return prompt.handler(args);
  }

  // ── Capability Tracking (REQ-MCP-004, REQ-MCP-007) ──

  /**
   * Capture the current capability manifest. Call on server startup.
   */
  captureCapabilities(): void {
    this.capabilityTracker.capture(
      this.config.name,
      this.config.version,
      this.config.protocolVersion ?? '2024-11-05',
      this.toolRegistry.listNames(),
      this.resourceRegistry.listUris(),
      this.promptRegistry.listNames(),
    );
    this.initialized = true;

    // Update health checker with current tool count and auto-start
    // the HTTP health server if DW_HEALTH_PORT is set.
    this.healthChecker.setToolCount(this.toolRegistry.size());
    if (process.env.DW_HEALTH_PORT && !this.healthServer) {
      this.healthServer = startHealthServer(this.healthChecker);
    }
  }

  /**
   * Check for capability changes since last capture.
   * Returns diff with added/removed tools, resources, prompts.
   * Call on reconnect to detect tool removal (REQ-MCP-007).
   */
  checkCapabilityChanges(): CapabilityDiff {
    return this.capabilityTracker.diff(
      this.config.name,
      this.toolRegistry.listNames(),
      this.resourceRegistry.listUris(),
      this.promptRegistry.listNames(),
    );
  }

  /**
   * Register a listener for capability changes.
   */
  onCapabilityChange(listener: (serverName: string, diff: CapabilityDiff) => void): void {
    this.capabilityTracker.onChange(listener);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ── JSON-RPC 2.0 Message Handler ──

  /**
   * Handle a raw JSON-RPC message string and return a response.
   * This is the main entry point for MCP protocol communication.
   */
  async handleMessage(raw: string): Promise<JsonRpcResponse> {
    let id: string | number | null = null;

    try {
      const request = parseRequest(raw);
      id = request.id;

      switch (request.method) {
        case 'initialize':
          return buildResponse(id, {
            protocolVersion: this.config.protocolVersion ?? '2024-11-05',
            capabilities: {
              tools: this.toolRegistry.size() > 0 ? {} : undefined,
              resources: this.resourceRegistry.size() > 0 ? {} : undefined,
              prompts: this.promptRegistry.size() > 0 ? {} : undefined,
            },
            serverInfo: {
              name: this.config.name,
              version: this.config.version,
            },
          });

        case 'tools/list':
          return buildResponse(id, {
            tools: this.toolRegistry.list(),
          });

        case 'tools/call': {
          const params = request.params as { name: string; arguments?: Record<string, unknown> };
          if (!params?.name) {
            return buildErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing tool name');
          }
          const result = await this.callTool(params.name, params.arguments ?? {});
          return buildResponse(id, result);
        }

        case 'resources/list':
          return buildResponse(id, {
            resources: this.resourceRegistry.list(),
          });

        case 'resources/read': {
          const rParams = request.params as { uri: string };
          if (!rParams?.uri) {
            return buildErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing resource URI');
          }
          const rResult = await this.readResource(rParams.uri);
          return buildResponse(id, rResult);
        }

        case 'prompts/list':
          return buildResponse(id, {
            prompts: this.promptRegistry.list(),
          });

        case 'prompts/get': {
          const pParams = request.params as { name: string; arguments?: Record<string, string> };
          if (!pParams?.name) {
            return buildErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing prompt name');
          }
          const pResult = await this.getPrompt(pParams.name, pParams.arguments ?? {});
          return buildResponse(id, pResult);
        }

        default:
          return buildErrorResponse(
            id,
            JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            `Method '${request.method}' not found`,
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildErrorResponse(
        id,
        JSON_RPC_ERRORS.INTERNAL_ERROR,
        message,
      );
    }
  }

  // ── Internal ──

  /**
   * Wrap a promise with a timeout (REQ-MCP-006).
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }
}
