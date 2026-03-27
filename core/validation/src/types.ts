/**
 * Type definitions for validation and hallucination reduction.
 * Covers REQ-HALL-001 through REQ-HALL-007.
 */

export interface ValidationResult {
  passed: boolean;
  gateName: string;
  confidence: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: Record<string, unknown>;
}

export interface ValidationError {
  code: string;
  message: string;
  location?: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  code: string;
  message: string;
  location?: string;
}

export interface ValidationGate {
  name: string;
  validate(input: ValidationInput): Promise<ValidationResult>;
}

export interface ValidationInput {
  content: string;
  contentType: ContentType;
  agentId: string;
  customerId: string;
  metadata?: Record<string, unknown>;
}

export type ContentType = 'sql' | 'python' | 'yaml' | 'dag' | 'text' | 'json';

// Citation tracking (REQ-HALL-004)
export interface Citation {
  sourceType: 'table' | 'column' | 'metric' | 'pipeline' | 'incident' | 'document';
  sourceId: string;
  sourceLabel: string;
  confidence: number;
}

// Output diff (REQ-HALL-007)
export interface OutputDiff {
  operation: 'create' | 'modify' | 'delete';
  resource: string;
  before: string | null;
  after: string | null;
  changedFields: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Sandbox execution (REQ-HALL-005)
export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
  resourceUsage: {
    memoryMB: number;
    cpuTimeMs: number;
  };
}

export interface SandboxConfig {
  timeoutMs: number;
  maxMemoryMB: number;
  maxCpuTimeMs: number;
  allowNetwork: boolean;
  allowFileSystem: boolean;
}

// ── Shared PII Types ──────────────────────────────────────

/**
 * Canonical PII type union shared across governance and enterprise packages.
 * Superset of the enterprise module's PIIType (which lacks address, dob, medical).
 */
export type PIIType = 'ssn' | 'email' | 'phone' | 'credit_card' | 'name' | 'address' | 'dob' | 'ip_address' | 'medical';

/** PII detection result returned by scanners. */
export interface PIIDetection {
  type: PIIType;
  value: string;
  location: { column: string; row?: number };
  confidence: number;
  method: 'regex' | 'ner' | 'llm' | 'heuristic';
}
