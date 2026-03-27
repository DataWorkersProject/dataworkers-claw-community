/**
 * Dagster Deployer — STRIPPED (OSS).
 *
 * Pipeline deployment requires Data Workers Pro.
 * Visit https://dataworkers.dev/pricing
 */

export interface DagsterDeployerConfig {
  dagsterUrl: string;
  repositoryName?: string;
}

export interface DagsterDeployResult {
  deployed: boolean;
  runId?: string;
  error?: string;
  stub?: boolean;
}

const PRO_MESSAGE = 'Pipeline deployment requires Data Workers Pro. Visit https://dataworkers.dev/pricing';

export class DagsterDeployer {
  constructor(_config?: Partial<DagsterDeployerConfig>) {}

  isConfigured(): boolean {
    return false;
  }

  async deployJob(_jobName: string, _config: Record<string, unknown>): Promise<DagsterDeployResult> {
    return { deployed: false, error: PRO_MESSAGE };
  }

  async getJobStatus(_runId: string): Promise<{ status: string; error?: string }> {
    return { status: 'UNAVAILABLE', error: PRO_MESSAGE };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    return { healthy: false, message: PRO_MESSAGE };
  }
}
