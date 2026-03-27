/**
 * Type definitions for the Agent Observability (Trust Layer).
 *
 * All types are deterministic — no LLM-dependent fields.
 */

/** Latency percentiles for an agent over a time period. */
export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

/** Aggregated metrics for an agent over a time period. */
export interface AgentMetrics {
  agentName: string;
  period: string;
  latency: LatencyPercentiles;
  errorRate: number;
  totalInvocations: number;
  avgTokens: number;
  avgConfidence: number;
  escalationRate: number;
}

/** A single entry in the SHA-256 hash-chain audit log. */
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

/** Per-agent health status. */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Health check result for a single agent. */
export interface AgentHealth {
  agentName: string;
  status: HealthStatus;
  lastHeartbeat: number;
  uptime: number;
  errorRateLast5m: number;
}

/** Behavioral drift alert. */
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

/** Score breakdown for human evaluations. */
export interface EvaluationBreakdown {
  accuracy: number;
  completeness: number;
  safety: number;
  helpfulness: number;
}

/** Aggregated evaluation report for an agent. */
export interface EvaluationReport {
  agentName: string;
  period: string;
  averageScore: number;
  totalEvaluations: number;
  breakdown: EvaluationBreakdown;
}
