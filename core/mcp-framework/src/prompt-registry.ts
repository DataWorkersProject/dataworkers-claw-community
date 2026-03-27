import type { PromptDefinition, PromptHandler } from './types.js';

/**
 * Registry for MCP prompts (contextual templates).
 * Per REQ-MCP-003, each server can expose prompts.
 */
export class PromptRegistry {
  private prompts = new Map<string, { definition: PromptDefinition; handler: PromptHandler }>();

  register(definition: PromptDefinition, handler: PromptHandler): void {
    if (this.prompts.has(definition.name)) {
      throw new Error(`Prompt '${definition.name}' is already registered`);
    }
    this.prompts.set(definition.name, { definition, handler });
  }

  unregister(name: string): boolean {
    return this.prompts.delete(name);
  }

  get(name: string) {
    return this.prompts.get(name);
  }

  list(): PromptDefinition[] {
    return Array.from(this.prompts.values()).map((p) => p.definition);
  }

  listNames(): string[] {
    return Array.from(this.prompts.keys());
  }

  has(name: string): boolean {
    return this.prompts.has(name);
  }

  size(): number {
    return this.prompts.size;
  }
}
