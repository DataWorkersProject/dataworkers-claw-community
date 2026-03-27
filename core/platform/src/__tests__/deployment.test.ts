import { describe, it, expect } from 'vitest';
import { DeploymentManager } from '../deployment.js';

describe('DeploymentManager', () => {
  it('exports DeploymentManager class', () => {
    expect(DeploymentManager).toBeDefined();
  });

  it('deploys a SaaS configuration', async () => {
    const manager = new DeploymentManager();
    const result = await manager.deploy({
      type: 'saas',
      region: 'us-east-1',
      customerId: 'acme',
      agentsEnabled: ['dw-pipelines', 'dw-quality'],
    });
    expect(result.success).toBe(true);
    expect(result.endpoint).toContain('acme');
  });

  it('validates deployment health', async () => {
    const manager = new DeploymentManager();
    const result = await manager.validateDeployment('acme');
    expect(result.healthy).toBe(true);
    expect(typeof result.agents).toBe('number');
  });
});
