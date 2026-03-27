import type { ResourceDefinition, ResourceHandler } from './types.js';

/**
 * Registry for MCP resources (read-only data endpoints).
 * Per REQ-MCP-003, each server can expose resources.
 */
export class ResourceRegistry {
  private resources = new Map<string, { definition: ResourceDefinition; handler: ResourceHandler }>();

  register(definition: ResourceDefinition, handler: ResourceHandler): void {
    if (this.resources.has(definition.uri)) {
      throw new Error(`Resource '${definition.uri}' is already registered`);
    }
    this.resources.set(definition.uri, { definition, handler });
  }

  unregister(uri: string): boolean {
    return this.resources.delete(uri);
  }

  get(uri: string) {
    return this.resources.get(uri);
  }

  list(): ResourceDefinition[] {
    return Array.from(this.resources.values()).map((r) => r.definition);
  }

  listUris(): string[] {
    return Array.from(this.resources.keys());
  }

  has(uri: string): boolean {
    return this.resources.has(uri);
  }

  size(): number {
    return this.resources.size;
  }
}
