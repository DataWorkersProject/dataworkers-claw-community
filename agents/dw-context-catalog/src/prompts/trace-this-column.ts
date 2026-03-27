/**
 * MCP Prompt: Trace This Column
 *
 * Guided workflow for column-level lineage tracing.
 * Template-only — not executable code.
 */

import type { PromptDefinition, PromptHandler } from '@data-workers/mcp-framework';

export const traceThisColumnDefinition: PromptDefinition = {
  name: 'trace-this-column',
  description: 'Guided workflow: trace where a column comes from across platforms and identify downstream impact.',
  arguments: [
    { name: 'table', description: 'Fully qualified table name (e.g. analytics.core.dim_customers)', required: true },
    { name: 'column', description: 'Column name to trace (e.g. lifetime_value)', required: true },
    { name: 'direction', description: 'Trace direction: "upstream" (sources), "downstream" (dependents), or "both" (default)', required: false },
  ],
};

export const traceThisColumnHandler: PromptHandler = async (args) => {
  const table = args.table ?? 'unknown_table';
  const column = args.column ?? 'unknown_column';
  const direction = args.direction ?? 'both';

  return {
    description: `Trace column ${table}.${column} lineage (${direction})`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Where does the column "${column}" in table "${table}" come from? Trace its lineage ${direction === 'both' ? 'in both directions' : direction}.`,
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            `I'll trace the lineage for \`${table}.${column}\`. Here's the approach:`,
            '',
            `**Step 1 — Column lineage:** Use \`trace_cross_platform_lineage\` to find the upstream sources that feed into \`${column}\`.`,
            `**Step 2 — Transformations:** Identify any transformations, aggregations, or joins that shape this column.`,
            `**Step 3 — Downstream impact:** See which tables, views, dashboards, and metrics depend on \`${column}\`.`,
            `**Step 4 — Cross-platform:** Check if lineage crosses platform boundaries (e.g. dbt model → Snowflake view → Looker dashboard).`,
            '',
            'Starting the trace...',
            '',
            '```tool-call',
            `trace_cross_platform_lineage({ "assetId": "${table}", "depth": 5, "direction": "${direction}" })`,
            '```',
          ].join('\n'),
        },
      },
    ],
  };
};
