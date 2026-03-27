/**
 * @data-workers/medallion — Layer Registry
 *
 * Maps Medallion layers to platform locations.
 * Tracks which tables live in which layer and resolves
 * fully-qualified platform locations.
 */

import type { MedallionLayer, LayerMapping } from './types.js';

const LAYER_ORDER: Record<MedallionLayer, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
};

export class LayerRegistry {
  private mappings: Map<string, LayerMapping> = new Map();

  private key(layer: MedallionLayer, table: string): string {
    return `${layer}:${table}`;
  }

  /** Register a table mapping in a specific layer. */
  register(mapping: LayerMapping): void {
    this.mappings.set(this.key(mapping.layer, mapping.table), mapping);
  }

  /** Resolve a table's mapping within a layer. */
  resolve(layer: MedallionLayer, table: string): LayerMapping | undefined {
    return this.mappings.get(this.key(layer, table));
  }

  /** Get all tables registered in a given layer. */
  getTablesInLayer(layer: MedallionLayer): LayerMapping[] {
    const results: LayerMapping[] = [];
    for (const [k, v] of this.mappings) {
      if (k.startsWith(`${layer}:`)) {
        results.push(v);
      }
    }
    return results;
  }

  /**
   * Find upstream (previous layer) and downstream (next layer) mappings
   * for a given table name.
   */
  getAdjacentLayers(table: string): {
    upstream?: LayerMapping;
    downstream?: LayerMapping;
  } {
    const bronze = this.resolve('bronze', table);
    const silver = this.resolve('silver', table);
    const gold = this.resolve('gold', table);

    // Find which layers this table exists in, then determine adjacency
    const existing: LayerMapping[] = [bronze, silver, gold].filter(
      (m): m is LayerMapping => m !== undefined
    );

    if (existing.length === 0) return {};

    // Sort by layer order
    existing.sort((a, b) => LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer]);

    // Return upstream/downstream relative to the lowest existing layer
    const lowest = existing[0];
    const highest = existing[existing.length - 1];

    const result: { upstream?: LayerMapping; downstream?: LayerMapping } = {};

    if (lowest.layer === 'silver') {
      result.upstream = bronze; // may be undefined
    } else if (lowest.layer === 'gold') {
      result.upstream = silver; // may be undefined
    }

    if (highest.layer === 'bronze') {
      result.downstream = silver; // may be undefined
    } else if (highest.layer === 'silver') {
      result.downstream = gold; // may be undefined
    }

    // If multiple layers exist, upstream = the one before highest, downstream = the one after lowest
    if (existing.length >= 2) {
      result.upstream = existing[existing.length - 2];
      result.downstream = existing[1];
    }

    return result;
  }

  /**
   * Validate that a promotion follows the correct layer order.
   * Only bronze→silver and silver→gold are valid.
   */
  validatePromotionOrder(
    source: MedallionLayer,
    target: MedallionLayer
  ): boolean {
    return LAYER_ORDER[target] - LAYER_ORDER[source] === 1;
  }

  /** Seed the registry with example table mappings. */
  seed(): void {
    const tables = [
      {
        name: 'events',
        partitionKeys: ['event_date'],
        clusterKeys: ['event_type'],
      },
      {
        name: 'users',
        partitionKeys: ['created_date'],
        clusterKeys: ['country'],
      },
      {
        name: 'orders',
        partitionKeys: ['order_date'],
        clusterKeys: ['status'],
      },
      {
        name: 'products',
        partitionKeys: ['category'],
        clusterKeys: ['brand'],
      },
    ];

    const layers: MedallionLayer[] = ['bronze', 'silver', 'gold'];

    for (const table of tables) {
      for (const layer of layers) {
        this.register({
          layer,
          table: table.name,
          platform: 'iceberg',
          location: `${layer}_db.default.${table.name}`,
          partitionKeys: table.partitionKeys,
          clusterKeys: table.clusterKeys,
        });
      }
    }
  }
}
