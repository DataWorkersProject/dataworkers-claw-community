/**
 * generate_audit_report — Generate a compliance audit report with evidence chain.
 *
 * Updated to use the rewritten AuditEngine from backends
 * which reads real activity log data. Logs to activity log.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { auditEngine, logActivity } from '../backends.js';

export const generateAuditReportDefinition: ToolDefinition = {
  name: 'generate_audit_report',
  description: 'Generate a compliance audit report with full evidence chain. Supports on-demand and scheduled generation. Covers agent actions, policy evaluations, access grants, PII detections.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      fromTimestamp: { type: 'number', description: 'Period start.' },
      toTimestamp: { type: 'number', description: 'Period end. Default: now.' },
      reportType: { type: 'string', enum: ['full', 'access', 'pii', 'violations'], description: 'Report scope. Default: full.' },
    },
    required: ['customerId'],
  },
};

export const generateAuditReportHandler: ToolHandler = async (args) => {
  const customerId = args.customerId as string;
  const from = (args.fromTimestamp as number) ?? Date.now() - 30 * 86400000;
  const to = (args.toTimestamp as number) ?? Date.now();

  const reportType = (args.reportType as 'full' | 'access' | 'pii' | 'violations') ?? 'full';

  const report = await auditEngine.generateReport({ customerId, from, to, reportType });

  // Log audit report generation to activity log
  await logActivity({
    customerId,
    action: 'audit_report',
    actor: 'dw-governance',
    resource: 'audit_report',
    result: `generated report ${report.id} with ${report.evidenceChain.length} evidence entries`,
  });

  return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
};
