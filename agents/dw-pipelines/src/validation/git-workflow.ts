/**
 * Git Workflow for Pipeline Versioning — STRIPPED (OSS).
 *
 * Pipeline versioning and Git integration requires Data Workers Pro.
 * Visit https://dataworkers.io/pricing
 */

import type { PipelineSpec } from '../types.js';

export interface GitCommitResult {
  commitHash: string;
  branch: string;
  filePath: string;
  message: string;
  gitStub?: boolean;
}

export interface GitRollbackResult {
  success: boolean;
  previousVersion: number;
  commitHash: string;
  gitStub?: boolean;
}

const PRO_MESSAGE = 'Pipeline Git versioning requires Data Workers Pro. Visit https://dataworkers.io/pricing';

export class GitWorkflow {
  generateYAMLSpec(_spec: PipelineSpec): string {
    return `# ${PRO_MESSAGE}`;
  }

  getSpecPath(spec: PipelineSpec): string {
    return `pipelines/${spec.metadata.customerId}/${spec.id}/spec.yaml`;
  }

  generateCommitMessage(_spec: PipelineSpec, _action: 'create' | 'update' | 'rollback'): string {
    return PRO_MESSAGE;
  }

  async commitSpec(_spec: PipelineSpec, _branch?: string): Promise<GitCommitResult> {
    return {
      commitHash: '',
      branch: '',
      filePath: '',
      message: PRO_MESSAGE,
      gitStub: true,
    };
  }

  async rollback(_spec: PipelineSpec, _targetVersion: number): Promise<GitRollbackResult> {
    return {
      success: false,
      previousVersion: 0,
      commitHash: '',
      gitStub: true,
    };
  }
}
