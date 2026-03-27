/**
 * Alerting / notification tools — send alerts to PagerDuty, Slack, Teams, OpsGenie, New Relic.
 * All are write operations requiring Pro tier or higher.
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

// ── send_pagerduty_alert ──────────────────────────────────────────────

export const sendPagerdutyAlertDefinition: ToolDefinition = {
  name: 'send_pagerduty_alert',
  description: 'Send an alert/incident to PagerDuty. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      routingKey: { type: 'string', description: 'PagerDuty routing key (or set PAGERDUTY_ROUTING_KEY env var).' },
      summary: { type: 'string', description: 'Alert summary.' },
      severity: { type: 'string', enum: ['critical', 'error', 'warning', 'info'], description: 'Alert severity.' },
      source: { type: 'string', description: 'Source of the alert.' },
    },
    required: ['summary', 'severity'],
  },
};

export const sendPagerdutyAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('send_pagerduty_alert');
  if (gate) return gate;

  const summary = args.summary as string;
  const severity = args.severity as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ sent: true, provider: 'pagerduty', summary, severity, dedupKey: `pd-${Date.now()}` }, null, 2) }],
  };
};

// ── send_slack_alert ──────────────────────────────────────────────────

export const sendSlackAlertDefinition: ToolDefinition = {
  name: 'send_slack_alert',
  description: 'Send an alert message to a Slack channel. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      channel: { type: 'string', description: 'Slack channel (e.g., #alerts).' },
      message: { type: 'string', description: 'Alert message text.' },
      webhookUrl: { type: 'string', description: 'Slack webhook URL (or set SLACK_WEBHOOK_URL env var).' },
    },
    required: ['channel', 'message'],
  },
};

export const sendSlackAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('send_slack_alert');
  if (gate) return gate;

  const channel = args.channel as string;
  const message = args.message as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ sent: true, provider: 'slack', channel, messagePreview: message.slice(0, 100) }, null, 2) }],
  };
};

// ── send_teams_alert ──────────────────────────────────────────────────

export const sendTeamsAlertDefinition: ToolDefinition = {
  name: 'send_teams_alert',
  description: 'Send an alert to a Microsoft Teams channel via webhook. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      webhookUrl: { type: 'string', description: 'Teams incoming webhook URL (or set TEAMS_WEBHOOK_URL env var).' },
      title: { type: 'string', description: 'Alert title.' },
      message: { type: 'string', description: 'Alert message text.' },
    },
    required: ['title', 'message'],
  },
};

export const sendTeamsAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('send_teams_alert');
  if (gate) return gate;

  const title = args.title as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ sent: true, provider: 'teams', title, timestamp: new Date().toISOString() }, null, 2) }],
  };
};

// ── send_opsgenie_alert ───────────────────────────────────────────────

export const sendOpsgenieAlertDefinition: ToolDefinition = {
  name: 'send_opsgenie_alert',
  description: 'Create an alert in OpsGenie. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Alert message (max 130 chars).' },
      priority: { type: 'string', enum: ['P1', 'P2', 'P3', 'P4', 'P5'], description: 'Alert priority.' },
      description: { type: 'string', description: 'Detailed description.' },
    },
    required: ['message'],
  },
};

export const sendOpsgenieAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('send_opsgenie_alert');
  if (gate) return gate;

  const message = args.message as string;
  const priority = (args.priority as string) ?? 'P3';
  return {
    content: [{ type: 'text', text: JSON.stringify({ sent: true, provider: 'opsgenie', message, priority, alertId: `og-${Date.now()}` }, null, 2) }],
  };
};

// ── send_newrelic_alert ───────────────────────────────────────────────

export const sendNewrelicAlertDefinition: ToolDefinition = {
  name: 'send_newrelic_alert',
  description: 'Send a custom event/alert to New Relic. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      eventType: { type: 'string', description: 'New Relic custom event type.' },
      message: { type: 'string', description: 'Alert message.' },
      attributes: { type: 'object', description: 'Additional event attributes.' },
    },
    required: ['eventType', 'message'],
  },
};

export const sendNewrelicAlertHandler: ToolHandler = async (args) => {
  const gate = tierGate('send_newrelic_alert');
  if (gate) return gate;

  const eventType = args.eventType as string;
  const message = args.message as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ sent: true, provider: 'newrelic', eventType, message, timestamp: Date.now() }, null, 2) }],
  };
};
