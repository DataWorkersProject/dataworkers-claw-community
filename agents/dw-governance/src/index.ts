/**
 * dw-governance — Governance & Security Agent
 *
 * MCP server exposing 6 governance tools:
 * - check_policy: validate actions against policies (<100ms)
 * - provision_access: NL access requests with least-privilege
 * - scan_pii: three-pass PII detection (heuristic + regex + LLM)
 * - generate_audit_report: compliance reports with evidence
 * - enforce_rbac: role-based access control
 * - request_governance_review: manual governance review requests
 *
 * See REQ-GOV-001 through REQ-GOV-007.
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';
import { checkPolicyDefinition, checkPolicyHandler } from './tools/check-policy.js';
import { provisionAccessDefinition, provisionAccessHandler } from './tools/provision-access.js';
import { scanPiiDefinition, scanPiiHandler } from './tools/scan-pii.js';
import { generateAuditReportDefinition, generateAuditReportHandler } from './tools/generate-audit-report.js';
import { enforceRbacDefinition, enforceRbacHandler } from './tools/enforce-rbac.js';
import { requestGovernanceReviewDefinition, requestGovernanceReviewHandler } from './tools/request-governance-review.js';
import { messageBus, piiScanner, policyStore } from './backends.js';
import { setupGovernanceSubscriptions } from './subscriptions.js';

const AGENT_ID = 'dw-governance';

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.1.0',
  description: 'Governance & Security Agent — policy enforcement, PII detection, access control, compliance',
});

server.registerTool(checkPolicyDefinition, withMiddleware(AGENT_ID, 'check_policy', checkPolicyHandler));
server.registerTool(provisionAccessDefinition, withMiddleware(AGENT_ID, 'provision_access', provisionAccessHandler));
server.registerTool(scanPiiDefinition, withMiddleware(AGENT_ID, 'scan_pii', scanPiiHandler));
server.registerTool(generateAuditReportDefinition, withMiddleware(AGENT_ID, 'generate_audit_report', generateAuditReportHandler));
server.registerTool(enforceRbacDefinition, withMiddleware(AGENT_ID, 'enforce_rbac', enforceRbacHandler));
server.registerTool(requestGovernanceReviewDefinition, withMiddleware(AGENT_ID, 'request_governance_review', requestGovernanceReviewHandler));

// ── Wire up message bus subscriptions (/869/870) ─────────
await setupGovernanceSubscriptions(messageBus, piiScanner, policyStore);

server.captureCapabilities();

export { server };
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
