/**
 * Airflow Deployer — STRIPPED (OSS).
 *
 * Pipeline deployment requires Data Workers Pro.
 * Visit https://dataworkers.dev/pricing
 */

export interface DeployResult {
  success: boolean;
  deploymentId?: string;
  dagUrl?: string;
  error?: string;
  orchestratorStub?: boolean;
}

export interface HealthCheckResult {
  healthy: boolean;
  message: string;
  importErrors?: string[];
}

const PRO_MESSAGE = 'Pipeline deployment requires Data Workers Pro. Visit https://dataworkers.dev/pricing';

export class AirflowDeployer {
  isConfigured(): boolean {
    return false;
  }

  async deploy(_dagId: string, _dagCode: string): Promise<DeployResult> {
    return { success: false, error: PRO_MESSAGE };
  }

  async healthCheck(_dagId: string): Promise<HealthCheckResult> {
    return { healthy: false, message: PRO_MESSAGE };
  }

  async rollback(_dagId: string, _previousCode: string): Promise<DeployResult> {
    return { success: false, error: PRO_MESSAGE };
  }
}
