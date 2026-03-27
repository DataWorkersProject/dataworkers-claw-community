/**
 * DbtLineageParser — extract lineage from dbt manifest.json and SQL parsing.
 * Auto-maintained lineage from dbt manifest + SQL parsing.
 */

import type { GraphPersister, PersistResult } from '../crawlers/graph-persister.js';
import type { DataAsset } from '../types.js';

export interface DbtLineagePersistResult {
  assetsPersisted: PersistResult;
  lineageEdgesPersisted: number;
  columnLineageEdgesPersisted: number;
}

export interface DbtModel {
  uniqueId: string;
  name: string;
  schema: string;
  database: string;
  dependsOn: string[];
  columns: Array<{ name: string; type?: string; description?: string }>;
  description?: string;
  tags?: string[];
}

export interface DbtLineageEdge {
  sourceId: string;
  targetId: string;
  relationship: 'depends_on';
}

export interface DbtColumnLineage {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  transformation: string;
}

export interface DbtManifest {
  nodes: Record<string, {
    unique_id: string;
    name: string;
    schema: string;
    database: string;
    depends_on?: { nodes?: string[] };
    columns?: Record<string, { name: string; data_type?: string; description?: string }>;
    description?: string;
    tags?: string[];
    raw_code?: string;
  }>;
  sources?: Record<string, {
    unique_id: string;
    name: string;
    schema: string;
    database: string;
    columns?: Record<string, { name: string; data_type?: string; description?: string }>;
    description?: string;
  }>;
}

export class DbtLineageParser {
  /**
   * Parse a dbt manifest.json and extract models with their dependencies.
   */
  parseManifest(manifest: DbtManifest): DbtModel[] {
    const models: DbtModel[] = [];

    for (const [, node] of Object.entries(manifest.nodes)) {
      if (!node.unique_id.startsWith('model.') && !node.unique_id.startsWith('seed.') && !node.unique_id.startsWith('snapshot.')) {
        continue;
      }

      const columns = node.columns
        ? Object.values(node.columns).map(c => ({
            name: c.name,
            type: c.data_type,
            description: c.description,
          }))
        : [];

      models.push({
        uniqueId: node.unique_id,
        name: node.name,
        schema: node.schema,
        database: node.database,
        dependsOn: node.depends_on?.nodes ?? [],
        columns,
        description: node.description,
        tags: node.tags,
      });
    }

    // Add sources
    if (manifest.sources) {
      for (const [, source] of Object.entries(manifest.sources)) {
        const columns = source.columns
          ? Object.values(source.columns).map(c => ({
              name: c.name,
              type: c.data_type,
              description: c.description,
            }))
          : [];

        models.push({
          uniqueId: source.unique_id,
          name: source.name,
          schema: source.schema,
          database: source.database,
          dependsOn: [],
          columns,
          description: source.description,
        });
      }
    }

    return models;
  }

  /**
   * Extract lineage edges from parsed models.
   */
  extractLineageEdges(models: DbtModel[]): DbtLineageEdge[] {
    const edges: DbtLineageEdge[] = [];
    for (const model of models) {
      for (const dep of model.dependsOn) {
        edges.push({
          sourceId: dep,
          targetId: model.uniqueId,
          relationship: 'depends_on',
        });
      }
    }
    return edges;
  }

  /**
   * Extract column lineage from SQL using simple regex-based parsing.
   * Handles common patterns: SELECT col FROM table, JOIN ON col, etc.
   */
  extractColumnLineageFromSQL(
    sql: string,
    targetTable: string,
  ): DbtColumnLineage[] {
    const lineage: DbtColumnLineage[] = [];
    if (!sql) return lineage;

    const normalizedSQL = sql.replace(/\s+/g, ' ').trim();

    // Extract FROM/JOIN table references
    const tableRefs: string[] = [];
    const fromMatch = normalizedSQL.match(/\bFROM\s+(\w+(?:\.\w+)*)/gi);
    if (fromMatch) {
      for (const m of fromMatch) {
        const table = m.replace(/^FROM\s+/i, '').split('.').pop() ?? '';
        if (table) tableRefs.push(table);
      }
    }
    const joinMatch = normalizedSQL.match(/\bJOIN\s+(\w+(?:\.\w+)*)/gi);
    if (joinMatch) {
      for (const m of joinMatch) {
        const table = m.replace(/^JOIN\s+/i, '').split('.').pop() ?? '';
        if (table) tableRefs.push(table);
      }
    }

    // Extract column references from SELECT clause
    const selectMatch = normalizedSQL.match(/SELECT\s+(.*?)\s+FROM/i);
    if (selectMatch) {
      const selectClause = selectMatch[1];
      const columns = selectClause.split(',').map(c => c.trim());

      for (const col of columns) {
        if (col === '*') continue;

        // Handle table.column AS alias
        const aliasMatch = col.match(/(?:(\w+)\.)?(\w+)\s+(?:AS\s+)?(\w+)/i);
        if (aliasMatch) {
          const sourceTable = aliasMatch[1] || tableRefs[0] || 'unknown';
          const sourceColumn = aliasMatch[2];
          const targetColumn = aliasMatch[3];
          lineage.push({
            sourceTable,
            sourceColumn,
            targetTable,
            targetColumn,
            transformation: 'alias',
          });
          continue;
        }

        // Handle table.column
        const qualifiedMatch = col.match(/(\w+)\.(\w+)/);
        if (qualifiedMatch) {
          lineage.push({
            sourceTable: qualifiedMatch[1],
            sourceColumn: qualifiedMatch[2],
            targetTable,
            targetColumn: qualifiedMatch[2],
            transformation: 'direct',
          });
          continue;
        }

        // Handle bare column name
        const bareCol = col.match(/^(\w+)$/);
        if (bareCol) {
          lineage.push({
            sourceTable: tableRefs[0] || 'unknown',
            sourceColumn: bareCol[1],
            targetTable,
            targetColumn: bareCol[1],
            transformation: 'direct',
          });
        }
      }
    }

    return lineage;
  }

  /**
   * Parse a dbt manifest and persist all models, lineage edges, and
   * SQL-derived column lineage to the graph DB via a GraphPersister.
   */
  async persistToGraph(
    manifest: DbtManifest,
    customerId: string,
    graphPersister: GraphPersister,
  ): Promise<DbtLineagePersistResult> {
    const models = this.parseManifest(manifest);
    const edges = this.extractLineageEdges(models);

    // Convert DbtModels to DataAssets for graph persistence
    const now = Date.now();
    const assets: DataAsset[] = models.map(model => ({
      id: model.uniqueId,
      customerId,
      name: model.name,
      type: model.uniqueId.startsWith('source.') ? 'source' as const : 'model' as const,
      platform: 'dbt',
      database: model.database,
      schema: model.schema,
      description: model.description ?? '',
      columns: model.columns.map(c => ({
        name: c.name,
        type: c.type ?? 'unknown',
        description: c.description ?? '',
        nullable: true,
        isPrimaryKey: false,
        tags: [],
      })),
      tags: model.tags ?? [],
      qualityScore: 0,
      freshnessScore: 0,
      lastUpdated: now,
      lastCrawled: now,
      metadata: {},
    }));

    // Persist assets
    const assetsPersisted = await graphPersister.persistAssets(assets);

    // Persist lineage edges
    const lineageEdgesPersisted = await graphPersister.persistLineageEdges(
      edges.map(e => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        relationship: e.relationship,
      })),
    );

    // Extract and persist column lineage from SQL
    let columnLineageEdgesPersisted = 0;
    for (const [, node] of Object.entries(manifest.nodes)) {
      if (node.raw_code) {
        const colLineage = this.extractColumnLineageFromSQL(node.raw_code, node.name);
        if (colLineage.length > 0) {
          columnLineageEdgesPersisted += await graphPersister.persistColumnLineage(colLineage);
        }
      }
    }

    return {
      assetsPersisted,
      lineageEdgesPersisted,
      columnLineageEdgesPersisted,
    };
  }
}
