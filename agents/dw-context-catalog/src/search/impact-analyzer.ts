/**
 * ImpactAnalyzer — blast radius analysis for data assets.
 * Quantifies downstream impact before schema changes, deprecations, or migrations.
 * Column-level analysis, PR diff parsing, cross-platform blast radius.
 */

import type { IGraphDB } from '@data-workers/infrastructure-stubs';
import { ColumnLineageExpander } from './column-lineage-expander.js';

export type ImpactSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ChangeType =
  | 'column_drop'
  | 'column_rename'
  | 'column_type_change'
  | 'table_drop'
  | 'model_refactor'
  | 'pr_diff';

export interface ImpactResult {
  assetId: string;
  assetName: string;
  severity: ImpactSeverity;
  downstreamCount: number;
  affectedByDepth: Array<{ depth: number; count: number; assets: string[] }>;
  affectedConsumers: Array<{ id: string; name: string; type: string }>;
  dashboardsAffected: number;
  modelsAffected: number;
  pipelinesAffected: number;
  estimatedUsersAffected: number;
  recommendation: string;
}

export interface Stakeholder {
  assetId: string;
  assetName: string;
  type: string;
  owner?: string;
  platform: string;
}

export interface ColumnImpactResult extends ImpactResult {
  columnName: string;
  changeType: ChangeType;
  columnDownstreamCount: number;
  affectedColumns: Array<{
    table: string;
    column: string;
    transformation?: string;
    confidence: number;
  }>;
  stakeholders: Stakeholder[];
  crossPlatformImpact: Array<{ platform: string; assetCount: number }>;
  degradedToTableLevel: boolean;
}

export interface PrDiffChange {
  assetId: string;
  columnName?: string;
  changeType: ChangeType;
}

export interface PrDiffImpactResult {
  changes: PrDiffChange[];
  impacts: ColumnImpactResult[];
  aggregateSeverity: ImpactSeverity;
  totalDownstream: number;
  summary: string;
}

export class ImpactAnalyzer {
  /**
   * Analyze the downstream impact of changing an asset.
   */
  async analyzeImpact(
    assetId: string,
    customerId: string,
    graphDB: IGraphDB,
    maxDepth: number = 5,
  ): Promise<ImpactResult> {
    const node = (await graphDB.getNode(assetId))
      ?? (await graphDB.findByName(assetId, customerId))[0];

    if (!node) {
      return {
        assetId,
        assetName: assetId,
        severity: 'LOW',
        downstreamCount: 0,
        affectedByDepth: [],
        affectedConsumers: [],
        dashboardsAffected: 0,
        modelsAffected: 0,
        pipelinesAffected: 0,
        estimatedUsersAffected: 0,
        recommendation: `Asset '${assetId}' not found in the catalog. No impact detected.`,
      };
    }

    // Traverse downstream to compute blast radius
    const allDownstream = await graphDB.traverseDownstream(node.id, maxDepth);

    // Group by depth
    const byDepth = new Map<number, Array<{ node: { id: string; name: string; type: string }; depth: number }>>();
    for (const entry of allDownstream) {
      const depth = entry.depth;
      if (!byDepth.has(depth)) byDepth.set(depth, []);
      byDepth.get(depth)!.push(entry);
    }

    const affectedByDepth = Array.from(byDepth.entries())
      .sort(([a], [b]) => a - b)
      .map(([depth, entries]) => ({
        depth,
        count: entries.length,
        assets: entries.map(e => e.node.name),
      }));

    // Categorize affected consumers
    const consumers = allDownstream.map(e => ({
      id: e.node.id,
      name: e.node.name,
      type: e.node.type,
    }));

    const dashboardsAffected = consumers.filter(c =>
      c.type === 'dashboard' || c.type === 'report',
    ).length;

    const modelsAffected = consumers.filter(c =>
      c.type === 'model' || c.type === 'view',
    ).length;

    const pipelinesAffected = consumers.filter(c =>
      c.type === 'pipeline' || c.type === 'dag',
    ).length;

    // Estimate users: dashboards * ~15 users each, models * ~5 engineers
    const estimatedUsersAffected = dashboardsAffected * 15 + modelsAffected * 5 + pipelinesAffected * 3;

    const downstreamCount = allDownstream.length;
    const severity = this.computeSeverity(downstreamCount, dashboardsAffected);

    const recommendation = this.generateRecommendation(
      node.name,
      severity,
      downstreamCount,
      dashboardsAffected,
      modelsAffected,
    );

    return {
      assetId: node.id,
      assetName: node.name,
      severity,
      downstreamCount,
      affectedByDepth,
      affectedConsumers: consumers,
      dashboardsAffected,
      modelsAffected,
      pipelinesAffected,
      estimatedUsersAffected,
      recommendation,
    };
  }

  /**
   * Analyze column-level impact for a specific column change.
   * Gracefully degrades to table-level when column lineage is unavailable.
   */
  async analyzeColumnImpact(
    assetId: string,
    columnName: string,
    changeType: ChangeType,
    customerId: string,
    graphDB: IGraphDB,
    maxDepth: number = 5,
  ): Promise<ColumnImpactResult> {
    // Start with table-level impact
    const tableImpact = await this.analyzeImpact(assetId, customerId, graphDB, maxDepth);

    const expander = new ColumnLineageExpander();
    let degradedToTableLevel = false;
    const affectedColumns: ColumnImpactResult['affectedColumns'] = [];

    try {
      // Trace column lineage downstream through all affected assets
      const allAffectedIds = [tableImpact.assetId, ...tableImpact.affectedConsumers.map(c => c.id)];
      for (const consumerId of allAffectedIds) {
        const lineage = await expander.getColumnLineage(consumerId, graphDB);
        // Find lineage edges that reference our column as a source
        const matching = lineage.filter(
          l => l.sourceColumn.toLowerCase() === columnName.toLowerCase()
            && (l.sourceTable === tableImpact.assetName || l.sourceTable === assetId),
        );
        for (const edge of matching) {
          affectedColumns.push({
            table: edge.targetTable,
            column: edge.targetColumn,
            transformation: edge.transformation,
            confidence: edge.confidence,
          });
        }
      }
    } catch {
      // Column lineage unavailable — degrade gracefully
      degradedToTableLevel = true;
    }

    if (affectedColumns.length === 0) {
      degradedToTableLevel = true;
    }

    // Identify stakeholders from affected consumers
    const stakeholders = await this.identifyStakeholders(tableImpact, graphDB);

    // Cross-platform breakdown
    const platformMap = new Map<string, number>();
    for (const consumer of tableImpact.affectedConsumers) {
      const node = await graphDB.getNode(consumer.id);
      const platform = node?.platform ?? 'unknown';
      platformMap.set(platform, (platformMap.get(platform) ?? 0) + 1);
    }
    const crossPlatformImpact = Array.from(platformMap.entries()).map(
      ([platform, assetCount]) => ({ platform, assetCount }),
    );

    return {
      ...tableImpact,
      columnName,
      changeType,
      columnDownstreamCount: affectedColumns.length,
      affectedColumns,
      stakeholders,
      crossPlatformImpact,
      degradedToTableLevel,
    };
  }

  /**
   * Parse a unified PR diff to extract schema changes (column drops, renames, type changes).
   */
  parsePrDiff(diff: string): PrDiffChange[] {
    const changes: PrDiffChange[] = [];
    const lines = diff.split('\n');

    let currentFile = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track current file from diff headers
      const fileMatch = line.match(/^(?:---|\+\+\+)\s+[ab]\/(.+)/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }

      // Detect SQL column drops: removed lines with column definitions
      // Pattern: -  column_name  type
      if (line.startsWith('-') && !line.startsWith('---')) {
        const removedLine = line.slice(1).trim();

        // SQL DDL column pattern: column_name DATA_TYPE
        const sqlColMatch = removedLine.match(/^(\w+)\s+(VARCHAR|INT|INTEGER|BIGINT|FLOAT|DOUBLE|DECIMAL|NUMERIC|BOOLEAN|BOOL|DATE|TIMESTAMP|TEXT|STRING|CHAR|BINARY|ARRAY|MAP|STRUCT|JSON|VARIANT|NUMBER)/i);
        if (sqlColMatch) {
          const columnName = sqlColMatch[1];
          // Check if this column exists in added lines (rename/type change)
          const addedLine = lines[i + 1]?.startsWith('+') ? lines[i + 1].slice(1).trim() : '';
          const addedColMatch = addedLine.match(/^(\w+)\s+(VARCHAR|INT|INTEGER|BIGINT|FLOAT|DOUBLE|DECIMAL|NUMERIC|BOOLEAN|BOOL|DATE|TIMESTAMP|TEXT|STRING|CHAR|BINARY|ARRAY|MAP|STRUCT|JSON|VARIANT|NUMBER)/i);

          if (addedColMatch) {
            if (addedColMatch[1].toLowerCase() !== columnName.toLowerCase()) {
              changes.push({
                assetId: this.fileToAssetId(currentFile),
                columnName,
                changeType: 'column_rename',
              });
            } else if (addedColMatch[2].toLowerCase() !== sqlColMatch[2].toLowerCase()) {
              changes.push({
                assetId: this.fileToAssetId(currentFile),
                columnName,
                changeType: 'column_type_change',
              });
            }
          } else {
            changes.push({
              assetId: this.fileToAssetId(currentFile),
              columnName,
              changeType: 'column_drop',
            });
          }
          continue;
        }

        // dbt schema.yml column removal pattern: - name: column_name
        const yamlColMatch = removedLine.match(/^-?\s*name:\s*(\w+)/);
        if (yamlColMatch && !removedLine.includes('model') && !removedLine.includes('source')) {
          changes.push({
            assetId: this.fileToAssetId(currentFile),
            columnName: yamlColMatch[1],
            changeType: 'column_drop',
          });
          continue;
        }

        // DROP TABLE detection
        if (removedLine.match(/DROP\s+TABLE/i) || removedLine.match(/^-?\s*(?:models|sources).*:/)) {
          // Table-level drop detected
        }
      }

      // Detect DROP TABLE statements in added lines (migration files)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const addedLine = line.slice(1).trim();
        const dropTableMatch = addedLine.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\S+)/i);
        if (dropTableMatch) {
          changes.push({
            assetId: dropTableMatch[1].replace(/[`"[\]]/g, ''),
            changeType: 'table_drop',
          });
        }

        // ALTER TABLE DROP COLUMN
        const alterDropMatch = addedLine.match(/ALTER\s+TABLE\s+(\S+)\s+DROP\s+COLUMN\s+(\S+)/i);
        if (alterDropMatch) {
          changes.push({
            assetId: alterDropMatch[1].replace(/[`"[\]]/g, ''),
            columnName: alterDropMatch[2].replace(/[`"[\];,]/g, ''),
            changeType: 'column_drop',
          });
        }

        // ALTER TABLE RENAME COLUMN
        const alterRenameMatch = addedLine.match(/ALTER\s+TABLE\s+(\S+)\s+RENAME\s+COLUMN\s+(\S+)/i);
        if (alterRenameMatch) {
          changes.push({
            assetId: alterRenameMatch[1].replace(/[`"[\]]/g, ''),
            columnName: alterRenameMatch[2].replace(/[`"[\];,]/g, ''),
            changeType: 'column_rename',
          });
        }

        // ALTER TABLE ALTER COLUMN (type change)
        const alterTypeMatch = addedLine.match(/ALTER\s+TABLE\s+(\S+)\s+ALTER\s+COLUMN\s+(\S+)\s+(?:SET\s+DATA\s+)?TYPE/i);
        if (alterTypeMatch) {
          changes.push({
            assetId: alterTypeMatch[1].replace(/[`"[\]]/g, ''),
            columnName: alterTypeMatch[2].replace(/[`"[\];,]/g, ''),
            changeType: 'column_type_change',
          });
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return changes.filter(c => {
      const key = `${c.assetId}:${c.columnName ?? ''}:${c.changeType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Run impact analysis on all changes extracted from a PR diff.
   */
  async analyzePrDiff(
    diff: string,
    customerId: string,
    graphDB: IGraphDB,
    maxDepth: number = 5,
  ): Promise<PrDiffImpactResult> {
    const changes = this.parsePrDiff(diff);
    const impacts: ColumnImpactResult[] = [];

    for (const change of changes) {
      if (change.columnName) {
        const impact = await this.analyzeColumnImpact(
          change.assetId,
          change.columnName,
          change.changeType,
          customerId,
          graphDB,
          maxDepth,
        );
        impacts.push(impact);
      } else {
        // Table-level change — wrap as ColumnImpactResult
        const tableImpact = await this.analyzeImpact(change.assetId, customerId, graphDB, maxDepth);
        const stakeholders = await this.identifyStakeholders(tableImpact, graphDB);
        const platformMap = new Map<string, number>();
        for (const consumer of tableImpact.affectedConsumers) {
          const node = await graphDB.getNode(consumer.id);
          const platform = node?.platform ?? 'unknown';
          platformMap.set(platform, (platformMap.get(platform) ?? 0) + 1);
        }
        impacts.push({
          ...tableImpact,
          columnName: '*',
          changeType: change.changeType,
          columnDownstreamCount: tableImpact.downstreamCount,
          affectedColumns: [],
          stakeholders,
          crossPlatformImpact: Array.from(platformMap.entries()).map(
            ([platform, assetCount]) => ({ platform, assetCount }),
          ),
          degradedToTableLevel: true,
        });
      }
    }

    const totalDownstream = impacts.reduce((sum, i) => sum + i.downstreamCount, 0);
    const severities: ImpactSeverity[] = impacts.map(i => i.severity);
    const aggregateSeverity = this.aggregateSeverity(severities);

    const summary = changes.length === 0
      ? 'No schema changes detected in the PR diff.'
      : `PR contains ${changes.length} schema change(s) affecting ${totalDownstream} downstream asset(s). Aggregate severity: ${aggregateSeverity}.`;

    return {
      changes,
      impacts,
      aggregateSeverity,
      totalDownstream,
      summary,
    };
  }

  /**
   * Identify stakeholders (owners, dashboards, SLAs) for affected assets.
   */
  private async identifyStakeholders(
    impact: ImpactResult,
    graphDB: IGraphDB,
  ): Promise<Stakeholder[]> {
    const stakeholders: Stakeholder[] = [];
    const seen = new Set<string>();

    for (const consumer of impact.affectedConsumers) {
      if (seen.has(consumer.id)) continue;
      seen.add(consumer.id);

      const node = await graphDB.getNode(consumer.id);
      stakeholders.push({
        assetId: consumer.id,
        assetName: consumer.name,
        type: consumer.type,
        owner: (node?.properties?.owner as string) ?? undefined,
        platform: node?.platform ?? 'unknown',
      });
    }

    return stakeholders;
  }

  /**
   * Convert file path from diff to approximate asset ID.
   */
  private fileToAssetId(filePath: string): string {
    // Strip path and extension to derive an asset name
    const base = filePath.split('/').pop() ?? filePath;
    return base.replace(/\.(sql|yml|yaml|py|json)$/i, '');
  }

  /**
   * Pick the worst severity from a list.
   */
  private aggregateSeverity(severities: ImpactSeverity[]): ImpactSeverity {
    if (severities.includes('CRITICAL')) return 'CRITICAL';
    if (severities.includes('HIGH')) return 'HIGH';
    if (severities.includes('MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  private computeSeverity(downstreamCount: number, dashboardsAffected: number): ImpactSeverity {
    if (downstreamCount > 10 && dashboardsAffected > 0) return 'CRITICAL';
    if (downstreamCount > 5 || dashboardsAffected > 0) return 'HIGH';
    if (downstreamCount >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private generateRecommendation(
    assetName: string,
    severity: ImpactSeverity,
    downstreamCount: number,
    dashboardsAffected: number,
    modelsAffected: number,
  ): string {
    if (severity === 'CRITICAL') {
      return `CRITICAL: Changes to '${assetName}' will affect ${downstreamCount} downstream assets including ${dashboardsAffected} dashboard(s). Coordinate with all stakeholders, test in shadow mode, and plan a maintenance window.`;
    }
    if (severity === 'HIGH') {
      return `HIGH: '${assetName}' feeds ${downstreamCount} downstream assets${dashboardsAffected > 0 ? ` including ${dashboardsAffected} dashboard(s)` : ''}. Notify downstream owners and validate with integration tests before deploying.`;
    }
    if (severity === 'MEDIUM') {
      return `MEDIUM: '${assetName}' has ${downstreamCount} downstream dependencies (${modelsAffected} model(s)). Run regression tests on affected models after changes.`;
    }
    return `LOW: '${assetName}' has minimal downstream impact (${downstreamCount} dependent(s)). Safe to modify with standard testing.`;
  }
}
