import type { ToolDefinition, ToolHandler } from './types.js';

/**
 * Registry for MCP tools. Manages tool definitions and their handlers,
 * supporting discovery and invocation per REQ-MCP-003.
 */
export class ToolRegistry {
  private tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool '${definition.name}' is already registered`);
    }
    this.tools.set(definition.name, { definition, handler });
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string) {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  size(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
  }
}
