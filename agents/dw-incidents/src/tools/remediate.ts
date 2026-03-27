import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { RemediationResult, PlaybookType, IncidentType, Incident, RootCauseAnalysis, CausalChainLink } from '../types.js';
import { messageBus, orchestratorAPI, kvStore, relationalStore, getIncidentLogger } from '../backends.js';
import { RemediationPlaybook } from '../engine/remediation-playbook.js';
import { PlaybookRegistry } from '../remediation/playbook-registry.js';
import { NovelIncidentReporter } from '../remediation/novel-reporter.js';
import { getCurrentTier } from '@data-workers/license';
import { HardenedAutonomyController } from '@data-workers/enterprise';
import type { OperationType } from '@data-workers/enterprise';
import { HardenedRollbackManager } from '@data-workers/enterprise';
import { startSpan } from '../tracing.js';

// TODO: Pro Plus tier — gate custom playbook registration (up to 5) and multi-tenant isolation
// Ship only if design partners validate mid-market gap

const playbookEngine = new RemediationPlaybook();
const autonomyController = new HardenedAutonomyController('supervised');
const rollbackManager = new HardenedRollbackManager();

export const remediateDefinition: ToolDefinition = {
  name: 'remediate',
  description: 'Execute auto-remediation for a diagnosed incident. For known patterns with >95% confidence, executes a remediation playbook automatically. For novel incidents, generates a diagnosis report and routes to human approval.',
  inputSchema: {
    type: 'object',
    properties: {
      incidentId: { type: 'string' },
      incidentType: { type: 'string', enum: ['schema_change', 'source_delay', 'resource_exhaustion', 'code_regression', 'infrastructure', 'quality_degradation'] },
      confidence: { type: 'number', description: 'Diagnosis confidence (0-1). Auto-remediation requires >0.95.' },
      customerId: { type: 'string' },
      playbook: { type: 'string', enum: ['restart_task', 'scale_compute', 'apply_schema_migration', 'switch_backup_source', 'backfill_data', 'custom'], description: 'Specific playbook to execute. If omitted, auto-selected based on incident type.' },
      dryRun: { type: 'boolean', description: 'If true, simulates remediation without executing. Default: false.' },
      pipelineId: { type: 'string', description: 'Pipeline ID for restart_task playbook.' },
      taskId: { type: 'string', description: 'Task ID for restart_task playbook.' },
      warehouseId: { type: 'string', description: 'Warehouse ID for scale_compute playbook.' },
      targetSize: { type: 'string', description: 'Target compute size for scale_compute playbook. Default: M.' },
      rootCause: { type: 'string', description: 'Root cause description for escalation report.' },
      causalChain: { type: 'array', items: { type: 'object' }, description: 'Causal chain from RCA for escalation report.' },
      affectedResources: { type: 'array', items: { type: 'string' }, description: 'Affected resources for escalation report.' },
    },
    required: ['incidentId', 'incidentType', 'confidence', 'customerId'],
  },
};

export const remediateHandler: ToolHandler = async (args) => {
  const incidentId = args.incidentId as string;
  const incidentType = args.incidentType as IncidentType;
  const confidence = args.confidence as number;
  const customerId = args.customerId as string;
  const dryRun = (args.dryRun as boolean) ?? false;
  const start = Date.now();
  const span = startSpan('incident.remediate', { customerId, incidentId, incidentType: String(incidentType), confidence });

  // Community tier can only use dryRun mode
  const tier = getCurrentTier();
  if (tier === 'community' && !dryRun) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'upgrade_required',
          message: 'Remediation execution requires Pro or Enterprise tier. Use dryRun: true to preview the remediation plan.',
          tier,
          suggestedAction: 'Set DW_LICENSE_TIER=pro or upgrade your license to execute remediation.',
        }, null, 2),
      }],
    };
  }

  // Select playbook via engine
  const playbook = (args.playbook as PlaybookType) ?? playbookEngine.selectPlaybook(incidentType);

  // Check if auto-remediation is allowed via PlaybookRegistry thresholds, fall back to engine
  const registry = new PlaybookRegistry();
  const selectedPlaybook = registry.selectBest(incidentType, confidence);
  const autoRemediate = selectedPlaybook
    ? confidence >= selectedPlaybook.minConfidence
    : playbookEngine.canAutoRemediate(confidence, incidentType);

  if (!autoRemediate) {
    // Novel incident: generate report for human approval
    const reporter = new NovelIncidentReporter();

    // Build partial incident for report
    const partialIncident: Partial<Incident> = {
      id: incidentId,
      customerId,
      type: incidentType,
      severity: confidence > 0.7 ? 'medium' : 'low',
      affectedResources: (args.affectedResources as string[]) ?? [],
    };

    // Build RCA from params (may be empty)
    const rca: RootCauseAnalysis = {
      incidentId,
      rootCause: (args.rootCause as string) ?? 'Unknown — requires investigation',
      causalChain: (args.causalChain as CausalChainLink[]) ?? [],
      confidence,
      evidenceSources: [],
      traversalDepth: 0,
      analysisTimeMs: 0,
    };

    const diagnosisReport = reporter.generateReport(partialIncident, rca);

    const result: RemediationResult = {
      incidentId,
      playbook: 'custom',
      success: false,
      automated: false,
      actionsPerformed: ['Generated diagnosis report', 'Routed to human approval queue'],
      rollbackAvailable: false,
      executionTimeMs: Date.now() - start,
      diagnosisReport,
    };

    // Publish escalation event
    await messageBus.publish('incident_escalated', {
      id: `evt-esc-${Date.now()}`,
      type: 'incident_escalated',
      payload: {
        incidentId,
        incidentType,
        confidence,
        reason: 'Low confidence or novel incident pattern',
      },
      timestamp: Date.now(),
      customerId,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  // Autonomy governance check before auto-remediation
  const operationType: OperationType = dryRun ? 'read' : 'execute';
  const permission = autonomyController.checkPermission('dw-incidents', operationType);
  if (!permission.allowed && !dryRun) {
    if (permission.requiresApproval) {
      const approval = autonomyController.requestApproval(
        'dw-incidents',
        operationType,
        `Auto-remediate incident ${incidentId} using playbook ${playbook}`,
      );
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'approval_required',
            message: permission.reason,
            approvalId: approval.id,
            mode: permission.mode,
            incidentId,
            playbook,
          }, null, 2),
        }],
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'autonomy_denied',
          message: permission.reason,
          mode: permission.mode,
          incidentId,
          playbook,
        }, null, 2),
      }],
    };
  }

  // Execute playbook with real orchestrator API calls
  let actions: string[];
  let success = true;
  let error: string | undefined;
  let operationId: string | undefined;

  try {
    // Record operation for rollback tracking
    operationId = rollbackManager.recordOperation({
      agentId: 'dw-incidents',
      kind: 'generic',
      description: `Remediation playbook '${playbook}' for incident ${incidentId}`,
      params: { incidentId, incidentType, playbook, dryRun },
      reversible: true,
    });

    actions = await playbookEngine.executePlaybook(playbook, incidentType, dryRun, orchestratorAPI, {
      pipelineId: args.pipelineId as string | undefined,
      taskId: args.taskId as string | undefined,
      warehouseId: args.warehouseId as string | undefined,
      targetSize: args.targetSize as string | undefined,
    });
  } catch (e) {
    success = false;
    error = e instanceof Error ? e.message : String(e);
    actions = [`Playbook ${playbook} failed: ${error}`];

    // Attempt rollback via rollback manager
    if (operationId) {
      const rollbackResult = rollbackManager.rollback(operationId);
      if (rollbackResult.success) {
        actions.push(`Rollback performed: ${rollbackResult.message}`);
      } else {
        actions.push(`Rollback skipped: ${rollbackResult.message}`);
      }
    }

    // Publish escalation event on failure
    await messageBus.publish('incident_escalated', {
      id: `evt-esc-${Date.now()}`,
      type: 'incident_escalated',
      payload: {
        incidentId,
        incidentType,
        playbook,
        error,
      },
      timestamp: Date.now(),
      customerId,
    });
  }

  const result: RemediationResult = {
    incidentId,
    playbook,
    success,
    automated: true,
    actionsPerformed: actions,
    rollbackAvailable: success,
    executionTimeMs: Date.now() - start,
    pipelineId: args.pipelineId as string | undefined,
    taskId: args.taskId as string | undefined,
    dryRun,
    ...(error ? { error } : {}),
  };

  if (success) {
    // Publish remediation event
    await messageBus.publish('incident_remediated', {
      id: `evt-rem-${Date.now()}`,
      type: 'incident_remediated',
      payload: {
        incidentId,
        incidentType,
        playbook,
        automated: true,
        actionsPerformed: actions,
        executionTimeMs: result.executionTimeMs,
      },
      timestamp: Date.now(),
      customerId,
    });

    // Track auto-resolution success
    const countKey = `auto_resolution_count:${customerId}`;
    const existing = await kvStore.get(countKey);
    const count = existing ? parseInt(existing, 10) + 1 : 1;
    await kvStore.set(countKey, String(count));

    // Log incident record for learning
    try {
      const logger = getIncidentLogger();
      const partialIncident: Partial<Incident> = {
        id: incidentId,
        customerId,
        type: incidentType,
        status: 'resolved',
      };
      const record = logger.createRecord(partialIncident as Incident, undefined, result);
      await logger.log(record);
    } catch { /* Don't crash remediation on logging failure */ }

    // Update incident record with remediation result.
    // NOTE: IRelationalStore has no update() method yet, so we mutate the
    // queried row objects directly (works for InMemory; real adapters will
    // need an update() method added to the interface).
    try {
      const incidents = await relationalStore.query('incidents', (row) => row.id === incidentId);
      if (incidents.length > 0) {
        const incident = incidents[0];
        incident.remediation = JSON.stringify(result);
        incident.status = 'resolved';
        incident.resolvedAt = Date.now();
      }
    } catch { /* Don't crash remediation on store update failure */ }
  }

  // Emit incident.remediated metric for dw-observability
  await messageBus.publish('incident.remediated', {
    id: `metric-${Date.now()}`,
    type: 'incident.remediated',
    payload: {
      incidentId,
      incidentType,
      playbook,
      success,
      automated: true,
      durationMs: Date.now() - start,
    },
    timestamp: Date.now(),
    customerId,
  });

  span.setStatus(success ? 'ok' : 'error');
  span.end();

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
};

