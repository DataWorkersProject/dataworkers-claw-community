/**
 * Type definitions for the Usage Intelligence Agent.
 *
 * CANONICAL TYPE SOURCE — all shared interfaces live here.
 * Tool files must import from this module rather than defining local interfaces.
 *
 * All types are deterministic — no LLM-dependent fields.
 */

// ── Core Usage Event ────────────────────────────────────────────────

/** A single MCP tool call recorded as a usage event. */
export interface UsageEvent {
  id: string;
  timestamp: number;
  userId: string;
  teamId: string;
  agentName: string;
  toolName: string;
  inputSummary: string;
  outcome: 'success' | 'error';
  durationMs: number;
  tokenCount: number;
  sessionId: string;
  sequenceIndex: number;
  hash: string;
  previousHash: string;
}

// ── Tool Usage Metrics ──────────────────────────────────────────────

export interface ToolUsageMetric {
  name: string;
  agent: string;
  totalCalls: number;
  uniqueUsers: number;
  avgCallsPerUser: number;
  avgResponseTimeMs: number;
  avgTokenCount: number;
  totalTokens: number;
  errorRate: number;
  trendDirection: 'up' | 'down' | 'stable';
  trendPercentage: number;
  peakHour: number;
}

export interface ToolUsageMetricsSummary {
  totalCalls: number;
  totalUniqueUsers: number;
  mostUsedTool: string;
  leastUsedTool: string;
}

export interface ToolUsageMetricsResult {
  period: string;
  groupBy: string;
  metrics: ToolUsageMetric[];
  summary: ToolUsageMetricsSummary;
}

// ── Usage Activity Log ──────────────────────────────────────────────

export interface UsageActivityEntry {
  id: string;
  timestamp: number;
  userId: string;
  agentName: string;
  toolName: string;
  inputSummary: string;
  outcome: 'success' | 'error';
  durationMs: number;
  hash: string;
  previousHash: string;
}

export interface UsageActivityLogResult {
  entries: UsageActivityEntry[];
  totalEntries: number;
  chainIntegrity: 'valid' | 'broken';
}

// ── Adoption Dashboard ──────────────────────────────────────────────

export type AdoptionStatus = 'fully_adopted' | 'growing' | 'underused' | 'shelfware';

export interface AgentAdoption {
  agentName: string;
  status: AdoptionStatus;
  totalUsers: number;
  activeUsers: number;
  adoptionRate: number;
  totalCalls: number;
  weekOverWeekGrowth: number;
  topTools: string[];
  underusedTools: string[];
}

export interface AdoptionDashboardResult {
  period: string;
  agents: AgentAdoption[];
  platformSummary: {
    totalPractitioners: number;
    activePractitioners: number;
    platformAdoptionRate: number;
    fastestGrowingAgent: string;
    needsAttentionAgent: string;
  };
}

// ── Usage Anomalies ─────────────────────────────────────────────────

export type AnomalyType = 'usage_drop' | 'usage_spike' | 'behavior_shift';
export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface UsageAnomaly {
  type: AnomalyType;
  agentName: string;
  toolName: string;
  description: string;
  currentValue: number;
  baselineValue: number;
  severity: AnomalySeverity;
  possibleCauses: string[];
  detectedAt: number;
}

export interface UsageAnomaliesResult {
  anomalies: UsageAnomaly[];
  checkedAgents: number;
  totalAnomalies: number;
}

// ── Workflow Patterns ───────────────────────────────────────────────

export interface WorkflowPattern {
  rank: number;
  sequence: string[];
  frequency: number;
  uniqueUsers: number;
  avgDurationMinutes: number;
  description: string;
}

export interface CrossAgentFlow {
  from: string;
  to: string;
  frequency: number;
}

export interface WorkflowPatternsResult {
  patterns: WorkflowPattern[];
  crossAgentFlows: CrossAgentFlow[];
  isolatedToolUsage: {
    percentage: number;
    description: string;
  };
}

// ── Usage Heatmap ───────────────────────────────────────────────────

export interface HeatmapCell {
  bucket: number | string;
  totalCalls: number;
  uniqueUsers: number;
  topAgent: string;
}

export interface UsageHeatmapResult {
  dimension: string;
  period: string;
  heatmap: HeatmapCell[];
  peakBucket: number | string;
  quietBucket: number | string;
  weekdayVsWeekend?: { weekdayAvgCalls: number; weekendAvgCalls: number };
}

// ── Session Analytics ───────────────────────────────────────────────

export type UserType = 'power_user' | 'regular' | 'occasional';

export interface UserSessionBreakdown {
  userId: string;
  totalSessions: number;
  avgDurationMinutes: number;
  avgToolCallsPerSession: number;
  avgAgentsPerSession: number;
  mostUsedAgent: string;
  userType: UserType;
  /** Fraction of weeks in the period where user returned (0-1) */
  returnRate: number;
  /** Risk of churn — low/medium/high based on recency + returnRate */
  churnRisk: 'low' | 'medium' | 'high';
}

export interface SessionAnalyticsResult {
  period: string;
  sessionGapMinutes: number;
  overview: {
    totalSessions: number;
    avgSessionDurationMinutes: number;
    avgToolCallsPerSession: number;
    avgAgentsPerSession: number;
    medianSessionDurationMinutes: number;
  };
  userBreakdown: UserSessionBreakdown[];
  userTypeDistribution: {
    power_user: number;
    regular: number;
    occasional: number;
  };
}

// ── Retained: Agent Health (from dw-observability) ──────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface AgentHealth {
  agentName: string;
  status: HealthStatus;
  lastHeartbeat: number;
  uptime: number;
  errorRateLast5m: number;
}

// ── Retained: Drift Detection (from dw-observability) ───────────────

export type DriftSeverity = 'warning' | 'critical';

export interface DriftAlert {
  agentName: string;
  metric: string;
  currentValue: number;
  baselineValue: number;
  threshold: number;
  severity: DriftSeverity;
  detectedAt: number;
}

// ── Evaluation Report ─────────────────────────────────────────────

export interface EvaluationBreakdown {
  accuracy: number;
  completeness: number;
  safety: number;
  helpfulness: number;
}

export interface EvaluationReport {
  agentName: string;
  period: string;
  averageScore: number;
  totalEvaluations: number;
  breakdown: EvaluationBreakdown;
}

// ── Active Agent ──────────────────────────────────────────────────

export interface ActiveAgent {
  agentName: string;
  status: string;
  lastHeartbeat: number;
  errorRateLast5m: number;
}

// ── Global Hash Chain ──────────────────────────────────────

export interface GlobalHashChainResult {
  integrity: 'valid' | 'broken';
  totalEvents: number;
  agentChains: { agentName: string; eventCount: number; integrity: 'valid' | 'broken' }[];
  globalChainHash: string;
}

// ── /OTel Types ─────────────────────────────────────

export interface OTelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  attributes: Record<string, string | number | boolean>;
  status: { code: 'OK' | 'ERROR'; message?: string };
}

export interface OTelExportResult {
  resourceSpans: {
    resource: { attributes: Record<string, string> };
    scopeSpans: {
      scope: { name: string; version: string };
      spans: OTelSpan[];
    }[];
  }[];
}

// ── Agent Metrics ─────────────────────────────────────────────────

export interface AgentMetrics {
  agentName: string;
  period: string;
  latency: { p50: number; p95: number; p99: number };
  errorRate: number;
  totalInvocations: number;
  avgTokens: number;
  avgConfidence: number;
  escalationRate: number;
}

// ── Audit Entry ───────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: number;
  agentName: string;
  action: string;
  input: string;
  output: string;
  confidence: number;
  hash: string;
  previousHash: string;
}

// ── Retention Tier Gating ─────────────────────────────────────────

/** Data retention limits by license tier (in days). */
export const RETENTION_LIMITS: Record<string, number> = {
  community: 7,
  pro: 90,
  enterprise: Infinity,
};
