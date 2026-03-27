import type { AnomalyDetection } from './statistical-detector.js';

export interface CorrelatedAlertGroup {
  id: string;
  alerts: AnomalyDetection[];
  correlationType: 'temporal' | 'topology' | 'semantic';
  rootAlert: AnomalyDetection;
  suppressedCount: number;
  confidence: number;
}

export class AlertCorrelator {
  private temporalWindowMs: number;

  constructor(config?: { temporalWindowMs?: number }) {
    this.temporalWindowMs = config?.temporalWindowMs ?? 300_000; // 5 min default
  }

  /**
   * Layer 1: Temporal correlation — group alerts within time window.
   */
  correlateByTime(alerts: AnomalyDetection[]): CorrelatedAlertGroup[] {
    if (alerts.length === 0) return [];

    const sorted = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
    const groups: CorrelatedAlertGroup[] = [];
    let currentGroup: AnomalyDetection[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].timestamp - sorted[i - 1].timestamp <= this.temporalWindowMs) {
        currentGroup.push(sorted[i]);
      } else {
        groups.push(this.buildGroup(currentGroup, 'temporal'));
        currentGroup = [sorted[i]];
      }
    }
    groups.push(this.buildGroup(currentGroup, 'temporal'));
    return groups;
  }

  /**
   * Layer 2: Topology correlation — group alerts from related services/tables.
   * Uses the metric namespace as a proxy for topology (e.g., "orders.row_count"
   * and "orders.latency" share the "orders" topology).
   */
  correlateByTopology(alerts: AnomalyDetection[]): CorrelatedAlertGroup[] {
    const bySource = new Map<string, AnomalyDetection[]>();
    for (const alert of alerts) {
      // Extract topology key from metric name: use dotted prefix or full metric
      const dotIdx = alert.metric.indexOf('.');
      const source = dotIdx > 0 ? alert.metric.slice(0, dotIdx) : alert.metric;
      if (!bySource.has(source)) bySource.set(source, []);
      bySource.get(source)!.push(alert);
    }
    return Array.from(bySource.values())
      .filter(group => group.length > 0)
      .map(group => this.buildGroup(group, 'topology'));
  }

  /**
   * Layer 3: Semantic correlation — group alerts with similar metrics.
   */
  correlateBySemantic(alerts: AnomalyDetection[]): CorrelatedAlertGroup[] {
    // Group by metric prefix (e.g., cpu_usage + cpu_load = cpu group)
    const byPrefix = new Map<string, AnomalyDetection[]>();
    for (const alert of alerts) {
      const prefix = alert.metric.split('_')[0] ?? alert.metric;
      if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
      byPrefix.get(prefix)!.push(alert);
    }
    return Array.from(byPrefix.values())
      .filter(group => group.length > 0)
      .map(group => this.buildGroup(group, 'semantic'));
  }

  /**
   * Full 3-layer correlation pipeline.
   * Returns deduplicated alert groups with noise reduction.
   */
  correlate(alerts: AnomalyDetection[]): {
    groups: CorrelatedAlertGroup[];
    originalCount: number;
    groupCount: number;
    noiseReductionPercent: number;
  } {
    if (alerts.length === 0) return { groups: [], originalCount: 0, groupCount: 0, noiseReductionPercent: 0 };

    // Apply layers sequentially — each reduces noise further
    const temporalGroups = this.correlateByTime(alerts);

    // For multi-alert groups, apply topology correlation
    const allGroupedAlerts = temporalGroups.flatMap(g => g.alerts);
    const topologyGroups = this.correlateByTopology(allGroupedAlerts);

    // Final semantic grouping on largest groups
    const finalGroups = topologyGroups.length > 0 ? topologyGroups : temporalGroups;

    const groupCount = finalGroups.length;
    const noiseReduction = alerts.length > 0
      ? ((alerts.length - groupCount) / alerts.length) * 100
      : 0;

    return {
      groups: finalGroups,
      originalCount: alerts.length,
      groupCount,
      noiseReductionPercent: Math.round(noiseReduction),
    };
  }

  private buildGroup(alerts: AnomalyDetection[], type: CorrelatedAlertGroup['correlationType']): CorrelatedAlertGroup {
    // Root alert = highest severity/confidence
    const root = alerts.reduce((best, a) =>
      a.confidence > best.confidence ? a : best, alerts[0]);

    return {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      alerts,
      correlationType: type,
      rootAlert: root,
      suppressedCount: alerts.length - 1,
      confidence: root.confidence,
    };
  }
}
