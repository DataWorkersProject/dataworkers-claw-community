/**
 * OrchestrationService — Top-level coordinator that ties together
 * TaskScheduler, HeartbeatMonitor, AgentRegistry, and EventChoreographer.
 *
 * Provides graceful shutdown: drain tasks, deregister agents, stop heartbeat.
 */

import { InMemoryKeyValueStore, InMemoryRelationalStore, InMemoryMessageBus } from '@data-workers/infrastructure-stubs';
import { TaskScheduler } from './task-scheduler.js';
import { HeartbeatMonitor } from './heartbeat-monitor.js';
import { AgentRegistry } from './agent-registry.js';
import { EventChoreographer } from './event-choreographer.js';
import type { AgentInstance } from './types.js';

export class OrchestrationService {
  readonly scheduler: TaskScheduler;
  readonly heartbeat: HeartbeatMonitor;
  readonly registry: AgentRegistry;
  readonly choreographer: EventChoreographer;
  private running = false;

  constructor(
    kvStore: InMemoryKeyValueStore,
    relationalStore: InMemoryRelationalStore,
    messageBus: InMemoryMessageBus,
    nowFn?: () => number,
  ) {
    this.scheduler = new TaskScheduler(kvStore);
    this.heartbeat = new HeartbeatMonitor(kvStore, nowFn);
    this.registry = new AgentRegistry(relationalStore);
    this.choreographer = new EventChoreographer(messageBus);
    this.running = true;
  }

  /**
   * Initialize async resources (e.g., create tables).
   * Must be called after construction.
   */
  async init(): Promise<void> {
    await this.registry.init();
  }

  /**
   * Check for failed agents and redistribute their tasks.
   * Returns the list of agents that were detected as failed.
   */
  async handleFailedAgents(): Promise<string[]> {
    const failedAgents = await this.heartbeat.getFailedAgents();
    if (failedAgents.length === 0) return [];

    const healthyAgents = (await this.registry
      .list())
      .filter((a: AgentInstance) => a.status === 'active' && !failedAgents.includes(a.name));

    for (const failedAgent of failedAgents) {
      if (healthyAgents.length > 0) {
        // Round-robin redistribution to healthy agents
        const target = healthyAgents[0];
        await this.scheduler.redistributeTasks(failedAgent, target.name);
      }
    }

    return failedAgents;
  }

  /**
   * Graceful shutdown sequence:
   * 1. Stop accepting new tasks (mark as not running)
   * 2. Drain remaining queued tasks (mark as failed)
   * 3. Deregister all agents
   * 4. Stop heartbeat monitoring
   */
  async shutdown(): Promise<void> {
    this.running = false;

    // Drain queued tasks
    const queuedTasks = this.scheduler.getQueue();
    for (const task of queuedTasks) {
      await this.scheduler.fail(task.id);
    }

    // Deregister all agents
    const agents = await this.registry.list();
    for (const agent of agents) {
      await this.heartbeat.removeAgent(agent.name);
      await this.registry.deregister(agent.name);
    }
  }

  /**
   * Whether the service is currently accepting tasks.
   */
  isRunning(): boolean {
    return this.running;
  }
}
