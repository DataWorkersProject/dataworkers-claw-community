/**
 * MCP Prompt: Assess Change Impact
 *
 * Guided workflow for blast-radius analysis before making changes.
 * Template-only — not executable code.
 */

import type { PromptDefinition, PromptHandler } from '@data-workers/mcp-framework';

export const assessChangeImpactDefinition: PromptDefinition = {
  name: 'assess-change-impact',
  description: 'Guided workflow: analyze what breaks if you change a table, column, or pipeline. Shows blast radius and affected stakeholders.',
  arguments: [
    { name: 'asset', description: 'Asset to change (table name, pipeline ID, or model name)', required: true },
    { name: 'changeType', description: 'Type of change: "drop-column", "rename", "schema-change", "deprecate", "delete"', required: true },
    { name: 'details', description: 'Additional details about the change (e.g. which column, new schema)', required: false },
  ],
};

export const assessChangeImpactHandler: PromptHandler = async (args) => {
  const asset = args.asset ?? 'unknown_asset';
  const changeType = args.changeType ?? 'schema-change';
  const details = args.details ? ` Details: ${args.details}` : '';

  return {
    description: `Assess impact of ${changeType} on ${asset}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `What breaks if I ${changeType.replace('-', ' ')} on "${asset}"?${details} I need to understand the full blast radius before making this change.`,
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            `I'll analyze the blast radius for a **${changeType}** on \`${asset}\`. Here's the plan:`,
            '',
            `**Step 1 — Blast radius:** Use \`blast_radius_analysis\` to find everything downstream of \`${asset}\`.`,
            '**Step 2 — Classify impact:** Group affected assets by severity (direct dependents, transitive, BI dashboards).',
            '**Step 3 — Stakeholders:** Identify asset owners who need to be notified.',
            '**Step 4 — Freshness/SLA:** Check if any affected assets have active SLAs that would be violated.',
            '**Step 5 — Recommendation:** Provide a migration checklist based on the change type.',
            '',
            'Analyzing impact...',
            '',
            '```tool-call',
            `blast_radius_analysis({ "assetId": "${asset}", "changeType": "${changeType}" })`,
            '```',
          ].join('\n'),
        },
      },
    ],
  };
};
