import type { AnomalyDetection } from './statistical-detector.js';
import type { IncidentSeverity } from '../types.js';

/**
 * Anomaly Classifier (REQ-INC-005).
 *
 * Classifies anomalies into severity levels and deduplicates
 * alerts to reduce noise (50-100 raw alerts -> 5-10 actionable).
 */

export interface ClassifiedAnomaly {
  detection: AnomalyDetection;
  severity: IncidentSeverity;
  actionable: boolean;
  deduplicationKey: string;
  groupId?: string;
}

export class AnomalyClassifier {
  private recentAlerts = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();
  private deduplicationWindowMs: number;

  constructor(deduplicationWindowMs = 300_000) { // 5 min default
    this.deduplicationWindowMs = deduplicationWindowMs;
  }

  /**
   * Classify and deduplicate an anomaly detection.
   */
  classify(detection: AnomalyDetection): ClassifiedAnomaly {
    const deduplicationKey = `${detection.metric}:${detection.method}:${detection.severity}`;
    const now = Date.now();

    // Check deduplication
    const existing = this.recentAlerts.get(deduplicationKey);
    let actionable = true;

    if (existing && (now - existing.lastSeen) < this.deduplicationWindowMs) {
      existing.count++;
      existing.lastSeen = now;
      actionable = false; // Suppress duplicate
    } else {
      this.recentAlerts.set(deduplicationKey, { count: 1, firstSeen: now, lastSeen: now });
    }

    // Map detection severity to incident severity
    const severity = this.mapSeverity(detection);

    return {
      detection,
      severity,
      actionable,
      deduplicationKey,
    };
  }

  /**
   * Get alert suppression stats.
   */
  getSuppressionStats(): { total: number; suppressed: number; actionable: number } {
    let total = 0;
    let suppressed = 0;
    for (const alert of this.recentAlerts.values()) {
      total += alert.count;
      suppressed += Math.max(0, alert.count - 1);
    }
    return { total, suppressed, actionable: total - suppressed };
  }

  /**
   * Clean up expired deduplication entries.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, alert] of this.recentAlerts) {
      if (now - alert.lastSeen > this.deduplicationWindowMs) {
        this.recentAlerts.delete(key);
      }
    }
  }

  private mapSeverity(detection: AnomalyDetection): IncidentSeverity {
    const absDeviation = Math.abs(detection.deviation);
    if (absDeviation > 5) return 'critical';
    if (absDeviation > 3) return 'high';
    if (absDeviation > 2) return 'medium';
    if (absDeviation > 1) return 'low';
    return 'info';
  }
}
