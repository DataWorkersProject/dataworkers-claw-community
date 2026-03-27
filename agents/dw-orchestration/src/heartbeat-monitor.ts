/**
 * HeartbeatMonitor — Agent health monitoring via heartbeat signals.
 *
 * Agents send heartbeats every 5 seconds. If no heartbeat is received
 * for 15 seconds (3 missed beats), the agent is marked as failed.
 *
 * Heartbeat monitor implementation.
 */

import { InMemoryKeyValueStore } from '@data-workers/infrastructure-stubs';
import type { HeartbeatStatus } from './types.js';

const HEARTBEAT_INTERVAL_MS = 5_000;
const HEARTBEAT_TTL_MS = 15_000;

export class HeartbeatMonitor {
  private kvStore: InMemoryKeyValueStore;
  private knownAgents: Set<string> = new Set();
  private nowFn: () => number;

  constructor(kvStore: InMemoryKeyValueStore, nowFn?: () => number) {
    this.kvStore = kvStore;
    this.nowFn = nowFn ?? (() => Date.now());
  }

  /**
   * Record a heartbeat from an agent.
   * Stores the timestamp with a TTL of 15s.
   */
  async beat(agentName: string): Promise<void> {
    const now = this.nowFn();
    this.knownAgents.add(agentName);
    await this.kvStore.set(`heartbeat:${agentName}`, String(now), HEARTBEAT_TTL_MS);
  }

  /**
   * Check the health status of all known agents.
   * Returns a list of HeartbeatStatus entries.
   */
  async checkHealth(): Promise<HeartbeatStatus[]> {
    const now = this.nowFn();
    const statuses: HeartbeatStatus[] = [];

    for (const agentName of this.knownAgents) {
      const raw = await this.kvStore.get(`heartbeat:${agentName}`);
      if (raw === null) {
        // Heartbeat expired (TTL exceeded) — agent is dead
        statuses.push({
          agentName,
          alive: false,
          lastSeen: 0,
          missedBeats: Math.ceil(HEARTBEAT_TTL_MS / HEARTBEAT_INTERVAL_MS),
        });
      } else {
        const lastSeen = Number(raw);
        const elapsed = now - lastSeen;
        const missedBeats = Math.floor(elapsed / HEARTBEAT_INTERVAL_MS);
        statuses.push({
          agentName,
          alive: elapsed < HEARTBEAT_TTL_MS,
          lastSeen,
          missedBeats,
        });
      }
    }

    return statuses;
  }

  /**
   * Get agents that have failed (no heartbeat for > 15s).
   */
  async getFailedAgents(): Promise<string[]> {
    return (await this.checkHealth())
      .filter((s) => !s.alive)
      .map((s) => s.agentName);
  }

  /**
   * Remove an agent from tracking (used during deregistration).
   */
  async removeAgent(agentName: string): Promise<void> {
    this.knownAgents.delete(agentName);
    await this.kvStore.delete(`heartbeat:${agentName}`);
  }
}
