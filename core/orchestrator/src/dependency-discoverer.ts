/**
 * Dependency Discoverer (REQ-ORCH-004).
 *
 * Discovers implicit data dependencies between DAGs
 * by analyzing read/write patterns.
 */

export interface DataDependency {
  sourceAgent: string;
  targetAgent: string;
  resource: string;
  type: 'read_after_write' | 'write_after_read' | 'concurrent_write';
  confidence: number;
  discoveredAt: number;
}

export class DependencyDiscoverer {
  private accessLog: Array<{ agent: string; resource: string; operation: 'read' | 'write'; timestamp: number }> = [];
  private dependencies: DataDependency[] = [];

  recordAccess(agent: string, resource: string, operation: 'read' | 'write'): void {
    this.accessLog.push({ agent, resource, operation, timestamp: Date.now() });
    if (this.accessLog.length > 10000) this.accessLog = this.accessLog.slice(-5000);
  }

  discover(): DataDependency[] {
    const byResource = new Map<string, typeof this.accessLog>();
    for (const entry of this.accessLog) {
      const existing = byResource.get(entry.resource) ?? [];
      existing.push(entry);
      byResource.set(entry.resource, existing);
    }

    const newDeps: DataDependency[] = [];
    for (const [resource, entries] of byResource) {
      const writers = entries.filter((e) => e.operation === 'write');
      const readers = entries.filter((e) => e.operation === 'read');

      for (const writer of writers) {
        for (const reader of readers) {
          if (writer.agent !== reader.agent && reader.timestamp >= writer.timestamp) {
            const exists = this.dependencies.find(
              (d) => d.sourceAgent === writer.agent && d.targetAgent === reader.agent && d.resource === resource,
            );
            if (!exists) {
              const dep: DataDependency = {
                sourceAgent: writer.agent,
                targetAgent: reader.agent,
                resource,
                type: 'read_after_write',
                confidence: 0.8,
                discoveredAt: Date.now(),
              };
              newDeps.push(dep);
              this.dependencies.push(dep);
            }
          }
        }
      }
    }
    return newDeps;
  }

  getDependencies(): DataDependency[] { return [...this.dependencies]; }
}
