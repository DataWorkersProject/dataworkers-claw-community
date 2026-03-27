/**
 * Type definitions for the Incident Debugging Agent.
 */

import type { DiagnosisReport } from './remediation/novel-reporter.js';

export type IncidentType =
  | 'schema_change'
  | 'source_delay'
  | 'resource_exhaustion'
  | 'code_regression'
  | 'infrastructure'
  | 'quality_degradation';

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IncidentStatus = 'detected' | 'diagnosing' | 'diagnosed' | 'remediating' | 'resolved' | 'escalated';

export interface Incident {
  id: string;
  customerId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  affectedResources: string[];
  detectedAt: number;
  resolvedAt?: number;
  rootCause?: RootCauseAnalysis;
  remediation?: RemediationResult;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface AnomalySignal {
  metric: string;
  value: number;
  expected: number;
  deviation: number;
  source: string;
  timestamp: number;
}

export interface Diagnosis {
  incidentId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  confidence: number;
  title: string;
  description: string;
  affectedResources: string[];
  suggestedActions: string[];
  relatedIncidents: string[];
  enrichedSignals?: Array<{ metric: string; value: number; expected: number; deviation: number; isAnomaly: boolean; method: string; severity: string; confidence: number }>;
  classificationScores?: Record<string, number>;
  classificationWarning?: string;
  vectorStoreWarning?: string;
}

export interface RootCauseAnalysis {
  incidentId: string;
  rootCause: string;
  causalChain: CausalChainLink[];
  confidence: number;
  evidenceSources: string[];
  traversalDepth: number;
  analysisTimeMs: number;
  impactRadius?: number;
  processedResources?: string[];
  evidence?: Array<{ source: string; finding: string; weight: number }>;
}

export interface CausalChainLink {
  entity: string;
  entityType: 'table' | 'pipeline' | 'query' | 'infrastructure' | 'schema';
  issue: string;
  confidence: number;
  timestamp?: number;
}

export type PlaybookType =
  | 'restart_task'
  | 'scale_compute'
  | 'apply_schema_migration'
  | 'switch_backup_source'
  | 'backfill_data'
  | 'custom';

export interface RemediationResult {
  incidentId: string;
  playbook: PlaybookType;
  success: boolean;
  automated: boolean;
  actionsPerformed: string[];
  rollbackAvailable: boolean;
  executionTimeMs: number;
  error?: string;
  dryRun?: boolean;
  pipelineId?: string;
  taskId?: string;
  diagnosisReport?: DiagnosisReport;
}

export interface IncidentHistoryQuery {
  customerId: string;
  type?: IncidentType;
  severity?: IncidentSeverity;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  similarTo?: string;
  includeMTTRReport?: boolean;
}

export type { DiagnosisReport, ApprovalRouting, RecommendedAction } from './remediation/novel-reporter.js';
