/**
 * MCP Prompt: Discover My Data
 *
 * Guided workflow for finding and understanding data assets.
 * Template-only — not executable code.
 */

import type { PromptDefinition, PromptHandler } from '@data-workers/mcp-framework';

export const discoverMyDataDefinition: PromptDefinition = {
  name: 'discover-my-data',
  description: 'Guided workflow: find data about a topic, explore its lineage, and review documentation. Start with "I want to find data about X".',
  arguments: [
    { name: 'topic', description: 'What kind of data are you looking for? (e.g. "customer revenue", "order fulfillment", "marketing attribution")', required: true },
    { name: 'platform', description: 'Optionally restrict to a specific platform (e.g. snowflake, bigquery, dbt)', required: false },
  ],
};

export const discoverMyDataHandler: PromptHandler = async (args) => {
  const topic = args.topic ?? 'data';
  const platformFilter = args.platform ? ` on ${args.platform}` : '';

  return {
    description: `Discover data assets related to "${topic}"`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I want to find data about "${topic}"${platformFilter}. Help me discover relevant datasets, understand their lineage, and review documentation.`,
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            `I'll help you find data about "${topic}". Here's the plan:`,
            '',
            `**Step 1 — Search:** Use \`search_across_platforms\` to find datasets matching "${topic}"${platformFilter}.`,
            '**Step 2 — Inspect:** For the most relevant results, review column definitions and quality scores.',
            '**Step 3 — Lineage:** Use `trace_cross_platform_lineage` to see where the data comes from and what depends on it.',
            '**Step 4 — Documentation:** Use `generate_documentation` to get or create comprehensive docs for the best match.',
            '',
            'Let me start by searching...',
            '',
            `\`\`\`tool-call`,
            `search_across_platforms({ "query": "${topic}"${args.platform ? `, "platform": "${args.platform}"` : ''} })`,
            `\`\`\``,
          ].join('\n'),
        },
      },
    ],
  };
};
