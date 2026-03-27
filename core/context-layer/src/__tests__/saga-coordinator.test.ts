import { describe, it, expect, beforeEach } from 'vitest';
import { SagaCoordinator } from '../saga-coordinator.js';

describe('SagaCoordinator', () => {
  let coord: SagaCoordinator;

  beforeEach(() => {
    coord = new SagaCoordinator();
  });

  it('creates a saga with ordered steps', () => {
    const saga = coord.createSaga('cust-1', 'incident-response', [
      { agentId: 'dw-incidents', action: 'diagnose', input: { alertId: 'a1' } },
      { agentId: 'dw-schema', action: 'check_impact', input: {}, compensationAction: 'rollback_schema' },
      { agentId: 'dw-pipelines', action: 'redeploy', input: {}, compensationAction: 'rollback_deploy' },
    ]);

    expect(saga.status).toBe('pending');
    expect(saga.steps).toHaveLength(3);
    expect(saga.currentStepIndex).toBe(0);
  });

  it('starts saga and activates first step', () => {
    const saga = coord.createSaga('cust-1', 'test', [
      { agentId: 'a1', action: 'step1', input: {} },
    ]);

    const started = coord.startSaga(saga.sagaId);
    expect(started!.status).toBe('running');
    expect(started!.steps[0].status).toBe('running');
  });

  it('completes steps sequentially', () => {
    const saga = coord.createSaga('cust-1', 'test', [
      { agentId: 'a1', action: 'step1', input: {} },
      { agentId: 'a2', action: 'step2', input: {} },
    ]);
    coord.startSaga(saga.sagaId);

    // Complete step 1
    const step1 = coord.getNextStep(saga.sagaId);
    coord.completeStep(saga.sagaId, step1!.stepId, { result: 'ok' });

    // Step 2 should be running now
    const step2 = coord.getNextStep(saga.sagaId);
    expect(step2!.agentId).toBe('a2');
    expect(step2!.status).toBe('running');
  });

  it('marks saga complete when all steps done', () => {
    const saga = coord.createSaga('cust-1', 'test', [
      { agentId: 'a1', action: 'step1', input: {} },
    ]);
    coord.startSaga(saga.sagaId);
    const step = coord.getNextStep(saga.sagaId);
    coord.completeStep(saga.sagaId, step!.stepId, {});

    const updated = coord.getSaga(saga.sagaId);
    expect(updated!.status).toBe('completed');
    expect(coord.getNextStep(saga.sagaId)).toBeNull();
  });

  it('triggers compensation on step failure', () => {
    const saga = coord.createSaga('cust-1', 'test', [
      { agentId: 'a1', action: 's1', input: {}, compensationAction: 'undo_s1' },
      { agentId: 'a2', action: 's2', input: {}, compensationAction: 'undo_s2' },
      { agentId: 'a3', action: 's3', input: {} },
    ]);
    coord.startSaga(saga.sagaId);

    // Complete step 1
    const s1 = coord.getNextStep(saga.sagaId);
    coord.completeStep(saga.sagaId, s1!.stepId, {});

    // Fail step 2
    const s2 = coord.getNextStep(saga.sagaId);
    coord.failStep(saga.sagaId, s2!.stepId, 'schema conflict');

    const updated = coord.getSaga(saga.sagaId);
    expect(updated!.status).toBe('compensating');
    // Step 1 (completed with compensation) should be marked for compensation
    expect(updated!.steps[0].status).toBe('compensating');
  });

  it('lists sagas for a customer', () => {
    coord.createSaga('cust-1', 'saga-a', [{ agentId: 'a1', action: 's1', input: {} }]);
    coord.createSaga('cust-1', 'saga-b', [{ agentId: 'a1', action: 's1', input: {} }]);
    coord.createSaga('cust-2', 'saga-c', [{ agentId: 'a1', action: 's1', input: {} }]);

    expect(coord.listSagas('cust-1')).toHaveLength(2);
    expect(coord.listSagas('cust-2')).toHaveLength(1);
  });

  it('lists active sagas', () => {
    const s1 = coord.createSaga('cust-1', 'active', [{ agentId: 'a1', action: 's1', input: {} }]);
    coord.createSaga('cust-1', 'pending', [{ agentId: 'a1', action: 's1', input: {} }]);
    coord.startSaga(s1.sagaId);
    const step = coord.getNextStep(s1.sagaId);
    coord.completeStep(s1.sagaId, step!.stepId, {});

    const active = coord.listActiveSagas();
    expect(active).toHaveLength(1); // Only the pending one (s1 is completed)
  });
});
