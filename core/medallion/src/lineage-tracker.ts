/**
 * @data-workers/medallion — Lineage Tracker
 *
 * Cross-layer lineage graph.
 * Tracks promotes_to relations between layers and tables.
 */

import type {
  MedallionLayer,
  PromotionResult,
  LineageEdge,
} from './types.js';

export class LineageTracker {
  private edges: LineageEdge[] = [];
  private promotionHistory: Map<string, PromotionResult[]> = new Map();

  /**
   * Record a promotion in the lineage graph.
   * Returns the lineage edge ID.
   */
  trackPromotion(result: PromotionResult): string {
    const edgeId = `lineage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const edge: LineageEdge = {
      id: edgeId,
      sourceLayer: result.rule.sourceLayer,
      sourceTable: result.rule.sourceTable,
      targetLayer: result.rule.targetLayer,
      targetTable: result.rule.targetTable,
      promotionId: result.promotionId,
      timestamp: result.timestamp,
    };

    this.edges.push(edge);

    // Track history per table
    const sourceKey = `${result.rule.sourceLayer}:${result.rule.sourceTable}`;
    const targetKey = `${result.rule.targetLayer}:${result.rule.targetTable}`;

    for (const key of [sourceKey, targetKey]) {
      if (!this.promotionHistory.has(key)) {
        this.promotionHistory.set(key, []);
      }
      this.promotionHistory.get(key)!.push(result);
    }

    return edgeId;
  }

  /** Get promotion history for a specific table (across all layers). */
  getPromotionHistory(table: string): PromotionResult[] {
    const results: PromotionResult[] = [];

    for (const [key, history] of this.promotionHistory) {
      if (key.endsWith(`:${table}`)) {
        results.push(...history);
      }
    }

    // Deduplicate by promotionId
    const seen = new Set<string>();
    return results.filter((r) => {
      if (seen.has(r.promotionId)) return false;
      seen.add(r.promotionId);
      return true;
    });
  }

  /**
   * Trace a Gold table back to its Bronze source(s).
   * Follows lineage edges backward through the graph.
   */
  traceGoldToSource(
    goldTable: string
  ): Array<{ layer: MedallionLayer; table: string }> {
    const result: Array<{ layer: MedallionLayer; table: string }> = [];
    const visited = new Set<string>();

    const trace = (layer: MedallionLayer, table: string) => {
      const key = `${layer}:${table}`;
      if (visited.has(key)) return;
      visited.add(key);

      result.push({ layer, table });

      // Find edges that target this layer:table
      for (const edge of this.edges) {
        if (edge.targetLayer === layer && edge.targetTable === table) {
          trace(edge.sourceLayer, edge.sourceTable);
        }
      }
    };

    trace('gold', goldTable);
    return result;
  }

  /** Get all lineage edges. */
  getEdges(): LineageEdge[] {
    return [...this.edges];
  }
}
