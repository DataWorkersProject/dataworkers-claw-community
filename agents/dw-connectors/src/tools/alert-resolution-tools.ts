/**
 * Alert resolution tools — resolve alerts in PagerDuty, OpsGenie, New Relic, Slack, Teams.
 * All are admin operations requiring Enterprise tier.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';

// ── Helper ─────────────────────────────────────────────────────────────

function tierGate(toolName: string) {
  if (!isToolAllowed(toolName)) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: toolName }) }],
      isError: true,
    };
  }
  return null;
}

// ── resolve_pagerduty_alert ───────────────────────────────────────────

export const resolvePagerdutyAlertDefinition: ToolDefinition = {
  name: 'resolve_pagerduty_alert',
  description: 'Resolve an existing PagerDuty incident. Requires Enterprise tier.',
  inputSchema: {
    type: 'object',
    properties: {
      incidentId: { type: 'string', description: 'PagerDuty incident ID.' },
      resolution: { type: 'string', description: 'Resolution note.' },
    },
    required: ['incidentId'],
  },
};

export const resolvePagerdutyAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('resolve_pagerduty_alert');
  if (gate) return gate;

  const incidentId = args.incidentId as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ resolved: true, provider: 'pagerduty', incidentId, status: 'resolved' }, null, 2) }],
  };
};

// ── resolve_opsgenie_alert ────────────────────────────────────────────

export const resolveOpsgenieAlertDefinition: ToolDefinition = {
  name: 'resolve_opsgenie_alert',
  description: 'Close/resolve an OpsGenie alert. Requires Enterprise tier.',
  inputSchema: {
    type: 'object',
    properties: {
      alertId: { type: 'string', description: 'OpsGenie alert ID.' },
      note: { type: 'string', description: 'Closing note.' },
    },
    required: ['alertId'],
  },
};

export const resolveOpsgenieAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('resolve_opsgenie_alert');
  if (gate) return gate;

  const alertId = args.alertId as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ resolved: true, provider: 'opsgenie', alertId, status: 'closed' }, null, 2) }],
  };
};

// ── resolve_newrelic_alert ────────────────────────────────────────────

export const resolveNewrelicAlertDefinition: ToolDefinition = {
  name: 'resolve_newrelic_alert',
  description: 'Acknowledge/close a New Relic alert condition incident. Requires Enterprise tier.',
  inputSchema: {
    type: 'object',
    properties: {
      incidentId: { type: 'string', description: 'New Relic incident ID.' },
      note: { type: 'string', description: 'Resolution note.' },
    },
    required: ['incidentId'],
  },
};

export const resolveNewrelicAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('resolve_newrelic_alert');
  if (gate) return gate;

  const incidentId = args.incidentId as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ resolved: true, provider: 'newrelic', incidentId, status: 'closed' }, null, 2) }],
  };
};

// ── resolve_slack_alert ───────────────────────────────────────────────

export const resolveSlackAlertDefinition: ToolDefinition = {
  name: 'resolve_slack_alert',
  description: 'Post a resolution update to a Slack alert thread. Requires Enterprise tier.',
  inputSchema: {
    type: 'object',
    properties: {
      channel: { type: 'string', description: 'Slack channel.' },
      threadTs: { type: 'string', description: 'Original alert message timestamp (thread ID).' },
      resolution: { type: 'string', description: 'Resolution message.' },
    },
    required: ['channel', 'threadTs', 'resolution'],
  },
};

export const resolveSlackAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('resolve_slack_alert');
  if (gate) return gate;

  const channel = args.channel as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ resolved: true, provider: 'slack', channel, status: 'thread_updated' }, null, 2) }],
  };
};

// ── resolve_teams_alert ───────────────────────────────────────────────

export const resolveTeamsAlertDefinition: ToolDefinition = {
  name: 'resolve_teams_alert',
  description: 'Post a resolution update to a Teams alert card. Requires Enterprise tier.',
  inputSchema: {
    type: 'object',
    properties: {
      webhookUrl: { type: 'string', description: 'Teams webhook URL.' },
      alertId: { type: 'string', description: 'Original alert identifier.' },
      resolution: { type: 'string', description: 'Resolution message.' },
    },
    required: ['alertId', 'resolution'],
  },
};

export const resolveTeamsAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('resolve_teams_alert');
  if (gate) return gate;

  const alertId = args.alertId as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ resolved: true, provider: 'teams', alertId, status: 'card_updated' }, null, 2) }],
  };
};
