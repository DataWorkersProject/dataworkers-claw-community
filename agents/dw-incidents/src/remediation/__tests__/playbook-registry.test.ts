import { describe, it, expect } from 'vitest';
import { PlaybookRegistry } from '../playbook-registry.js';
import type { StepContext } from '../playbook-registry.js';

function makeStepContext(overrides?: Partial<StepContext>): StepContext {
  return {
    incidentId: 'inc-test-1',
    customerId: 'cust-test-1',
    incidentType: 'code_regression',
    orchestratorAPI: {
      restartTask: async () => ({ restartedAt: Date.now() }),
      getTaskStatus: async () => ({ status: 'running' }),
      scaleCompute: async () => ({ previousSize: 'S', newSize: 'M' }),
    },
    ...overrides,
  };
}

describe('PlaybookRegistry', () => {
  it('initializes with built-in playbooks', () => {
    const registry = new PlaybookRegistry();
    const all = registry.listAll();
    expect(all.length).toBeGreaterThan(0);
  });

  it('retrieves playbook by id', () => {
    const registry = new PlaybookRegistry();
    const pb = registry.get('restart_task');
    expect(pb).toBeDefined();
    expect(pb!.name).toBe('Restart Failed Task');
  });

  it('finds playbooks for incident type', () => {
    const registry = new PlaybookRegistry();
    const results = registry.findForIncidentType('schema_change');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].applicableIncidentTypes).toContain('schema_change');
  });

  it('selects best playbook with confidence threshold', () => {
    const registry = new PlaybookRegistry();
    const best = registry.selectBest('resource_exhaustion', 0.9);
    expect(best).toBeDefined();
    expect(best!.id).toBe('scale_compute');
  });

  it('executes a playbook successfully', async () => {
    const registry = new PlaybookRegistry();
    const result = await registry.execute('restart_task', makeStepContext());
    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(result.totalSteps);
  });

  it('returns error for unknown playbook', async () => {
    const registry = new PlaybookRegistry();
    const result = await registry.execute('nonexistent' as any, makeStepContext());
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
