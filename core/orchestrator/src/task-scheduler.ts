/**
 * Task Scheduler (REQ-ORCH-001).
 *
 * Priority-based scheduling with SLA awareness.
 * Uses 8-level priority hierarchy from conflict resolution.
 */

export interface ScheduledTask {
  id: string;
  agentId: string;
  customerId: string;
  priority: number;
  slaDeadline?: number;
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'completed' | 'failed';
  scheduledAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface SchedulerConfig {
  maxConcurrentTasks: number;
  slaBufferMs: number;
}

export class TaskScheduler {
  private queue: ScheduledTask[] = [];
  private running = new Map<string, ScheduledTask>();
  private config: SchedulerConfig;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = { maxConcurrentTasks: 50, slaBufferMs: 60_000, ...config };
  }

  enqueue(task: Omit<ScheduledTask, 'status' | 'scheduledAt'>): ScheduledTask {
    const scheduled: ScheduledTask = { ...task, status: 'queued', scheduledAt: Date.now() };
    this.queue.push(scheduled);
    this.queue.sort((a, b) => a.priority - b.priority || (a.slaDeadline ?? Infinity) - (b.slaDeadline ?? Infinity));
    return scheduled;
  }

  dequeue(): ScheduledTask | null {
    if (this.running.size >= this.config.maxConcurrentTasks) return null;
    const task = this.queue.shift();
    if (task) {
      task.status = 'running';
      task.startedAt = Date.now();
      this.running.set(task.id, task);
    }
    return task ?? null;
  }

  complete(taskId: string, success: boolean): void {
    const task = this.running.get(taskId);
    if (task) {
      task.status = success ? 'completed' : 'failed';
      task.completedAt = Date.now();
      this.running.delete(taskId);
    }
  }

  getQueueSize(): number { return this.queue.length; }
  getRunningCount(): number { return this.running.size; }
}
