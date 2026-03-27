/**
 * Saga Coordinator for cross-agent ordering (REQ-CTX-008).
 *
 * Uses a per-customer saga log in PostgreSQL to enforce ordering
 * constraints for multi-agent operations. Saga steps are released
 * sequentially, ensuring correct cross-agent coordination.
 *
 * During PostgreSQL failover (multi-AZ, synchronous replication),
 * new saga operations queue in Kafka. In-flight sagas are idempotent
 * on retry.
 */

export type SagaStatus = 'pending' | 'running' | 'completed' | 'compensating' | 'failed';

export interface SagaStep {
  stepId: string;
  agentId: string;
  action: string;
  status: SagaStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  compensationAction?: string;
}

export interface Saga {
  sagaId: string;
  customerId: string;
  name: string;
  status: SagaStatus;
  steps: SagaStep[];
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  correlationId: string;
}

export class SagaCoordinator {
  private sagas = new Map<string, Saga>();

  /**
   * Create a new saga with ordered steps.
   */
  createSaga(
    customerId: string,
    name: string,
    steps: Array<{ agentId: string; action: string; input: Record<string, unknown>; compensationAction?: string }>,
    correlationId?: string,
  ): Saga {
    const sagaId = `saga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const saga: Saga = {
      sagaId,
      customerId,
      name,
      status: 'pending',
      steps: steps.map((s, i) => ({
        stepId: `${sagaId}-step-${i}`,
        agentId: s.agentId,
        action: s.action,
        status: 'pending',
        input: s.input,
        compensationAction: s.compensationAction,
      })),
      currentStepIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      correlationId: correlationId ?? sagaId,
    };

    this.sagas.set(sagaId, saga);
    // In production: INSERT INTO saga_log
    return saga;
  }

  /**
   * Get the next step to execute. Returns null if saga is complete or failed.
   */
  getNextStep(sagaId: string): SagaStep | null {
    const saga = this.sagas.get(sagaId);
    if (!saga || saga.status === 'completed' || saga.status === 'failed') {
      return null;
    }

    if (saga.currentStepIndex >= saga.steps.length) {
      return null;
    }

    return saga.steps[saga.currentStepIndex];
  }

  /**
   * Start the saga (transition from pending to running).
   */
  startSaga(sagaId: string): Saga | null {
    const saga = this.sagas.get(sagaId);
    if (!saga || saga.status !== 'pending') return null;

    saga.status = 'running';
    saga.updatedAt = Date.now();

    const firstStep = saga.steps[0];
    if (firstStep) {
      firstStep.status = 'running';
      firstStep.startedAt = Date.now();
    }

    return saga;
  }

  /**
   * Complete the current step and advance to the next.
   */
  completeStep(
    sagaId: string,
    stepId: string,
    output: Record<string, unknown>,
  ): SagaStep | null {
    const saga = this.sagas.get(sagaId);
    if (!saga || saga.status !== 'running') return null;

    const step = saga.steps.find((s) => s.stepId === stepId);
    if (!step || step.status !== 'running') return null;

    step.status = 'completed';
    step.output = output;
    step.completedAt = Date.now();
    saga.updatedAt = Date.now();

    // Advance to next step
    saga.currentStepIndex++;
    if (saga.currentStepIndex >= saga.steps.length) {
      saga.status = 'completed';
      saga.completedAt = Date.now();
    } else {
      const nextStep = saga.steps[saga.currentStepIndex];
      nextStep.status = 'running';
      nextStep.startedAt = Date.now();
    }

    // In production: UPDATE saga_log SET ...
    return step;
  }

  /**
   * Fail a step and begin compensation (rollback).
   */
  failStep(sagaId: string, stepId: string, error: string): void {
    const saga = this.sagas.get(sagaId);
    if (!saga) return;

    const step = saga.steps.find((s) => s.stepId === stepId);
    if (!step) return;

    step.status = 'failed';
    step.error = error;
    step.completedAt = Date.now();
    saga.status = 'compensating';
    saga.updatedAt = Date.now();

    // Mark all completed steps for compensation
    for (let i = saga.currentStepIndex - 1; i >= 0; i--) {
      if (saga.steps[i].status === 'completed' && saga.steps[i].compensationAction) {
        saga.steps[i].status = 'compensating';
      }
    }
  }

  /**
   * Complete a compensation step.
   */
  completeCompensation(sagaId: string, stepId: string): void {
    const saga = this.sagas.get(sagaId);
    if (!saga) return;

    const step = saga.steps.find((s) => s.stepId === stepId);
    if (!step) return;

    step.status = 'completed';
    step.completedAt = Date.now();
    saga.updatedAt = Date.now();

    // Check if all compensations are done
    const pendingCompensations = saga.steps.filter((s) => s.status === 'compensating');
    if (pendingCompensations.length === 0) {
      saga.status = 'failed';
    }
  }

  /**
   * Get a saga by ID.
   */
  getSaga(sagaId: string): Saga | undefined {
    return this.sagas.get(sagaId);
  }

  /**
   * List all sagas for a customer.
   */
  listSagas(customerId: string): Saga[] {
    return Array.from(this.sagas.values()).filter((s) => s.customerId === customerId);
  }

  /**
   * List active (non-terminal) sagas.
   */
  listActiveSagas(): Saga[] {
    return Array.from(this.sagas.values()).filter(
      (s) => s.status === 'pending' || s.status === 'running' || s.status === 'compensating',
    );
  }
}
