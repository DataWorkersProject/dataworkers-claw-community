import type { IncidentRecord } from './incident-logger.js';

/**
 * MTTR Tracker (REQ-INC-008).
 *
 * Tracks Mean Time To Resolve over 30-day rolling windows.
 * Target: 4-8 hours → 8-15 minutes (10-30x improvement).
 *
 * Also tracks auto-resolution rate (target: 60-70%).
 */

export interface MTTRReport {
  periodStart: number;
  periodEnd: number;
  totalIncidents: number;
  resolvedIncidents: number;
  mttrMs: number;
  mttrMinutes: number;
  mttrHours: number;
  autoResolutionRate: number;
  falsePositiveRate: number;
  byType: Record<string, { count: number; mttrMs: number; autoRate: number }>;
  bySeverity: Record<string, { count: number; mttrMs: number }>;
  improvementTrend: number; // Negative = improving
}

export class MTTRTracker {
  private windowMs: number;

  constructor(windowDays = 30) {
    this.windowMs = windowDays * 24 * 60 * 60 * 1000;
  }

  /**
   * Generate MTTR report for a customer over the rolling window.
   */
  generateReport(records: IncidentRecord[], customerId: string): MTTRReport {
    const now = Date.now();
    const periodStart = now - this.windowMs;
    const periodEnd = now;

    // Filter to window and customer
    const windowRecords = records.filter(
      (r) => r.customerId === customerId && r.createdAt >= periodStart,
    );

    const resolved = windowRecords.filter((r) => r.outcome.resolved);
    const autoResolved = resolved.filter((r) => r.outcome.automated);
    const falsePositives = windowRecords.filter((r) => r.outcome.falsePositive);

    // Calculate MTTR
    const resolvedWithDuration = resolved.filter((r) => r.timeline.totalDurationMs);
    const mttrMs = resolvedWithDuration.length > 0
      ? resolvedWithDuration.reduce((sum, r) => sum + (r.timeline.totalDurationMs ?? 0), 0) / resolvedWithDuration.length
      : 0;

    // By type breakdown
    const byType: MTTRReport['byType'] = {};
    for (const record of windowRecords) {
      const type = record.diagnosis.type;
      if (!byType[type]) byType[type] = { count: 0, mttrMs: 0, autoRate: 0 };
      byType[type].count++;
    }
    for (const type of Object.keys(byType)) {
      const typeRecords = resolved.filter((r) => r.diagnosis.type === type);
      const typeAuto = typeRecords.filter((r) => r.outcome.automated);
      const typeDurations = typeRecords.filter((r) => r.timeline.totalDurationMs);
      byType[type].mttrMs = typeDurations.length > 0
        ? typeDurations.reduce((sum, r) => sum + (r.timeline.totalDurationMs ?? 0), 0) / typeDurations.length
        : 0;
      byType[type].autoRate = typeRecords.length > 0 ? typeAuto.length / typeRecords.length : 0;
    }

    // By severity breakdown
    const bySeverity: MTTRReport['bySeverity'] = {};
    for (const record of windowRecords) {
      const sev = record.diagnosis.severity;
      if (!bySeverity[sev]) bySeverity[sev] = { count: 0, mttrMs: 0 };
      bySeverity[sev].count++;
    }
    for (const sev of Object.keys(bySeverity)) {
      const sevRecords = resolved.filter((r) => r.diagnosis.severity === sev && r.timeline.totalDurationMs);
      bySeverity[sev].mttrMs = sevRecords.length > 0
        ? sevRecords.reduce((sum, r) => sum + (r.timeline.totalDurationMs ?? 0), 0) / sevRecords.length
        : 0;
    }

    // Improvement trend: compare first half vs second half of window
    const midpoint = periodStart + this.windowMs / 2;
    const firstHalf = resolvedWithDuration.filter((r) => r.createdAt < midpoint);
    const secondHalf = resolvedWithDuration.filter((r) => r.createdAt >= midpoint);
    const firstMTTR = firstHalf.length > 0
      ? firstHalf.reduce((s, r) => s + (r.timeline.totalDurationMs ?? 0), 0) / firstHalf.length
      : 0;
    const secondMTTR = secondHalf.length > 0
      ? secondHalf.reduce((s, r) => s + (r.timeline.totalDurationMs ?? 0), 0) / secondHalf.length
      : 0;
    const improvementTrend = firstMTTR > 0 ? ((secondMTTR - firstMTTR) / firstMTTR) * 100 : 0;

    return {
      periodStart,
      periodEnd,
      totalIncidents: windowRecords.length,
      resolvedIncidents: resolved.length,
      mttrMs,
      mttrMinutes: mttrMs / 60_000,
      mttrHours: mttrMs / 3_600_000,
      autoResolutionRate: windowRecords.length > 0 ? autoResolved.length / windowRecords.length : 0,
      falsePositiveRate: windowRecords.length > 0 ? falsePositives.length / windowRecords.length : 0,
      byType,
      bySeverity,
      improvementTrend,
    };
  }

  /**
   * Check if MTTR target is being met (8-15 minutes).
   */
  isMeetingTarget(report: MTTRReport): boolean {
    return report.mttrMinutes <= 15;
  }

  /**
   * Check if auto-resolution rate target is being met (60-70%).
   */
  isAutoResolutionOnTarget(report: MTTRReport): boolean {
    return report.autoResolutionRate >= 0.6;
  }
}
