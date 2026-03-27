/**
 * TaskScheduler — Priority task scheduling using sorted set emulation.
 *
 * Tasks are scored as: priority * 1e12 + timestamp (lower score = higher priority).
 * P0 tasks are never preempted. P3 tasks have starvation prevention:
 * if queued longer than 5 minutes, their effective priority is boosted.
 *
 * Priority task scheduler implementation.
 */

import { InMemoryKeyValueStore } from '@data-workers/infrastructure-stubs';
import type { ScheduledTask, TaskPriority } from './types.js';

const STARVATION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface QueueEntry {
  task: ScheduledTask;
  score: number;
}

export class TaskScheduler {
  private queue: QueueEntry[] = [];
  private tasks: Map<string, ScheduledTask> = new Map();
  private kvStore: InMemoryKeyValueStore;

  constructor(kvStore: InMemoryKeyValueStore) {
    this.kvStore = kvStore;
  }

  /**
   * Calculate the sort score for a task.
   * Lower score = dequeued first. Priority dominates, timestamp breaks ties.
   */
  private calculateScore(priority: TaskPriority, createdAt: number): number {
    return priority * 1e12 + createdAt;
  }

  /**
   * Submit a task to the priority queue.
   */
  async submit(task: ScheduledTask): Promise<void> {
    task.status = 'queued';
    const score = this.calculateScore(task.priority, task.createdAt);
    this.tasks.set(task.id, task);
    this.queue.push({ task, score });
    this.queue.sort((a, b) => a.score - b.score);

    // Store in KV for persistence
    await this.kvStore.set(`task:${task.id}`, JSON.stringify(task));
  }

  /**
   * Dequeue the highest-priority task for a given agent.
   * Applies starvation prevention: P3 tasks waiting > 5 minutes get boosted.
   */
  async dequeue(agentName: string): Promise<ScheduledTask | null> {
    const now = Date.now();

    // Apply starvation prevention: recalculate scores for long-waiting tasks
    for (const entry of this.queue) {
      if (entry.task.status !== 'queued') continue;
      const waitTime = now - entry.task.createdAt;
      if (entry.task.priority === 3 && waitTime > STARVATION_THRESHOLD_MS) {
        // Boost P3 to P1 effective priority
        entry.score = this.calculateScore(1, entry.task.createdAt);
      } else if (entry.task.priority === 2 && waitTime > STARVATION_THRESHOLD_MS) {
        // Boost P2 to P0 effective priority
        entry.score = this.calculateScore(0, entry.task.createdAt);
      }
    }

    // Re-sort after starvation adjustments
    this.queue.sort((a, b) => a.score - b.score);

    // Find the first queued task for this agent
    const idx = this.queue.findIndex(
      (e) => e.task.status === 'queued' && e.task.agentName === agentName,
    );

    if (idx === -1) return null;

    const entry = this.queue.splice(idx, 1)[0];
    entry.task.status = 'running';
    entry.task.startedAt = now;
    await this.kvStore.set(`task:${entry.task.id}`, JSON.stringify(entry.task));
    return entry.task;
  }

  /**
   * Mark a task as completed.
   */
  async complete(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'completed';
    task.completedAt = Date.now();
    await this.kvStore.set(`task:${taskId}`, JSON.stringify(task));
  }

  /**
   * Mark a task as failed. The task remains in the tasks map for redistribution.
   */
  async fail(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'failed';
    await this.kvStore.set(`task:${taskId}`, JSON.stringify(task));
  }

  /**
   * Get all tasks currently in the queue (queued status).
   */
  getQueue(): ScheduledTask[] {
    return this.queue
      .filter((e) => e.task.status === 'queued')
      .map((e) => e.task);
  }

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Re-queue failed tasks from a specific agent to a target agent.
   * Used when an agent fails and its tasks need redistribution.
   */
  async redistributeTasks(fromAgent: string, toAgent: string): Promise<number> {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.agentName === fromAgent && (task.status === 'running' || task.status === 'queued')) {
        task.agentName = toAgent;
        task.status = 'queued';
        task.startedAt = undefined;
        const score = this.calculateScore(task.priority, task.createdAt);
        this.queue.push({ task, score });
        await this.kvStore.set(`task:${task.id}`, JSON.stringify(task));
        count++;
      }
    }
    this.queue.sort((a, b) => a.score - b.score);
    return count;
  }
}
