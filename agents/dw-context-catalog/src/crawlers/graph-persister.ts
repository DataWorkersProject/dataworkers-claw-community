/**
 * GraphPersister — persists crawled assets and lineage edges to the graph DB.
 * Wire crawlers to persist assets + lineage to graph DB.
 */

import type { IGraphDB } from '@data-workers/infrastructure-stubs';
import type { GraphNode } from '@data-workers/infrastructure-stubs';
import type { DataAsset } from '../types.js';

export interface PersistResult {
  nodesAdded: number;
  nodesUpdated: number;
  edgesAdded: number;
  durationMs: number;
}

export class GraphPersister {
  private graphDB: IGraphDB;

  constructor(graphDB: IGraphDB) {
    this.graphDB = graphDB;
  }

  /**
   * Persist a batch of crawled assets to the graph DB.
   */
  async persistAssets(assets: DataAsset[]): Promise<PersistResult> {
    const start = Date.now();
    let nodesAdded = 0;
    let nodesUpdated = 0;

    for (const asset of assets) {
      const existing = await this.graphDB.getNode(asset.id);
      const node: GraphNode = {
        id: asset.id,
        type: asset.type,
        name: asset.name,
        platform: asset.platform,
        properties: {
          description: asset.description,
          database: asset.database,
          schema: asset.schema,
          owner: asset.owner,
          tags: asset.tags,
          qualityScore: asset.qualityScore,
          freshnessScore: asset.freshnessScore,
          lastUpdated: asset.lastUpdated,
          lastCrawled: asset.lastCrawled,
          columns: asset.columns,
          ...asset.metadata,
        },
        customerId: asset.customerId,
      };

      if (existing) {
        // Update: remove old node and re-add with new data
        await this.graphDB.removeNode(asset.id);
        nodesUpdated++;
      } else {
        nodesAdded++;
      }
      await this.graphDB.addNode(node);
    }

    return {
      nodesAdded,
      nodesUpdated,
      edgesAdded: 0,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Persist lineage edges between assets.
   */
  async persistLineageEdges(
    edges: Array<{ sourceId: string; targetId: string; relationship: string; properties?: Record<string, unknown> }>,
  ): Promise<number> {
    let added = 0;
    for (const edge of edges) {
      // Only add if both nodes exist
      if ((await this.graphDB.getNode(edge.sourceId)) && (await this.graphDB.getNode(edge.targetId))) {
        await this.graphDB.addEdge({
          source: edge.sourceId,
          target: edge.targetId,
          relationship: edge.relationship,
          properties: edge.properties ?? {},
        });
        added++;
      }
    }
    return added;
  }

  /**
   * Persist column-level lineage edges.
   */
  async persistColumnLineage(
    columns: Array<{
      sourceTable: string;
      sourceColumn: string;
      targetTable: string;
      targetColumn: string;
      transformation?: string;
    }>,
  ): Promise<number> {
    let added = 0;
    for (const col of columns) {
      const sourceNode = (await this.graphDB.getNode(col.sourceTable))
        ?? (await this.graphDB.findByName(col.sourceTable))[0];
      const targetNode = (await this.graphDB.getNode(col.targetTable))
        ?? (await this.graphDB.findByName(col.targetTable))[0];

      if (sourceNode && targetNode) {
        await this.graphDB.addEdge({
          source: sourceNode.id,
          target: targetNode.id,
          relationship: 'column_lineage',
          properties: {
            sourceColumn: col.sourceColumn,
            targetColumn: col.targetColumn,
            transformation: col.transformation ?? 'direct',
          },
        });
        added++;
      }
    }
    return added;
  }
}
