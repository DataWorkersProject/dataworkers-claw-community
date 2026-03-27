/**
 * Progressive tool/skill loading for cross-agent context management.
 * Pattern from IncidentFox: load only tool metadata (~100 tokens) initially,
 * full definitions on-demand when invoked.
 */

export interface ToolMetadata {
  name: string;
  description: string;
  agentId: string;
  inputTypes: string[];
  outputTypes: string[];
}

export interface ToolDefinitionFull extends ToolMetadata {
  inputSchema: Record<string, unknown>;
  handler?: (args: unknown) => Promise<unknown>;
}

export class ProgressiveToolLoader {
  private metadata = new Map<string, ToolMetadata>();
  private fullDefinitions = new Map<string, ToolDefinitionFull>();
  private loadCount = 0;

  /**
   * Register tool metadata (lightweight, ~100 tokens per tool).
   */
  registerMetadata(meta: ToolMetadata): void {
    this.metadata.set(meta.name, meta);
  }

  /**
   * Register multiple tool metadata entries.
   */
  registerBulk(tools: ToolMetadata[]): void {
    for (const tool of tools) this.registerMetadata(tool);
  }

  /**
   * Get lightweight metadata for all available tools.
   * Used during agent coordination to understand capabilities without context bloat.
   */
  getAvailableTools(agentId?: string): ToolMetadata[] {
    const all = Array.from(this.metadata.values());
    return agentId ? all.filter(t => t.agentId === agentId) : all;
  }

  /**
   * Load full tool definition on-demand.
   * Only called when the agent decides to invoke a specific tool.
   */
  async loadFull(toolName: string): Promise<ToolDefinitionFull | null> {
    // Check cache
    const cached = this.fullDefinitions.get(toolName);
    if (cached) return cached;

    // Load from metadata
    const meta = this.metadata.get(toolName);
    if (!meta) return null;

    this.loadCount++;
    const full: ToolDefinitionFull = {
      ...meta,
      inputSchema: {}, // Would be loaded from agent's MCP manifest
    };
    this.fullDefinitions.set(toolName, full);
    return full;
  }

  /**
   * Get loading stats for monitoring.
   */
  getStats(): { registered: number; loaded: number; loadRatio: number } {
    const registered = this.metadata.size;
    const loaded = this.fullDefinitions.size;
    return { registered, loaded, loadRatio: registered > 0 ? loaded / registered : 0 };
  }
}
