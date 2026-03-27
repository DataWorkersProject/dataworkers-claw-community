import type { CapabilityManifest, CapabilityDiff } from './types.js';

/**
 * Tracks MCP server capabilities for version pinning and tool removal detection.
 * Implements REQ-MCP-004 (version pinning) and REQ-MCP-007 (tool removal detection).
 *
 * On each connection, captures a manifest of all tools, resources, and prompts.
 * On reconnect, diffs against the previous manifest to detect removals.
 */
export class CapabilityTracker {
  private manifests = new Map<string, CapabilityManifest>();
  private listeners: Array<(serverName: string, diff: CapabilityDiff) => void> = [];

  /**
   * Capture the current capability manifest for a server.
   */
  capture(
    serverName: string,
    serverVersion: string,
    protocolVersion: string,
    tools: string[],
    resources: string[],
    prompts: string[],
  ): CapabilityManifest {
    const manifest: CapabilityManifest = {
      serverName,
      serverVersion,
      protocolVersion,
      tools: [...tools].sort(),
      resources: [...resources].sort(),
      prompts: [...prompts].sort(),
      capturedAt: Date.now(),
    };
    this.manifests.set(serverName, manifest);
    return manifest;
  }

  /**
   * Compare new capabilities against the stored manifest.
   * Returns a diff describing what changed. Notifies listeners on changes.
   */
  diff(
    serverName: string,
    currentTools: string[],
    currentResources: string[],
    currentPrompts: string[],
  ): CapabilityDiff {
    const previous = this.manifests.get(serverName);

    if (!previous) {
      return {
        addedTools: [...currentTools],
        removedTools: [],
        addedResources: [...currentResources],
        removedResources: [],
        addedPrompts: [...currentPrompts],
        removedPrompts: [],
        hasChanges: false,
      };
    }

    const prevToolSet = new Set(previous.tools);
    const currToolSet = new Set(currentTools);
    const prevResourceSet = new Set(previous.resources);
    const currResourceSet = new Set(currentResources);
    const prevPromptSet = new Set(previous.prompts);
    const currPromptSet = new Set(currentPrompts);

    const result: CapabilityDiff = {
      addedTools: currentTools.filter((t) => !prevToolSet.has(t)),
      removedTools: previous.tools.filter((t) => !currToolSet.has(t)),
      addedResources: currentResources.filter((r) => !prevResourceSet.has(r)),
      removedResources: previous.resources.filter((r) => !currResourceSet.has(r)),
      addedPrompts: currentPrompts.filter((p) => !prevPromptSet.has(p)),
      removedPrompts: previous.prompts.filter((p) => !currPromptSet.has(p)),
      hasChanges: false,
    };

    result.hasChanges =
      result.addedTools.length > 0 ||
      result.removedTools.length > 0 ||
      result.addedResources.length > 0 ||
      result.removedResources.length > 0 ||
      result.addedPrompts.length > 0 ||
      result.removedPrompts.length > 0;

    if (result.hasChanges) {
      for (const listener of this.listeners) {
        listener(serverName, result);
      }
    }

    return result;
  }

  /**
   * Register a listener for capability changes (e.g., to notify customers).
   */
  onChange(listener: (serverName: string, diff: CapabilityDiff) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Get the stored manifest for a server.
   */
  getManifest(serverName: string): CapabilityManifest | undefined {
    return this.manifests.get(serverName);
  }

  /**
   * Check if a specific tool is still available.
   */
  hasToolAvailable(serverName: string, toolName: string): boolean {
    const manifest = this.manifests.get(serverName);
    return manifest ? manifest.tools.includes(toolName) : false;
  }
}
