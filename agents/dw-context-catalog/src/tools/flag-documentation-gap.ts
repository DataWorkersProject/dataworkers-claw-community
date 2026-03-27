/**
 * flag_documentation_gap MCP tool — scans for missing/stale documentation.
 * Identifies datasets with no description, stale docs, missing column
 * documentation, or no owner. Optionally records placeholder ticket entries.
 *
 * dryRun defaults to true — no tickets created unless explicitly opted in.
 * maxTickets is capped at 50.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { graphDB } from '../backends.js';

export type GapType = 'no_description' | 'stale_description' | 'missing_column_docs' | 'no_owner';
export type GapSeverity = 'high' | 'medium' | 'low';

export interface DocumentationGap {
  datasetId: string;
  table: string;
  gapType: GapType;
  severity: GapSeverity;
  lastUpdated?: number;
  columnsMissing?: number;
  ticketCreated?: boolean;
}

export const flagDocumentationGapDefinition: ToolDefinition = {
  name: 'flag_documentation_gap',
  description:
    'Scan for missing or stale documentation across cataloged datasets. ' +
    'Identifies tables with no description, stale descriptions, missing column docs, or no owner. ' +
    'Optionally creates placeholder ticket entries (dry-run by default).',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: {
        type: 'string',
        description: 'Optional customer ID to scope the scan.',
      },
      scope: {
        type: 'string',
        enum: ['all', 'database', 'schema'],
        description: "Scan scope. Default: 'all'.",
      },
      target: {
        type: 'string',
        description: "Database or schema name when scope is 'database' or 'schema'.",
      },
      staleDays: {
        type: 'number',
        description: 'Number of days after which a description is considered stale. Default: 90.',
      },
      minColumns: {
        type: 'number',
        description: 'Only flag tables with at least this many columns. Default: 5.',
      },
      createTickets: {
        type: 'boolean',
        description: 'Whether to create placeholder ticket entries. Default: false.',
      },
      maxTickets: {
        type: 'number',
        description: 'Maximum number of tickets to create. Default: 10, max: 50.',
      },
      dryRun: {
        type: 'boolean',
        description: 'When true, no tickets are created regardless of createTickets. Default: true.',
      },
    },
    required: [],
  },
};

/** Generic descriptions that count as "empty". */
const GENERIC_DESCRIPTIONS = new Set([
  '',
  'no description',
  'n/a',
  'tbd',
  'todo',
  'placeholder',
  'description pending',
]);

function isEmptyOrGeneric(desc: unknown): boolean {
  if (desc === null || desc === undefined) return true;
  const s = String(desc).trim().toLowerCase();
  return s.length === 0 || GENERIC_DESCRIPTIONS.has(s);
}

export const flagDocumentationGapHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('flag_documentation_gap')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'flag_documentation_gap' }) }],
      isError: true,
    };
  }

  const customerId = args.customerId as string | undefined;
  const scope = (args.scope as string) ?? 'all';
  const target = args.target as string | undefined;
  const staleDays = (args.staleDays as number) ?? 90;
  const minColumns = (args.minColumns as number) ?? 5;
  const createTickets = (args.createTickets as boolean) ?? false;
  const rawMaxTickets = (args.maxTickets as number) ?? 10;
  const maxTickets = Math.min(Math.max(rawMaxTickets, 0), 50);
  const dryRun = (args.dryRun as boolean) ?? true;

  try {
    // 1. Get all nodes from graphDB
    const allNodes = await graphDB.getAllNodes();

    // Filter by customerId
    const customerNodes = customerId
      ? allNodes.filter((n) => n.customerId === customerId)
      : allNodes;

    // Filter by scope/target
    const scopedNodes = customerNodes.filter((node) => {
      if (scope === 'database' && target) {
        const db = node.properties.database ?? node.properties.dataset;
        return String(db ?? '').toLowerCase() === target.toLowerCase();
      }
      if (scope === 'schema' && target) {
        return String(node.properties.schema ?? '').toLowerCase() === target.toLowerCase();
      }
      return true; // 'all'
    });

    const now = Date.now();
    const staleThresholdMs = staleDays * 24 * 60 * 60 * 1000;

    const gaps: DocumentationGap[] = [];
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 2. Analyse each node for documentation gaps
    for (const node of scopedNodes) {
      const description = node.properties.description;
      const columns = Array.isArray(node.properties.columns) ? node.properties.columns : [];
      const owner = node.properties.owner;
      const lastUpdated = typeof node.properties.lastUpdated === 'number'
        ? node.properties.lastUpdated
        : undefined;

      // Count downstream consumers for severity classification
      const downstream = await graphDB.traverseDownstream(node.id, 1);
      const consumerCount = downstream.length;

      // Check: no_description
      if (isEmptyOrGeneric(description)) {
        const severity: GapSeverity = consumerCount >= 3 ? 'high' : consumerCount >= 1 ? 'medium' : 'low';
        gaps.push({
          datasetId: node.id,
          table: node.name,
          gapType: 'no_description',
          severity,
          lastUpdated,
        });
      }

      // Check: stale_description (only if description exists and is not empty)
      if (!isEmptyOrGeneric(description) && lastUpdated && (now - lastUpdated) > staleThresholdMs) {
        gaps.push({
          datasetId: node.id,
          table: node.name,
          gapType: 'stale_description',
          severity: 'medium',
          lastUpdated,
        });
      }

      // Check: missing_column_docs (only for tables with >= minColumns columns)
      if (columns.length >= minColumns) {
        const columnsWithoutDesc = columns.filter((col: unknown) => {
          if (typeof col !== 'object' || col === null) return true;
          const c = col as Record<string, unknown>;
          return isEmptyOrGeneric(c.description);
        });
        const missingRatio = columnsWithoutDesc.length / columns.length;
        if (missingRatio > 0.5) {
          gaps.push({
            datasetId: node.id,
            table: node.name,
            gapType: 'missing_column_docs',
            severity: 'medium',
            lastUpdated,
            columnsMissing: columnsWithoutDesc.length,
          });
        }
      }

      // Check: no_owner
      if (owner === null || owner === undefined || String(owner).trim() === '') {
        gaps.push({
          datasetId: node.id,
          table: node.name,
          gapType: 'no_owner',
          severity: 'low',
          lastUpdated,
        });
      }
    }

    // Sort: high first, then medium, then low
    const severityOrder: Record<GapSeverity, number> = { high: 0, medium: 1, low: 2 };
    gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // 3. Optionally create placeholder ticket entries
    let ticketsCreated = 0;

    if (createTickets && !dryRun) {
      for (const gap of gaps) {
        if (ticketsCreated >= maxTickets) break;

        // Record placeholder ticket (do NOT call Linear API)
        gap.ticketCreated = true;
        ticketsCreated++;

        // Log for observability
        console.log(
          `[flag_documentation_gap] Ticket placeholder: ${gap.gapType} for ${gap.table} (${gap.severity})`,
        );
      }
    }

    const summary = {
      totalScanned: scopedNodes.length,
      totalGaps: gaps.length,
      highSeverity: gaps.filter((g) => g.severity === 'high').length,
      mediumSeverity: gaps.filter((g) => g.severity === 'medium').length,
      lowSeverity: gaps.filter((g) => g.severity === 'low').length,
      ticketsCreated,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ scanId, gaps, summary }, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          }),
        },
      ],
      isError: true,
    };
  }
};
