import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import type { SLADefinition, SLARule, MetricType } from '../types.js';
import { SLAEvaluator } from '../sla-evaluator.js';
import { relationalStore, messageBus } from '../backends.js';

/** Valid metric names that SLA rules can reference. */
const VALID_METRICS: ReadonlySet<string> = new Set<MetricType>([
  'null_rate', 'uniqueness', 'distribution', 'range',
  'referential_integrity', 'freshness', 'volume', 'custom',
]);

/** Shared SLA evaluator instance backed by the relational store. */
const slaEvaluator = new SLAEvaluator(relationalStore, messageBus);

export const setSLADefinition: ToolDefinition = {
  name: 'set_sla',
  description: 'Define data quality SLAs for a dataset. SLA rules specify metric thresholds with severity levels. Violations trigger alerts within 60 seconds.',
  inputSchema: {
    type: 'object',
    properties: {
      datasetId: { type: 'string' },
      customerId: { type: 'string' },
      rules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
            operator: { type: 'string', enum: ['lt', 'gt', 'lte', 'gte', 'eq'] },
            threshold: { type: 'number' },
            severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
            description: { type: 'string' },
          },
        },
        description: 'SLA rules to apply.',
      },
      dryRun: { type: 'boolean', description: 'If true, validate and return what would happen without persisting.' },
      alertConfig: {
        type: 'object',
        description: 'Optional alerting configuration for SLA violations.',
        properties: {
          channels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Notification channels (e.g., "slack", "pagerduty", "email").',
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Alert severity level.',
          },
          notifyOnViolation: {
            type: 'boolean',
            description: 'Whether to send notifications on SLA violations. Default: true.',
          },
        },
      },
    },
    required: ['datasetId', 'customerId', 'rules'],
  },
};

export const setSLAHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('set_sla')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: 'set_sla' }) }],
      isError: true,
    };
  }

  const datasetId = args.datasetId as string;
  const customerId = args.customerId as string;
  const rules = (args.rules as SLARule[]) ?? [];
  const dryRun = (args.dryRun as boolean) ?? false;
  const alertConfig = args.alertConfig as {
    channels?: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
    notifyOnViolation?: boolean;
  } | undefined;

  // Validate that all metric names in rules reference valid metrics
  const invalidMetrics: string[] = [];
  for (const rule of rules) {
    if (!VALID_METRICS.has(rule.metric)) {
      invalidMetrics.push(rule.metric);
    }
  }

  if (invalidMetrics.length > 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Invalid metric(s) in SLA rules: ${invalidMetrics.join(', ')}. Valid metrics: ${[...VALID_METRICS].join(', ')}`,
        }, null, 2),
      }],
      isError: true,
    };
  }

  const resolvedAlertConfig = alertConfig ? {
    channels: alertConfig.channels ?? [],
    severity: alertConfig.severity ?? 'medium',
    notifyOnViolation: alertConfig.notifyOnViolation ?? true,
  } : undefined;

  const sla: SLADefinition = {
    id: `sla-${Date.now()}`,
    datasetId,
    customerId,
    rules,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...(resolvedAlertConfig ? { alertConfig: resolvedAlertConfig } : {}),
  } as SLADefinition;

  if (dryRun) {
    // Dry run: validate and return what would happen without persisting
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          created: false,
          dryRun: true,
          sla,
          message: `Dry run: SLA with ${rules.length} rule(s) validated successfully. No changes persisted.`,
        }, null, 2),
      }],
    };
  }

  // Persist the SLA to the relational store
  await slaEvaluator.saveSLA(sla);

  // Evaluate current data against SLA rules by querying the latest quality metrics
  const rows = await relationalStore.query('quality_metrics', (row) =>
    row.datasetId === datasetId && row.customerId === customerId,
  );

  // Build a simple QualityCheckResult-like structure from the latest metrics
  // Group by metric type and take the latest value for each
  const metricMap = new Map<string, number>();
  for (const row of rows) {
    const metric = row.metric as string;
    const timestamp = row.timestamp as number;
    const value = row.value as number;
    const existing = metricMap.get(metric);
    if (existing === undefined || timestamp > (metricMap.get(`${metric}_ts`) ?? 0)) {
      metricMap.set(metric, value);
      metricMap.set(`${metric}_ts`, timestamp);
    }
  }

  // Evaluate each rule against current metric values
  const evaluationResults: Array<{
    metric: string;
    threshold: number;
    operator: string;
    actualValue: number | null;
    passed: boolean;
    severity: string;
  }> = [];

  for (const rule of rules) {
    const actualValue = metricMap.get(rule.metric) ?? null;
    let passed = true;

    if (actualValue !== null) {
      // Check if the value meets the SLA (inverse of violation logic)
      switch (rule.operator) {
        case 'lt': passed = actualValue < rule.threshold; break;
        case 'lte': passed = actualValue <= rule.threshold; break;
        case 'gt': passed = actualValue > rule.threshold; break;
        case 'gte': passed = actualValue >= rule.threshold; break;
        case 'eq': passed = actualValue === rule.threshold; break;
      }
    }

    evaluationResults.push({
      metric: rule.metric,
      threshold: rule.threshold,
      operator: rule.operator,
      actualValue,
      passed,
      severity: rule.severity,
    });
  }

  const violations = evaluationResults.filter((r) => !r.passed && r.actualValue !== null);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        created: true,
        sla,
        evaluation: {
          rulesEvaluated: evaluationResults.length,
          violations: violations.length,
          results: evaluationResults,
        },
      }, null, 2),
    }],
  };
};
