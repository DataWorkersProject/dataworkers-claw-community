import { describe, it, expect } from 'vitest';
import { RemediationPlaybook } from '../engine/remediation-playbook.js';
import type { OrchestratorActions } from '../engine/remediation-playbook.js';
import { orchestratorAPI } from '../backends.js';
import { monitorMetricsHandler } from '../tools/monitor-metrics.js';

/**
 * Phase 2 Integration Tests — 
 *
 * Verifies all 6 playbook types execute correctly through the
 * RemediationPlaybook engine, plus MetricMonitor tool integration.
 */

function makeOrchestrator(): OrchestratorActions {
  return {
    restartTask: (pipelineId: string, taskId: string) =>
      orchestratorAPI.restartTask(pipelineId, taskId),
    getTaskStatus: (pipelineId: string, taskId: string) =>
      orchestratorAPI.getTaskStatus(pipelineId, taskId),
    scaleCompute: (warehouseId: string, size: string) =>
      orchestratorAPI.scaleCompute(warehouseId, size),
  };
}

describe('Phase 2: Playbook Execution + MetricMonitor', () => {
  const engine = new RemediationPlaybook();
  const orch = makeOrchestrator();

  // ── 1. restart_task ──────────────────────────────────────────────

  it('restart_task — calls orchestrator.restartTask + getTaskStatus', async () => {
    const actions = await engine.executePlaybook(
      'restart_task',
      'code_regression',
      false,
      orch,
      { pipelineId: 'pipe-1', taskId: 'task-1' },
    );
    expect(actions.length).toBeGreaterThanOrEqual(3);
    expect(actions[0]).toContain('Identified failed task');
    expect(actions[1]).toContain('Restarted task task-1');
    expect(actions[2]).toContain('Health check');
    // No dry-run prefix
    expect(actions[0]).not.toMatch(/^\[DRY RUN\]/);
  });

  // ── 2. scale_compute ─────────────────────────────────────────────

  it('scale_compute — calls orchestrator.scaleCompute', async () => {
    const actions = await engine.executePlaybook(
      'scale_compute',
      'resource_exhaustion',
      false,
      orch,
      { warehouseId: 'wh-1', targetSize: 'L' },
    );
    expect(actions.length).toBeGreaterThanOrEqual(3);
    expect(actions[0]).toContain('Analyzed resource usage');
    expect(actions[1]).toContain('Scaled warehouse');
    expect(actions[2]).toContain('Health check');
  });

  // ── 3. apply_schema_migration ─────────────────────────────────────

  it('apply_schema_migration — enhanced cross-agent stubs', async () => {
    const actions = await engine.executePlaybook(
      'apply_schema_migration',
      'schema_change',
      false,
      orch,
    );
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions[0]).toContain('Detected schema change');
    expect(actions.some(a => a.includes('schema diff'))).toBe(true);
    expect(actions.some(a => a.includes('migration'))).toBe(true);
  });

  // ── 4. switch_backup_source ───────────────────────────────────────

  it('switch_backup_source — enhanced cross-agent stubs', async () => {
    const actions = await engine.executePlaybook(
      'switch_backup_source',
      'source_delay',
      false,
      orch,
    );
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions[0]).toContain('Detected source unavailability');
    expect(actions.some(a => a.includes('backup source'))).toBe(true);
  });

  // ── 5. backfill_data ──────────────────────────────────────────────

  it('backfill_data — calls orchestrator.restartTask for backfill', async () => {
    const actions = await engine.executePlaybook(
      'backfill_data',
      'quality_degradation',
      false,
      orch,
      { pipelineId: 'pipe-2', taskId: 'backfill-task-1' },
    );
    expect(actions.length).toBeGreaterThanOrEqual(3);
    expect(actions[0]).toContain('Identified data gap');
    expect(actions[1]).toContain('Initiated backfill task');
    expect(actions.some(a => a.includes('Backfill status'))).toBe(true);
  });

  // ── 6. custom ─────────────────────────────────────────────────────

  it('custom — generates report stub', async () => {
    const actions = await engine.executePlaybook(
      'custom',
      'infrastructure',
      false,
      orch,
    );
    expect(actions.length).toBe(2);
    expect(actions[0]).toContain('Generated diagnosis report');
    expect(actions[1]).toContain('Awaiting human review');
  });

  // ── 7. monitor_metrics ────────────────────────────────────────────

  it('monitor_metrics — record data points and verify results', async () => {
    const result = await monitorMetricsHandler({
      dataPoints: [
        { metric: 'row_count', value: 1000, source: 'orders' },
        { metric: 'row_count', value: 1050, source: 'orders' },
        { metric: 'latency', value: 200, source: 'orders' },
      ],
      customerId: 'cust-phase2',
    });

    expect(result.content[0].type).toBe('text');
    const body = JSON.parse((result.content[0] as { text: string }).text);
    expect(body.recorded).toBe(3);
    expect(body.anomaliesDetected).toBeGreaterThanOrEqual(0);
    expect(body.monitoredMetrics).toBeDefined();
    expect(Array.isArray(body.monitoredMetrics)).toBe(true);
    expect(body.monitoredMetrics.length).toBeGreaterThanOrEqual(2);
  });

  it('monitor_metrics — anomaly detection triggers on spike', async () => {
    // Build a stable baseline first (need enough points for z-score)
    const baselinePoints = [];
    for (let i = 0; i < 30; i++) {
      baselinePoints.push({
        metric: 'error_rate_phase2',
        value: 2.0 + (i % 3) * 0.1, // stable ~2.0
        source: 'anomaly-test',
        timestamp: Date.now() - (30 - i) * 60_000,
      });
    }

    // Record baseline
    await monitorMetricsHandler({
      dataPoints: baselinePoints,
      customerId: 'cust-phase2',
    });

    // Now inject a spike
    const spikeResult = await monitorMetricsHandler({
      dataPoints: [
        { metric: 'error_rate_phase2', value: 50.0, source: 'anomaly-test' },
      ],
      customerId: 'cust-phase2',
    });

    const spikeBody = JSON.parse((spikeResult.content[0] as { text: string }).text);
    expect(spikeBody.recorded).toBe(1);
    expect(spikeBody.anomaliesDetected).toBe(1);
    expect(spikeBody.detections.length).toBe(1);
    expect(spikeBody.detections[0].isAnomaly).toBe(true);
    expect(spikeBody.detections[0].metric).toBe('error_rate_phase2');
  });

  // ── 8. dryRun mode — all 6 playbooks ─────────────────────────────

  describe('dryRun mode prefixes [DRY RUN]', () => {
    const playbookConfigs: Array<{
      playbook: 'restart_task' | 'scale_compute' | 'apply_schema_migration' | 'switch_backup_source' | 'backfill_data' | 'custom';
      type: 'code_regression' | 'resource_exhaustion' | 'schema_change' | 'source_delay' | 'quality_degradation' | 'infrastructure';
    }> = [
      { playbook: 'restart_task', type: 'code_regression' },
      { playbook: 'scale_compute', type: 'resource_exhaustion' },
      { playbook: 'apply_schema_migration', type: 'schema_change' },
      { playbook: 'switch_backup_source', type: 'source_delay' },
      { playbook: 'backfill_data', type: 'quality_degradation' },
      { playbook: 'custom', type: 'infrastructure' },
    ];

    for (const cfg of playbookConfigs) {
      it(`${cfg.playbook} dryRun`, async () => {
        const actions = await engine.executePlaybook(
          cfg.playbook,
          cfg.type,
          true,
          orch,
        );
        expect(actions.length).toBeGreaterThan(0);
        for (const action of actions) {
          expect(action).toMatch(/^\[DRY RUN\] /);
        }
      });
    }
  });
});
