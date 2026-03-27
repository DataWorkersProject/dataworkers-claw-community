/**
 * Apache Nessie MCP tools — list branches, list tables, get content, create branch, diff refs.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { nessie } from '../backends.js';

// ── list_nessie_branches ───────────────────────────────────────────

export const listNessieBranchesDefinition: ToolDefinition = {
  name: 'list_nessie_branches',
  description: 'List all branches and tags in Nessie catalog.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listNessieBranchesHandler: ToolHandler = async (_args) => {
  try {
    const refs = nessie.listReferences();
    return { content: [{ type: 'text', text: JSON.stringify(refs, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_nessie_tables ─────────────────────────────────────────────

export const listNessieTablesDefinition: ToolDefinition = {
  name: 'list_nessie_tables',
  description: 'List all tables on a Nessie branch or tag.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      ref: { type: 'string', description: 'Branch or tag name.' },
    },
    required: ['customerId', 'ref'],
  },
};

export const listNessieTablesHandler: ToolHandler = async (args) => {
  const ref = args.ref as string;
  try {
    const entries = nessie.listContent(ref);
    const tables = entries.filter((e) => e.type !== 'NAMESPACE');
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_nessie_content ─────────────────────────────────────────────

export const getNessieContentDefinition: ToolDefinition = {
  name: 'get_nessie_content',
  description: 'Get table metadata from Nessie at a specific branch and key.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      ref: { type: 'string', description: 'Branch or tag name.' },
      key: { type: 'string', description: 'Content key (dot-separated, e.g. "warehouse.analytics.customers").' },
    },
    required: ['customerId', 'ref', 'key'],
  },
};

export const getNessieContentHandler: ToolHandler = async (args) => {
  const ref = args.ref as string;
  const key = args.key as string;
  try {
    const result = nessie.getContent(ref, { elements: key.split('.') });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── create_nessie_branch ───────────────────────────────────────────

export const createNessieBranchDefinition: ToolDefinition = {
  name: 'create_nessie_branch',
  description: 'Create a new branch in Nessie from an existing reference.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      name: { type: 'string', description: 'New branch name.' },
      from: { type: 'string', description: 'Source reference to branch from.' },
    },
    required: ['customerId', 'name', 'from'],
  },
};

export const createNessieBranchHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('create_nessie_branch')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'create_nessie_branch' }) }],
      isError: true,
    };
  }

  const name = args.name as string;
  const from = args.from as string;
  try {
    const result = nessie.createBranch(name, from);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── diff_nessie_refs ───────────────────────────────────────────────

export const diffNessieRefsDefinition: ToolDefinition = {
  name: 'diff_nessie_refs',
  description: 'Show diff between two Nessie references (branches or tags).',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      from: { type: 'string', description: 'Source reference name.' },
      to: { type: 'string', description: 'Target reference name.' },
    },
    required: ['customerId', 'from', 'to'],
  },
};

export const diffNessieRefsHandler: ToolHandler = async (args) => {
  const from = args.from as string;
  const to = args.to as string;
  try {
    const diffs = nessie.diffRefs(from, to);
    return { content: [{ type: 'text', text: JSON.stringify(diffs, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
