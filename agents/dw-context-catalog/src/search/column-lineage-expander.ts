/**
 * ColumnLineageExpander — expand and score column-level lineage.
 * Column-level lineage expansion + lineage confidence scoring.
 */

import type { IGraphDB } from '@data-workers/infrastructure-stubs';
import type { ColumnLineage } from '../types.js';

export interface ColumnLineageWithConfidence extends ColumnLineage {
  confidence: number; // 0-1
  source: 'explicit' | 'inferred' | 'sql_parsed';
}

export interface LineageConfidenceScore {
  overall: number; // 0-1
  explicitEdges: number;
  inferredEdges: number;
  totalEdges: number;
  coverage: number; // % of columns with lineage
}

export class ColumnLineageExpander {
  /**
   * Get expanded column lineage for an asset, including inferred lineage.
   */
  async getColumnLineage(
    assetId: string,
    graphDB: IGraphDB,
  ): Promise<ColumnLineageWithConfidence[]> {
    const node = await graphDB.getNode(assetId);
    if (!node) return [];

    const result: ColumnLineageWithConfidence[] = [];

    // 1. Get explicit column lineage from graph edges
    const columnEdges = await graphDB.getColumnEdgesForNode(assetId);
    for (const edge of columnEdges) {
      const sourceNode = await graphDB.getNode(edge.source);
      result.push({
        sourceColumn: edge.properties.sourceColumn as string,
        sourceTable: sourceNode?.name ?? edge.source,
        targetColumn: edge.properties.targetColumn as string,
        targetTable: node.name,
        transformation: edge.properties.transformation as string | undefined,
        confidence: 1.0,
        source: 'explicit',
      });
    }

    // 2. Infer lineage from upstream assets with matching column names
    const upstream = await graphDB.traverseUpstream(assetId, 1);
    const targetColumns = (node.properties.columns as Array<{ name: string }>) ?? [];

    for (const upEntry of upstream) {
      const upNode = upEntry.node;
      const upColumns = (upNode.properties.columns as Array<{ name: string }>) ?? [];

      for (const targetCol of targetColumns) {
        // Check if this column already has explicit lineage
        const hasExplicit = result.some(
          r => r.targetColumn === targetCol.name && r.sourceTable === upNode.name,
        );
        if (hasExplicit) continue;

        // Look for matching column names in upstream
        const matchingUp = upColumns.find(
          uc => uc.name.toLowerCase() === targetCol.name.toLowerCase(),
        );
        if (matchingUp) {
          result.push({
            sourceColumn: matchingUp.name,
            sourceTable: upNode.name,
            targetColumn: targetCol.name,
            targetTable: node.name,
            transformation: 'direct',
            confidence: 0.7,
            source: 'inferred',
          });
        }
      }
    }

    return result;
  }

  /**
   * Compute confidence score for an asset's lineage completeness.
   */
  async computeConfidence(
    assetId: string,
    graphDB: IGraphDB,
  ): Promise<LineageConfidenceScore> {
    const lineage = await this.getColumnLineage(assetId, graphDB);
    const node = await graphDB.getNode(assetId);
    const columns = (node?.properties.columns as Array<{ name: string }>) ?? [];

    const explicitEdges = lineage.filter(l => l.source === 'explicit').length;
    const inferredEdges = lineage.filter(l => l.source !== 'explicit').length;
    const totalEdges = lineage.length;

    // Coverage: what % of target columns have at least one lineage edge
    const columnsWithLineage = new Set(lineage.map(l => l.targetColumn));
    const coverage = columns.length > 0
      ? columnsWithLineage.size / columns.length
      : totalEdges > 0 ? 1.0 : 0;

    // Overall confidence: weighted average of edge confidence + coverage
    const avgEdgeConfidence = totalEdges > 0
      ? lineage.reduce((sum, l) => sum + l.confidence, 0) / totalEdges
      : 0;
    const overall = totalEdges > 0
      ? avgEdgeConfidence * 0.6 + coverage * 0.4
      : 0;

    return {
      overall: Math.round(overall * 100) / 100,
      explicitEdges,
      inferredEdges,
      totalEdges,
      coverage: Math.round(coverage * 100) / 100,
    };
  }
}
