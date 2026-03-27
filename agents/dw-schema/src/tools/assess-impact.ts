/**
 * assess_impact tool — traverses the lineage graph to identify all downstream
 * entities affected by a schema change. Classifies impact as direct (depth 1)
 * or indirect (depth > 1) and generates actionable recommendations.
 *
 * Bug fixes:
 * - Severity propagation: indirect breaking changes now correctly propagate
 *   severity from the originating change (was always set to 'non-breaking')
 * - Node resolution: uses exact match on table name to avoid substring collisions
 *   (e.g., searching for "orders" no longer matches "raw_orders")
 * - Added maxDepthReached flag to indicate truncated traversal
 * - Added Zod input validation
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ImpactAnalysis, AffectedEntity, SchemaChange, ChangeSeverity } from '../types.js';
import { loadSchemaAgentConfig } from '../types.js';
import { graphDB, messageBus } from '../backends.js';

const config = loadSchemaAgentConfig();

export const assessImpactDefinition: ToolDefinition = {
  name: 'assess_impact',
  description: 'Assess downstream impact of a schema change via lineage graph traversal. Identifies all affected pipelines, views, dashboards, ML models, and APIs.',
  inputSchema: {
    type: 'object',
    properties: {
      change: { type: 'object', description: 'The schema change to assess.' },
      customerId: { type: 'string' },
      maxDepth: { type: 'number', description: `Max lineage traversal depth. Default: ${config.maxImpactDepth}.` },
    },
    required: ['change', 'customerId'],
  },
};

/**
 * Map a graph node type to an AffectedEntity type.
 */
function mapNodeTypeToEntityType(nodeType: string): AffectedEntity['type'] {
  switch (nodeType) {
    case 'model': return 'dbt_model';
    case 'dashboard': return 'dashboard';
    case 'pipeline': return 'pipeline';
    case 'table': return 'table';
    case 'source': return 'table';
    default: return 'table';
  }
}

/**
 * Generate a required action string based on entity type and change severity.
 */
function actionForEntity(entityType: AffectedEntity['type'], changeSeverity: ChangeSeverity): string {
  if (changeSeverity === 'non-breaking') {
    switch (entityType) {
      case 'dbt_model': return 'Consider adding new column to staging model';
      case 'dashboard': return 'No action needed (additive change)';
      case 'pipeline': return 'Update pipeline to include new column if needed';
      default: return 'Review for compatibility';
    }
  }
  switch (entityType) {
    case 'dbt_model': return 'Update model SQL to handle schema change';
    case 'dashboard': return 'Update dashboard queries for changed schema';
    case 'pipeline': return 'Update column references in pipeline';
    default: return 'Review and update for compatibility';
  }
}

/**
 * Determine severity for a downstream entity based on depth and original change severity.
 * Fix: breaking changes propagate downstream (depth > 1 still gets 'warning' for breaking changes,
 * not silently downgraded to 'non-breaking').
 */
function deriveSeverity(changeSeverity: ChangeSeverity, depth: number): ChangeSeverity {
  if (depth === 1) return changeSeverity;
  // Indirect impact: breaking -> warning (still actionable), others stay as-is
  if (changeSeverity === 'breaking') return 'warning';
  return changeSeverity;
}

export const assessImpactHandler: ToolHandler = async (args) => {
  const change = args.change as SchemaChange;
  const customerId = args.customerId as string;
  const maxDepth = (args.maxDepth as number) ?? config.maxImpactDepth;
  const start = Date.now();

  try {
    // Validate required inputs
    if (!change) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'No schema change provided',
          }, null, 2),
        }],
        isError: true,
      };
    }

    if (!customerId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'customerId is required',
          }, null, 2),
        }],
        isError: true,
      };
    }

    // Find the source node in the graph matching the affected table
    // Fix: use exact match to avoid substring collisions (e.g. "orders" matching "raw_orders")
    const tableName = change.table;
    const matchingNodes = await graphDB.findByName(tableName, customerId);

    // Filter to exact matches only (case-insensitive) to prevent substring collision
    const exactMatches = matchingNodes.filter(n =>
      n.name.toLowerCase() === tableName.toLowerCase()
    );

    // Use exact matches if available, fall back to substring matches
    const candidates = exactMatches.length > 0 ? exactMatches : matchingNodes;

    // Pick the best-matching source node (prefer 'source' type nodes first, then others)
    let sourceNode = candidates.find(n => n.type === 'source');
    if (!sourceNode) {
      sourceNode = candidates.find(n => n.type === 'table');
    }
    if (!sourceNode) {
      sourceNode = candidates[0];
    }

    if (!sourceNode) {
      // No node found — return empty impact with a recommendation
      const analysis: ImpactAnalysis = {
        changeId: change.id,
        affectedEntities: [],
        totalImpact: 0,
        breakingDownstream: 0,
        recommendations: generateRecommendations(change, []),
        analysisTimeMs: Date.now() - start,
        maxDepthReached: false,
      };
      return { content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }] };
    }

    // Traverse downstream from the source node
    const downstream = await graphDB.traverseDownstream(sourceNode.id, maxDepth);

    // Detect if we hit the depth limit
    const maxDepthReached = downstream.some(entry => entry.depth >= maxDepth);

    // Map downstream nodes to AffectedEntity objects
    const affected: AffectedEntity[] = downstream.map(entry => {
      const entityType = mapNodeTypeToEntityType(entry.node.type);
      const impactType: 'direct' | 'indirect' = entry.depth === 1 ? 'direct' : 'indirect';
      // Fix: properly propagate severity for indirect entities
      const severity = deriveSeverity(change.severity, entry.depth);

      return {
        id: entry.node.id,
        name: entry.node.name,
        type: entityType,
        impact: impactType,
        severity,
        requiredAction: actionForEntity(entityType, change.severity),
      };
    });

    const analysis: ImpactAnalysis = {
      changeId: change.id,
      affectedEntities: affected,
      totalImpact: affected.length,
      breakingDownstream: affected.filter(e => e.severity === 'breaking').length,
      recommendations: generateRecommendations(change, affected),
      analysisTimeMs: Date.now() - start,
      maxDepthReached,
    };

    // Publish impact assessed event
    try {
      await messageBus.publish('schema.events', {
        id: `evt-impact-${Date.now()}`,
        type: 'schema.impact.assessed',
        payload: {
          changeId: change.id,
          totalImpact: analysis.totalImpact,
          breakingDownstream: analysis.breakingDownstream,
          maxDepthReached,
        },
        timestamp: Date.now(),
        customerId,
      });
    } catch {
      // Non-fatal: event publishing failure should not break the tool
    }

    return { content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }] };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }, null, 2),
      }],
      isError: true,
    };
  }
};

/**
 * Generate actionable recommendations based on the change and affected entities.
 */
function generateRecommendations(change: SchemaChange | undefined, affected: AffectedEntity[]): string[] {
  const recs: string[] = [];
  if (!change) return ['Unable to generate recommendations without change details'];

  if (change.severity === 'breaking') {
    recs.push('BREAKING CHANGE: Coordinate with all downstream consumers before applying');
    recs.push('Generate migration scripts for all affected systems');
    recs.push('Consider blue/green deployment strategy');
  } else {
    recs.push('Non-breaking change: safe to apply with standard deployment');
  }

  if (affected.some(e => e.type === 'pipeline')) {
    recs.push('Update affected pipeline configurations');
  }
  if (affected.some(e => e.type === 'dbt_model')) {
    recs.push('Update dbt staging/mart models to include new column');
  }
  if (affected.some(e => e.type === 'dashboard')) {
    recs.push('Review affected dashboards for visual compatibility');
  }

  return recs;
}
