/**
 * Eval Framework — Core Types
 *
 * Structured evaluation across four dimensions:
 *   AI Evals, Product Quality, Productivity, User Value
 */

// ---------------------------------------------------------------------------
// Dimensions & Scoring
// ---------------------------------------------------------------------------

export type DimensionName = 'ai-evals' | 'product-quality' | 'productivity' | 'user-value';

export interface EvalDimension {
  name: DimensionName;
  weight: number;
}

export interface SubScore {
  metric: string;
  value: number;
  threshold: number;
  passed: boolean;
  detail: string;
}

export interface DimensionScore {
  dimension: DimensionName;
  score: number;       // 0-100
  grade: LetterGrade;
  subscores: SubScore[];
  evidence: string[];
}

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

// ---------------------------------------------------------------------------
// Agent-level results
// ---------------------------------------------------------------------------

export interface AgentEvalResult {
  agent: string;
  toolsTested: string[];
  dimensions: DimensionScore[];
  compositeScore: number;   // 0-100
  compositeGrade: LetterGrade;
  tier: 'community' | 'pro' | 'enterprise';
}

// ---------------------------------------------------------------------------
// Swarm-level results (multi-agent scenario)
// ---------------------------------------------------------------------------

export interface SwarmEvalResult {
  scenario: string;
  agentsInvolved: string[];
  toolChain: string[];
  dimensions: DimensionScore[];
  handoffSuccess: boolean;
  e2eLatencyMs: number;
}

// ---------------------------------------------------------------------------
// Community vs Enterprise comparison
// ---------------------------------------------------------------------------

export interface ComparisonResult {
  agent: string;
  communityResult: AgentEvalResult;
  enterpriseResult: AgentEvalResult;
  delta: number;
  gatingCorrect: boolean;
  messagingClear: boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AgentToolConfig {
  agent: string;
  serverImport: string;
  tools: string[];
}

export interface EvalConfig {
  agents: AgentToolConfig[];
  runsPerTool: number;
  thresholds: {
    composite: number;
    aiEvals: number;
    productQuality: number;
    productivity: number;
    userValue: number;
  };
}

// ---------------------------------------------------------------------------
// Raw tool call result (from MCP server.callTool)
// ---------------------------------------------------------------------------

export interface RawToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
}

// ---------------------------------------------------------------------------
// Server interface (matches MCP pattern)
// ---------------------------------------------------------------------------

export interface MCPServer {
  callTool: (name: string, args: Record<string, unknown>) => Promise<RawToolResult>;
  listTools: () => Array<{ name: string; description?: string }>;
}
