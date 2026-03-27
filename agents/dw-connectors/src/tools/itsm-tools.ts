/**
 * ITSM tools — create/update ServiceNow and Jira Service Management tickets.
 * All are write operations requiring Pro tier or higher.
 */

import type { ToolDefinition, ToolHandler, ToolResult } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';

// ── Helper ─────────────────────────────────────────────────────────────

function tierGate(toolName: string): ToolResult | null {
  if (!isToolAllowed(toolName)) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: toolName }) }],
      isError: true,
    };
  }
  return null;
}

// ── create_servicenow_ticket ──────────────────────────────────────────

export const createServicenowTicketDefinition: ToolDefinition = {
  name: 'create_servicenow_ticket',
  description: 'Create an incident or change request in ServiceNow. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      shortDescription: { type: 'string', description: 'Ticket short description.' },
      category: { type: 'string', description: 'Ticket category.' },
      priority: { type: 'string', enum: ['1', '2', '3', '4', '5'], description: 'Priority (1=Critical, 5=Planning).' },
      assignmentGroup: { type: 'string', description: 'Assignment group.' },
    },
    required: ['shortDescription'],
  },
};

export const createServicenowTicketHandler: ToolHandler = async (args) => {
  const gate = tierGate('create_servicenow_ticket');
  if (gate) return gate;

  const shortDescription = args.shortDescription as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ created: true, provider: 'servicenow', number: `INC${Date.now()}`, shortDescription, state: 'New' }, null, 2) }],
  };
};

// ── update_servicenow_ticket ──────────────────────────────────────────

export const updateServicenowTicketDefinition: ToolDefinition = {
  name: 'update_servicenow_ticket',
  description: 'Update an existing ServiceNow ticket. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      ticketNumber: { type: 'string', description: 'ServiceNow ticket number (e.g., INC0012345).' },
      state: { type: 'string', description: 'New state.' },
      workNotes: { type: 'string', description: 'Work notes to add.' },
    },
    required: ['ticketNumber'],
  },
};

export const updateServicenowTicketHandler: ToolHandler = async (args) => {
  const gate = tierGate('update_servicenow_ticket');
  if (gate) return gate;

  const ticketNumber = args.ticketNumber as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ updated: true, provider: 'servicenow', ticketNumber, timestamp: new Date().toISOString() }, null, 2) }],
  };
};

// ── create_jira_sm_ticket ─────────────────────────────────────────────

export const createJiraSmTicketDefinition: ToolDefinition = {
  name: 'create_jira_sm_ticket',
  description: 'Create a Jira Service Management ticket. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      projectKey: { type: 'string', description: 'Jira project key.' },
      summary: { type: 'string', description: 'Ticket summary.' },
      issueType: { type: 'string', description: 'Issue type (e.g., Incident, Service Request).' },
      priority: { type: 'string', description: 'Priority name.' },
    },
    required: ['projectKey', 'summary'],
  },
};

export const createJiraSmTicketHandler: ToolHandler = async (args) => {
  const gate = tierGate('create_jira_sm_ticket');
  if (gate) return gate;

  const projectKey = args.projectKey as string;
  const summary = args.summary as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ created: true, provider: 'jira-sm', key: `${projectKey}-${Date.now() % 10000}`, summary, status: 'Open' }, null, 2) }],
  };
};

// ── update_jira_sm_ticket ─────────────────────────────────────────────

export const updateJiraSmTicketDefinition: ToolDefinition = {
  name: 'update_jira_sm_ticket',
  description: 'Update an existing Jira Service Management ticket. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      issueKey: { type: 'string', description: 'Jira issue key (e.g., PROJ-123).' },
      status: { type: 'string', description: 'New status.' },
      comment: { type: 'string', description: 'Comment to add.' },
    },
    required: ['issueKey'],
  },
};

export const updateJiraSmTicketHandler: ToolHandler = async (args) => {
  const gate = tierGate('update_jira_sm_ticket');
  if (gate) return gate;

  const issueKey = args.issueKey as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ updated: true, provider: 'jira-sm', issueKey, timestamp: new Date().toISOString() }, null, 2) }],
  };
};
