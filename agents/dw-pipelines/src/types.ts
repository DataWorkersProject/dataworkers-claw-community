/**
 * Type definitions for the Pipeline Building Agent.
 */

export type Orchestrator = 'airflow' | 'dagster' | 'prefect';
export type CodeLanguage = 'sql' | 'python' | 'dbt';
export type PipelineStatus = 'draft' | 'validating' | 'validated' | 'deploying' | 'deployed' | 'failed';

export interface PipelineSpec {
  id: string;
  name: string;
  description: string;
  version: number;
  status: PipelineStatus;
  orchestrator: Orchestrator;
  codeLanguage: CodeLanguage;
  tasks: PipelineTask[];
  qualityTests: QualityTest[];
  schedule?: string;
  retryPolicy: RetryPolicy;
  metadata: PipelineMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface PipelineTask {
  id: string;
  name: string;
  type: 'extract' | 'transform' | 'load' | 'test' | 'notify';
  description: string;
  code: string;
  codeLanguage: CodeLanguage;
  dependencies: string[];
  config: Record<string, unknown>;
}

export interface QualityCheck {
  type: string;
  threshold?: number;
  severity?: 'warn' | 'error';
}

export interface QualityTest {
  name: string;
  type: 'schema' | 'row_count' | 'freshness' | 'uniqueness' | 'not_null' | 'custom';
  target: string;
  config: Record<string, unknown>;
  severity: 'warn' | 'error';
}

export interface RetryPolicy {
  maxRetries: number;
  delaySeconds: number;
  backoffMultiplier: number;
}

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable?: boolean;
  description?: string;
}

export interface ConnectorContext {
  connectorType: 'iceberg' | 'polaris';
  catalog?: string;
  namespace: string;
  table: string;
  columns?: ColumnMetadata[];
  partitionSpec?: Array<{ sourceId: number; fieldName: string; transform: string }>;
  permissions?: { allowed: boolean; reason: string };
  statistics?: { recordCount: number; fileSizeBytes: number; fileCount: number };
  seedFallback?: boolean;
}

export interface PipelineMetadata {
  author: string;
  agentId: string;
  customerId: string;
  sourceDescription: string;
  generatedAt: number;
  confidence: number;
  tags: string[];
  connectorContext?: ConnectorContext;
  dagDefinition?: string;
  templateUsed?: string;
  icebergNative?: boolean;
  connectorStatus?: 'active' | 'not_configured' | 'error';
  configHint?: string;
  dagCode?: string;
  dbtModels?: Record<string, string>;
  reusableAssets?: Array<{ id: string; name: string; type: string }>;
  llmFallbackUsed?: boolean;
  reuse_check_skipped?: boolean;
  seedFallback?: boolean;
  sandboxSkipped?: boolean;
  sandboxSkipReason?: string;
  gitStub?: boolean;
  orchestratorStub?: boolean;
  llmTokenUsage?: { input: number; output: number; total: number; costUsd: number };
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: 'etl' | 'elt' | 'cdc' | 'streaming' | 'reverse-etl' | 'data-quality';
  orchestrator: Orchestrator;
  codeLanguage: CodeLanguage;
  parameters: TemplateParameter[];
  exampleDescription: string;
  version: string;
  lastUpdated: string;
}

export interface TemplateParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  default?: unknown;
}

export interface GeneratePipelineInput {
  description: string;
  orchestrator?: Orchestrator;
  codeLanguage?: CodeLanguage;
  templateId?: string;
  customerId: string;
  sourceConnections?: string[];
  targetConnections?: string[];
  connectorConfig?: {
    iceberg?: { endpoint: string };
    polaris?: { endpoint: string; clientId: string; clientSecret: string };
  };
  principal?: string;
  persist?: boolean;
  tier?: 'community' | 'pro' | 'enterprise';
}

export interface ValidatePipelineInput {
  pipelineSpec: PipelineSpec;
  customerId: string;
  validateSemanticLayer?: boolean;
  sandboxExecution?: boolean;
}

export interface DeployPipelineInput {
  pipelineSpec: PipelineSpec;
  customerId: string;
  environment: 'staging' | 'production';
  gitCommit?: boolean;
  gitBranch?: string;
}

export interface ValidationReport {
  valid: boolean;
  syntaxErrors: Array<{ task: string; error: string }>;
  semanticWarnings: Array<{ task: string; warning: string }>;
  connectorIssues?: Array<{
    table: string;
    issue: 'table_not_found' | 'column_mismatch';
    details?: string;
    column?: string;
    expected?: string;
    found?: string;
  }>;
  sandboxResult?: { success: boolean; output: string; error?: string };
  confidence: number;
}

export interface DeploymentResult {
  success: boolean;
  status?: string;
  simulated?: boolean;
  deploymentId: string;
  orchestratorUrl?: string | null;
  gitCommitHash?: string;
  dagCode?: string;
  configRequired?: boolean;
  error?: string;
}

export interface PipelineSpecWithConnectors extends PipelineSpec {
  connectorContexts?: ConnectorContext[];
}
