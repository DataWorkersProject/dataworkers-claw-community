/**
 * Deadlock Detection (REQ-CONFL-004).
 *
 * Maintains a wait-for graph and detects cycles every 5 seconds.
 * On cycle detection, the lowest-priority agent is forcibly released,
 * rolled back, and requeued with backoff.
 */

export interface WaitEdge {
  waiter: string;
  holder: string;
  resource: string;
  waitingSince: number;
}

export class DeadlockDetector {
  private waitGraph: WaitEdge[] = [];
  private checkIntervalMs: number;

  constructor(checkIntervalMs = 5_000) {
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Record that an agent is waiting for a resource held by another.
   */
  addWait(waiter: string, holder: string, resource: string): void {
    this.waitGraph.push({ waiter, holder, resource, waitingSince: Date.now() });
  }

  /**
   * Remove wait entries for a resolved lock.
   */
  removeWait(waiter: string, resource: string): void {
    this.waitGraph = this.waitGraph.filter(
      (e) => !(e.waiter === waiter && e.resource === resource),
    );
  }

  /**
   * Detect cycles in the wait-for graph.
   * Returns the cycle path if found, null otherwise.
   */
  detectCycle(): string[] | null {
    const adj = new Map<string, string[]>();
    for (const edge of this.waitGraph) {
      const existing = adj.get(edge.waiter) ?? [];
      existing.push(edge.holder);
      adj.set(edge.waiter, existing);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      inStack.add(node);
      path.push(node);

      for (const neighbor of adj.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (inStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      inStack.delete(node);
      path.pop();
      return false;
    };

    for (const [node] of adj) {
      if (!visited.has(node)) {
        if (dfs(node)) return path;
      }
    }

    return null;
  }

  /**
   * Select the victim (lowest priority) in a deadlock cycle.
   */
  selectVictim(cycle: string[], priorities: Record<string, number>): string {
    return cycle.reduce((victim, agent) => {
      const victimPrio = priorities[victim] ?? 99;
      const agentPrio = priorities[agent] ?? 99;
      return agentPrio > victimPrio ? agent : victim;
    });
  }

  getWaitGraph(): WaitEdge[] {
    return [...this.waitGraph];
  }

  getCheckInterval(): number {
    return this.checkIntervalMs;
  }
}
