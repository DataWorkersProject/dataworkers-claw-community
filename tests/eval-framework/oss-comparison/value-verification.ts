/**
 * Eval Framework — OSS Value Verification
 *
 * Measures how valuable the Data Workers platform is under the community
 * (OSS) tier. The core thesis: even without write tools, the read-only
 * experience should deliver substantial value for data teams.
 *
 * Core read workflows tested:
 *   - Search data assets
 *   - Trace lineage
 *   - Check data quality
 *   - View costs
 *   - Explore schemas
 *   - View pipeline status
 *   - Browse governance policies
 */

import type { MCPServer, RawToolResult } from '../types.js';
import { runUnderTier } from './tier-runner.js';
import { classifyTool } from '../../../core/license/src/tool-gate.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OSSValueResult {
  /** Overall OSS value score (0-100) */
  overallScore: number;
  /** Fraction of tools that work under community tier */
  toolAvailabilityRate: number;
  /** Number of tools available in community */
  communityToolCount: number;
  /** Total tools across all agents */
  totalToolCount: number;
  /** Per-workflow value scores */
  workflows: WorkflowValueResult[];
  /** Per-agent breakdown */
  agentBreakdown: AgentValueBreakdown[];
}

export interface WorkflowValueResult {
  name: string;
  description: string;
  score: number;     // 0-100
  toolsTested: string[];
  toolsWorking: string[];
  note: string;
}

export interface AgentValueBreakdown {
  agent: string;
  totalTools: number;
  readTools: number;
  readToolsWorking: number;
  writeToolsGated: number;
  valueScore: number;  // 0-100
}

// ---------------------------------------------------------------------------
// Core read workflows to validate
// ---------------------------------------------------------------------------

interface WorkflowSpec {
  name: string;
  description: string;
  /** Weight in overall score (should sum to 1.0 across all workflows) */
  weight: number;
  /** Agent -> tool pairs representing this workflow */
  probes: Array<{
    agent: string;
    tool: string;
    args: Record<string, unknown>;
  }>;
}

const CORE_WORKFLOWS: WorkflowSpec[] = [
  {
    name: 'Data Search & Discovery',
    description: 'Can users search and browse data assets?',
    weight: 0.20,
    probes: [
      { agent: 'dw-context-catalog', tool: 'search_datasets', args: { query: 'revenue', customerId: 'cust-1' } },
      { agent: 'dw-context-catalog', tool: 'explain_table', args: { assetId: 'orders', customerId: 'cust-1' } },
      { agent: 'dw-context-catalog', tool: 'get_context', args: { assetId: 'orders', customerId: 'cust-1' } },
    ],
  },
  {
    name: 'Lineage Tracing',
    description: 'Can users trace data lineage upstream and downstream?',
    weight: 0.15,
    probes: [
      { agent: 'dw-context-catalog', tool: 'get_lineage', args: { assetId: 'orders', customerId: 'cust-1', direction: 'upstream' } },
      { agent: 'dw-context-catalog', tool: 'get_context', args: { assetId: 'orders', customerId: 'cust-1' } },
    ],
  },
  {
    name: 'Quality Monitoring',
    description: 'Can users check data quality metrics and view SLA status?',
    weight: 0.15,
    probes: [
      { agent: 'dw-quality', tool: 'run_quality_check', args: { datasetId: 'orders', customerId: 'cust-1' } },
      { agent: 'dw-quality', tool: 'get_quality_summary', args: { datasetId: 'orders', customerId: 'cust-1' } },
      { agent: 'dw-quality', tool: 'get_quality_score', args: { datasetId: 'orders', customerId: 'cust-1' } },
    ],
  },
  // dw-cost removed (paid agent) — Cost Visibility workflow not available in OSS
  {
    name: 'Schema Exploration',
    description: 'Can users explore schemas and understand table structures?',
    weight: 0.15,
    probes: [
      { agent: 'dw-schema', tool: 'get_schema_snapshot', args: { source: 'snowflake', database: 'analytics', schema: 'public', table: 'orders', customerId: 'cust-1' } },
      { agent: 'dw-schema', tool: 'list_schema_changes', args: { source: 'snowflake', database: 'analytics', customerId: 'cust-1' } },
      { agent: 'dw-schema', tool: 'detect_schema_change', args: { source: 'snowflake', database: 'analytics', schema: 'public', table: 'orders', customerId: 'cust-1' } },
    ],
  },
  {
    name: 'Pipeline Status',
    description: 'Can users view pipeline runs and their status?',
    weight: 0.10,
    probes: [
      { agent: 'dw-pipelines', tool: 'list_pipeline_templates', args: {} },
      { agent: 'dw-pipelines', tool: 'validate_pipeline', args: { pipelineId: 'daily_etl', customerId: 'cust-1' } },
    ],
  },
  {
    name: 'Governance & Access Visibility',
    description: 'Can users view access policies and governance rules?',
    weight: 0.10,
    probes: [
      { agent: 'dw-governance', tool: 'check_policy', args: { resource: 'orders', action: 'read', principal: 'analyst@example.com', customerId: 'cust-1' } },
      { agent: 'dw-governance', tool: 'generate_audit_report', args: { customerId: 'cust-1' } },
    ],
  },
  {
    name: 'Usage Intelligence',
    description: 'Can users view usage patterns and adoption metrics?',
    weight: 0.05,
    probes: [
      { agent: 'dw-usage-intelligence', tool: 'get_adoption_dashboard', args: { customerId: 'cust-1' } },
      { agent: 'dw-usage-intelligence', tool: 'get_usage_heatmap', args: { customerId: 'cust-1' } },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSuccessful(result: RawToolResult | undefined, tierError?: string): boolean {
  if (tierError) return false;
  if (!result) return false;
  if (result.isError === true) return false;
  // Check for gating error messages specifically
  if (result.content) {
    const text = result.content.map((c) => c.text).join(' ').toLowerCase();
    if (text.includes('requires') && (text.includes('tier') || text.includes('upgrade'))) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify that the OSS (community tier) experience delivers meaningful value.
 *
 * Runs representative read tools from each agent under community tier and
 * scores the overall experience. A score of 50+ means the OSS version is
 * genuinely useful; 70+ means it's compelling.
 *
 * @param servers - Map of agent name to MCP server instance
 * @returns OSSValueResult with overall score and per-workflow breakdown
 */
export async function verifyOSSValue(
  servers: Record<string, MCPServer>,
): Promise<OSSValueResult> {
  const workflows: WorkflowValueResult[] = [];
  const agentStats: Record<string, AgentValueBreakdown> = {};

  // Initialize agent stats from provided servers
  for (const [agent, server] of Object.entries(servers)) {
    const allTools = server.listTools();
    const readTools = allTools.filter((t) => classifyTool(t.name) === 'read');
    const writeTools = allTools.filter((t) => classifyTool(t.name) !== 'read');

    agentStats[agent] = {
      agent,
      totalTools: allTools.length,
      readTools: readTools.length,
      readToolsWorking: 0,
      writeToolsGated: writeTools.length,
      valueScore: 0,
    };
  }

  // Run each core workflow under community tier
  let weightedScoreSum = 0;
  let totalWeight = 0;

  for (const workflow of CORE_WORKFLOWS) {
    const toolsTested: string[] = [];
    const toolsWorking: string[] = [];

    for (const probe of workflow.probes) {
      const server = servers[probe.agent];
      if (!server) continue;

      toolsTested.push(`${probe.agent}/${probe.tool}`);

      const tierResult = await runUnderTier('community', async () => {
        return server.callTool(probe.tool, probe.args);
      });

      const callResult = tierResult.result as RawToolResult | undefined;
      if (isSuccessful(callResult, tierResult.error)) {
        toolsWorking.push(`${probe.agent}/${probe.tool}`);

        // Update agent stats
        if (agentStats[probe.agent]) {
          agentStats[probe.agent].readToolsWorking++;
        }
      }
    }

    const score = toolsTested.length > 0
      ? Math.round((toolsWorking.length / toolsTested.length) * 100)
      : 0;

    const note = toolsTested.length === 0
      ? 'No servers available for this workflow'
      : toolsWorking.length === toolsTested.length
        ? 'Fully functional under community tier'
        : toolsWorking.length > 0
          ? `Partially functional: ${toolsWorking.length}/${toolsTested.length} tools working`
          : 'Not functional under community tier';

    workflows.push({
      name: workflow.name,
      description: workflow.description,
      score,
      toolsTested,
      toolsWorking,
      note,
    });

    weightedScoreSum += score * workflow.weight;
    totalWeight += workflow.weight;
  }

  // Compute agent value scores
  for (const stats of Object.values(agentStats)) {
    stats.valueScore = stats.readTools > 0
      ? Math.round((stats.readToolsWorking / stats.readTools) * 100)
      : 0;
  }

  // Compute tool availability stats
  let communityToolCount = 0;
  let totalToolCount = 0;
  for (const stats of Object.values(agentStats)) {
    totalToolCount += stats.totalTools;
    communityToolCount += stats.readTools; // read tools = community tools
  }

  const toolAvailabilityRate = totalToolCount > 0
    ? communityToolCount / totalToolCount
    : 0;

  const overallScore = totalWeight > 0
    ? Math.round(weightedScoreSum / totalWeight)
    : 0;

  return {
    overallScore,
    toolAvailabilityRate,
    communityToolCount,
    totalToolCount,
    workflows,
    agentBreakdown: Object.values(agentStats),
  };
}
