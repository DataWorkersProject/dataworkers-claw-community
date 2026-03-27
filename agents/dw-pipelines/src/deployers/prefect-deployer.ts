/**
 * Prefect Deployer — STRIPPED (OSS).
 *
 * Pipeline deployment requires Data Workers Pro.
 * Visit https://dataworkers.io/pricing
 */

export interface PrefectDeployerConfig {
  prefectUrl: string;
  apiKey?: string;
  workPool?: string;
}

export interface PrefectDeployResult {
  deployed: boolean;
  deploymentId?: string;
  flowRunId?: string;
  error?: string;
  stub?: boolean;
}

const PRO_MESSAGE = 'Pipeline deployment requires Data Workers Pro. Visit https://dataworkers.io/pricing';

export class PrefectDeployer {
  constructor(_config?: Partial<PrefectDeployerConfig>) {}

  isConfigured(): boolean {
    return false;
  }

  async deployFlow(_flowName: string, _config: Record<string, unknown>): Promise<PrefectDeployResult> {
    return { deployed: false, error: PRO_MESSAGE };
  }

  async triggerFlowRun(_deploymentId: string, _parameters?: Record<string, unknown>): Promise<PrefectDeployResult> {
    return { deployed: false, error: PRO_MESSAGE };
  }

  async getFlowRunStatus(_flowRunId: string): Promise<{ status: string; error?: string }> {
    return { status: 'UNAVAILABLE', error: PRO_MESSAGE };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    return { healthy: false, message: PRO_MESSAGE };
  }
}
