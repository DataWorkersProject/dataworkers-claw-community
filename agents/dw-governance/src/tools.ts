/**
 * dw-governance — Exported tool definitions and handlers.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

import { checkPolicyDefinition, checkPolicyHandler } from './tools/check-policy.js';
import { provisionAccessDefinition, provisionAccessHandler } from './tools/provision-access.js';
import { scanPiiDefinition, scanPiiHandler } from './tools/scan-pii.js';
import { generateAuditReportDefinition, generateAuditReportHandler } from './tools/generate-audit-report.js';
import { enforceRbacDefinition, enforceRbacHandler } from './tools/enforce-rbac.js';
import { requestGovernanceReviewDefinition, requestGovernanceReviewHandler } from './tools/request-governance-review.js';

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const governanceTools: ToolEntry[] = [
  { definition: checkPolicyDefinition, handler: checkPolicyHandler },
  { definition: provisionAccessDefinition, handler: provisionAccessHandler },
  { definition: scanPiiDefinition, handler: scanPiiHandler },
  { definition: generateAuditReportDefinition, handler: generateAuditReportHandler },
  { definition: enforceRbacDefinition, handler: enforceRbacHandler },
  { definition: requestGovernanceReviewDefinition, handler: requestGovernanceReviewHandler },
];
