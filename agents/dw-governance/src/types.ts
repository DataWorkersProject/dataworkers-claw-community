/**
 * Type definitions for the Governance & Security Agent.
 */

export type PolicyAction = 'allow' | 'deny' | 'review';
export type PIIType = 'ssn' | 'email' | 'phone' | 'credit_card' | 'name' | 'address' | 'dob' | 'ip_address' | 'medical';
export type AccessLevel = 'read' | 'write' | 'admin' | 'none';

/** P5: Actor type for agent-as-identity tracking */
export type ActorType = 'human' | 'agent' | 'delegated';

/** Activity log entry with SHA-256 hash chain for tamper-evidence (/) */
export interface ActivityLog {
  id: string;
  timestamp: number;
  actor: string;
  actorType: ActorType;
  action: string;
  resource: string;
  result: string;
  customerId: string;
  metadata?: Record<string, unknown>;
  /** SHA-256 hash of this entry's content + previousHash */
  hash: string;
  /** Hash of the preceding entry in the chain (empty string for first entry) */
  previousHash: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  resource: string;
  action: PolicyAction;
  conditions: Record<string, unknown>;
  priority: number;
}

export interface PolicyCheckResult {
  allowed: boolean;
  action: PolicyAction;
  matchedRules: PolicyRule[];
  evaluationTimeMs: number;
  reason: string;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  accessLevel: AccessLevel;
  justification: string;
  duration?: number;
  customerId: string;
  /** P5: Actor type */
  actorType?: ActorType;
  /** P5: Extended context */
  context?: AccessRequestContext;
}

export interface AccessGrant {
  id: string;
  userId: string;
  resource: string;
  accessLevel: AccessLevel;
  grantedAt: number;
  expiresAt: number;
  grantedBy: string;
  autoExpire: boolean;
}

export interface PIIDetection {
  type: PIIType;
  value: string;
  location: { column: string; row?: number };
  confidence: number;
  method: 'regex' | 'ner' | 'llm' | 'heuristic';
}

/**
 * A governance policy stored in the relational policy store.
 * Glob patterns on `resource` support `*` as a wildcard.
 */
export interface GovernancePolicy {
  id: string;
  customerId: string;
  name: string;
  /** Glob pattern — `*` matches any substring. */
  resource: string;
  /** The enforcement action when this policy matches. */
  action: PolicyAction;
  /** Conditions that narrow when this policy applies. */
  conditions: { actions: string[]; agentIds?: string[] };
  /** Higher priority wins. */
  priority: number;
}

export interface PIIScanResult {
  scannedColumns: number;
  detections: PIIDetection[];
  piiColumnsFound: number;
  scanTimeMs: number;
}

export interface AuditReport {
  id: string;
  customerId: string;
  period: { from: number; to: number };
  summary: {
    totalActions: number;
    policiesEvaluated: number;
    accessGrants: number;
    accessRevocations: number;
    piiDetections: number;
    violations: number;
  };
  evidenceChain: AuditEvidence[];
  generatedAt: number;
}

export interface AuditEvidence {
  timestamp: number;
  action: string;
  actor: string;
  /** P5: Actor type for agent-as-identity */
  actorType?: ActorType;
  resource: string;
  result: string;
  policyRef?: string;
}

/** P5: Extended access request context */
export interface AccessRequestContext {
  /** Who the access is being requested on behalf of */
  forWhom?: string;
  /** Purpose of the access request */
  purpose?: string;
  /** Data classification level */
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  /** Actor type for the requester */
  actorType?: ActorType;
  /** Additional context key-value pairs */
  [key: string]: unknown;
}

/** P5: JIT ephemeral access grant */
export interface EphemeralAccessGrant {
  id: string;
  userId: string;
  resource: string;
  accessLevel: AccessLevel;
  grantedAt: number;
  expiresAt: number;
  taskId: string;
  revoked: boolean;
  revokedAt?: number;
  revokeReason?: 'expired' | 'task_complete' | 'manual';
}

/** P5: Agent identity record for audit trail */
export interface AgentIdentityRecord {
  agentId: string;
  actorType: ActorType;
  delegatedBy?: string;
  delegatedAt?: number;
  permissions: string[];
  actions: AgentActionRecord[];
}

/** P5: Individual agent action record */
export interface AgentActionRecord {
  timestamp: number;
  action: string;
  resource: string;
  result: string;
  actorType: ActorType;
  delegatedBy?: string;
}

// ── ABAC Types ──────────────────────────────────────────

export interface ABACPolicy {
  id: string;
  customerId: string;
  name: string;
  /** User attribute conditions (e.g., department, clearance level). */
  userAttributes: Record<string, string | string[]>;
  /** Resource attribute conditions (e.g., classification, owner). */
  resourceAttributes: Record<string, string | string[]>;
  /** Environmental conditions (e.g., time of day, IP range). */
  environmentConditions?: Record<string, string | string[]>;
  action: PolicyAction;
  priority: number;
}

export interface ABACContext {
  userAttributes: Record<string, string>;
  resourceAttributes: Record<string, string>;
  environmentConditions?: Record<string, string>;
}

export interface ABACEvaluation {
  allowed: boolean;
  action: PolicyAction;
  matchedPolicy: ABACPolicy | null;
  allMatched: ABACPolicy[];
  reason: string;
}

// ── OPA / Rego Types ────────────────────────────────────

export interface OPAPolicy {
  id: string;
  customerId: string;
  name: string;
  /** Rego policy source code. */
  rego: string;
  /** Package name for evaluation. */
  packageName: string;
}

export interface OPAEvaluationResult {
  allowed: boolean;
  reason: string;
  policyId: string;
  evaluationTimeMs: number;
}

// ── Regulatory Templates ────────────────────────────────

export type RegulatoryFramework = 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS';

export interface RegulatoryTemplate {
  framework: RegulatoryFramework;
  name: string;
  description: string;
  policies: GovernancePolicy[];
}

// ── Governance Review Request ───────────────────────────

export interface GovernanceReviewRequest {
  id: string;
  customerId: string;
  requestedBy: string;
  resource: string;
  action: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

// ── Cross-Agent Governance Gate ─────────────────────────

export interface GovernanceGateResult {
  allowed: boolean;
  gateType: 'policy' | 'pii' | 'rbac';
  reason: string;
  evaluationTimeMs: number;
}

// ── Centralized Result Types ─────────────────────────────

export interface ProvisioningResult {
  granted: boolean;
  grant: AccessGrant;
  provisioningTimeMs: number;
  policyCheck?: { allowed: boolean; reason: string };
}

export interface RbacEnforcementResult {
  applied: boolean;
  userId: string;
  resource: string;
  role: string;
  permissions: string[];
  columnRestrictions: string[] | string;
  appliedAt: number;
  customerId?: string;
}
