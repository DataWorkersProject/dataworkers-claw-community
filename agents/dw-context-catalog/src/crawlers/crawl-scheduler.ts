import type { CrawlResult } from './base-crawler.js';

/**
 * Crawl Scheduler (REQ-CTX-AG-001).
 *
 * Configurable scheduling:
 * - Metadata crawl: every 6 hours (default)
 * - Lineage crawl: real-time (event-driven)
 * - Initial crawl: <4 hours for 10K tables (REQ-ONBOARD-001)
 */

export interface ScheduleConfig {
  metadataCrawlIntervalMs: number;
  lineageCrawlIntervalMs: number;
  initialCrawlTargetMs: number;
}

export interface ScheduledCrawl {
  id: string;
  platform: string;
  customerId: string;
  type: 'metadata' | 'lineage' | 'initial';
  nextRunAt: number;
  lastRunAt?: number;
  lastResult?: CrawlResult;
}

export class CrawlScheduler {
  private config: ScheduleConfig;
  private schedules: ScheduledCrawl[] = [];

  constructor(config?: Partial<ScheduleConfig>) {
    this.config = {
      metadataCrawlIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
      lineageCrawlIntervalMs: 60 * 1000, // 1 minute (near real-time)
      initialCrawlTargetMs: 4 * 60 * 60 * 1000, // 4 hours
      ...config,
    };
  }

  /**
   * Schedule a metadata crawl for a platform.
   */
  scheduleMetadataCrawl(platform: string, customerId: string): ScheduledCrawl {
    const schedule: ScheduledCrawl = {
      id: `crawl-${platform}-${customerId}-${Date.now()}`,
      platform,
      customerId,
      type: 'metadata',
      nextRunAt: Date.now() + this.config.metadataCrawlIntervalMs,
    };
    this.schedules.push(schedule);
    return schedule;
  }

  /**
   * Schedule an initial discovery crawl.
   */
  scheduleInitialCrawl(platform: string, customerId: string): ScheduledCrawl {
    const schedule: ScheduledCrawl = {
      id: `initial-${platform}-${customerId}`,
      platform,
      customerId,
      type: 'initial',
      nextRunAt: Date.now(), // Run immediately
    };
    this.schedules.push(schedule);
    return schedule;
  }

  /**
   * Get all due crawls.
   */
  getDueCrawls(): ScheduledCrawl[] {
    const now = Date.now();
    return this.schedules.filter((s) => s.nextRunAt <= now);
  }

  /**
   * Record crawl completion and schedule next run.
   */
  recordCompletion(scheduleId: string, result: CrawlResult): void {
    const schedule = this.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    schedule.lastRunAt = Date.now();
    schedule.lastResult = result;
    if (schedule.type !== 'initial') {
      schedule.nextRunAt = Date.now() +
        (schedule.type === 'metadata' ? this.config.metadataCrawlIntervalMs : this.config.lineageCrawlIntervalMs);
    }
  }

  getSchedules(): ScheduledCrawl[] {
    return [...this.schedules];
  }
}
