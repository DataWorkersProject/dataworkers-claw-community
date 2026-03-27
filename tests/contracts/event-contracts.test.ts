import { z } from 'zod';
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Base event envelope — all events must include these fields
// ---------------------------------------------------------------------------
const BaseEventSchema = z.object({
  eventType: z.string(),
  timestamp: z.number(),
  customerId: z.string(),
  sourceAgent: z.string(),
  correlationId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 1. pipeline_created
// ---------------------------------------------------------------------------
const PipelineCreatedSchema = BaseEventSchema.extend({
  eventType: z.literal('pipeline_created'),
  pipelineId: z.string(),
  pipelineName: z.string(),
  source: z.string().nullable(),
  target: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// 2. pipeline_deployed
// ---------------------------------------------------------------------------
const PipelineDeployedSchema = BaseEventSchema.extend({
  eventType: z.literal('pipeline_deployed'),
  pipelineId: z.string(),
  pipelineName: z.string(),
  deploymentId: z.string(),
  orchestrator: z.enum(['airflow', 'dagster', 'prefect']),
  environment: z.enum(['staging', 'production']),
});

// ---------------------------------------------------------------------------
// 3. incident_detected
// ---------------------------------------------------------------------------
const IncidentDetectedSchema = BaseEventSchema.extend({
  eventType: z.literal('incident_detected'),
  incidentId: z.string(),
  incidentType: z.enum([
    'schema_change',
    'source_delay',
    'resource_exhaustion',
    'code_regression',
    'infrastructure',
    'quality_degradation',
  ]),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  confidence: z.number().min(0).max(1),
  affectedResources: z.array(z.string()),
  title: z.string(),
});

// ---------------------------------------------------------------------------
// 4. incident_escalated
// ---------------------------------------------------------------------------
const IncidentEscalatedSchema = BaseEventSchema.extend({
  eventType: z.literal('incident_escalated'),
  incidentId: z.string(),
  incidentType: z.string(),
  reason: z.string().optional(),
  error: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 5. incident_remediated
// ---------------------------------------------------------------------------
const IncidentRemediatedSchema = BaseEventSchema.extend({
  eventType: z.literal('incident_remediated'),
  incidentId: z.string(),
  incidentType: z.string(),
  playbook: z.string(),
  automated: z.boolean(),
  actionsPerformed: z.array(z.string()),
  executionTimeMs: z.number(),
});

// ---------------------------------------------------------------------------
// 6. schema_changed (stub — contract for future implementation)
// ---------------------------------------------------------------------------
const SchemaChangedSchema = BaseEventSchema.extend({
  eventType: z.literal('schema_changed'),
  datasetId: z.string(),
  changeType: z.enum(['column_added', 'column_removed', 'column_renamed', 'type_changed']),
  changes: z.array(
    z.object({
      column: z.string(),
      before: z.string().optional(),
      after: z.string().optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// 7. quality_alert
// ---------------------------------------------------------------------------
const QualityAlertSchema = BaseEventSchema.extend({
  eventType: z.literal('quality_alert'),
  datasetId: z.string(),
  metric: z.string(),
  value: z.number(),
  threshold: z.number(),
  severity: z.enum(['critical', 'warning', 'info']),
});

// ---------------------------------------------------------------------------
// 8. access_granted
// ---------------------------------------------------------------------------
const AccessGrantedSchema = BaseEventSchema.extend({
  eventType: z.literal('access_granted'),
  userId: z.string(),
  resource: z.string(),
  accessLevel: z.string(),
  expiresAt: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Sample event factories
// ---------------------------------------------------------------------------
function baseFields(sourceAgent: string) {
  return {
    timestamp: Date.now(),
    customerId: 'cust-001',
    sourceAgent,
    correlationId: 'corr-abc-123',
  };
}

const sampleEvents = {
  pipeline_created: {
    eventType: 'pipeline_created' as const,
    ...baseFields('dw-pipelines'),
    pipelineId: 'pipe-001',
    pipelineName: 'user-events-to-warehouse',
    source: 'kafka://user-events',
    target: 'snowflake://analytics.user_events',
  },
  pipeline_deployed: {
    eventType: 'pipeline_deployed' as const,
    ...baseFields('dw-pipelines'),
    pipelineId: 'pipe-001',
    pipelineName: 'user-events-to-warehouse',
    deploymentId: 'deploy-001',
    orchestrator: 'airflow' as const,
    environment: 'production' as const,
  },
  incident_detected: {
    eventType: 'incident_detected' as const,
    ...baseFields('dw-incidents'),
    incidentId: 'inc-001',
    incidentType: 'schema_change' as const,
    severity: 'high' as const,
    confidence: 0.92,
    affectedResources: ['dataset:users', 'pipeline:user-events'],
    title: 'Schema drift detected on users table',
  },
  incident_escalated: {
    eventType: 'incident_escalated' as const,
    ...baseFields('dw-incidents'),
    incidentId: 'inc-001',
    incidentType: 'schema_change',
    reason: 'Auto-remediation failed after 3 attempts',
  },
  incident_remediated: {
    eventType: 'incident_remediated' as const,
    ...baseFields('dw-incidents'),
    incidentId: 'inc-001',
    incidentType: 'schema_change',
    playbook: 'schema-drift-rollback',
    automated: true,
    actionsPerformed: ['snapshot_schema', 'rollback_migration', 'verify_data'],
    executionTimeMs: 4520,
  },
  schema_changed: {
    eventType: 'schema_changed' as const,
    ...baseFields('dw-schema'),
    datasetId: 'ds-users',
    changeType: 'column_added' as const,
    changes: [{ column: 'last_login_ip', after: 'VARCHAR(45)' }],
  },
  quality_alert: {
    eventType: 'quality_alert' as const,
    ...baseFields('dw-quality'),
    datasetId: 'ds-users',
    metric: 'null_ratio',
    value: 0.35,
    threshold: 0.1,
    severity: 'critical' as const,
  },
  access_granted: {
    eventType: 'access_granted' as const,
    ...baseFields('dw-governance'),
    userId: 'user-042',
    resource: 'dataset:financials',
    accessLevel: 'read',
    expiresAt: Date.now() + 86_400_000,
  },
};

// Schema lookup for iteration
const schemas: Record<string, z.ZodTypeAny> = {
  pipeline_created: PipelineCreatedSchema,
  pipeline_deployed: PipelineDeployedSchema,
  incident_detected: IncidentDetectedSchema,
  incident_escalated: IncidentEscalatedSchema,
  incident_remediated: IncidentRemediatedSchema,
  schema_changed: SchemaChangedSchema,
  quality_alert: QualityAlertSchema,
  access_granted: AccessGrantedSchema,
};

// ===================================================================
// Tests
// ===================================================================

describe('Event Schema Definitions', () => {
  // --- pipeline_created ---
  it('validates a valid pipeline_created event', () => {
    const result = PipelineCreatedSchema.safeParse(sampleEvents.pipeline_created);
    expect(result.success).toBe(true);
  });

  it('rejects pipeline_created event with missing required fields', () => {
    const result = PipelineCreatedSchema.safeParse({
      eventType: 'pipeline_created',
      timestamp: Date.now(),
      // missing customerId, sourceAgent, pipelineId, pipelineName, source, target
    });
    expect(result.success).toBe(false);
  });

  // --- pipeline_deployed ---
  it('validates a valid pipeline_deployed event', () => {
    const result = PipelineDeployedSchema.safeParse(sampleEvents.pipeline_deployed);
    expect(result.success).toBe(true);
  });

  it('rejects pipeline_deployed event with missing required fields', () => {
    const result = PipelineDeployedSchema.safeParse({
      eventType: 'pipeline_deployed',
      timestamp: Date.now(),
      customerId: 'cust-001',
      sourceAgent: 'dw-pipelines',
      // missing pipelineId, pipelineName, deploymentId, orchestrator, environment
    });
    expect(result.success).toBe(false);
  });

  // --- incident_detected ---
  it('validates a valid incident_detected event', () => {
    const result = IncidentDetectedSchema.safeParse(sampleEvents.incident_detected);
    expect(result.success).toBe(true);
  });

  it('rejects incident_detected event with missing required fields', () => {
    const result = IncidentDetectedSchema.safeParse({
      eventType: 'incident_detected',
      timestamp: Date.now(),
      customerId: 'cust-001',
      sourceAgent: 'dw-incidents',
      // missing incidentId, incidentType, severity, confidence, affectedResources, title
    });
    expect(result.success).toBe(false);
  });

  // --- incident_escalated ---
  it('validates a valid incident_escalated event', () => {
    const result = IncidentEscalatedSchema.safeParse(sampleEvents.incident_escalated);
    expect(result.success).toBe(true);
  });

  it('rejects incident_escalated event with missing required fields', () => {
    const result = IncidentEscalatedSchema.safeParse({
      eventType: 'incident_escalated',
      // missing timestamp, customerId, sourceAgent, incidentId, incidentType
    });
    expect(result.success).toBe(false);
  });

  // --- incident_remediated ---
  it('validates a valid incident_remediated event', () => {
    const result = IncidentRemediatedSchema.safeParse(sampleEvents.incident_remediated);
    expect(result.success).toBe(true);
  });

  it('rejects incident_remediated event with missing required fields', () => {
    const result = IncidentRemediatedSchema.safeParse({
      eventType: 'incident_remediated',
      timestamp: Date.now(),
      customerId: 'cust-001',
      sourceAgent: 'dw-incidents',
      incidentId: 'inc-001',
      // missing incidentType, playbook, automated, actionsPerformed, executionTimeMs
    });
    expect(result.success).toBe(false);
  });

  // --- schema_changed ---
  it('validates a valid schema_changed event', () => {
    const result = SchemaChangedSchema.safeParse(sampleEvents.schema_changed);
    expect(result.success).toBe(true);
  });

  it('rejects schema_changed event with missing required fields', () => {
    const result = SchemaChangedSchema.safeParse({
      eventType: 'schema_changed',
      timestamp: Date.now(),
      customerId: 'cust-001',
      sourceAgent: 'dw-schema',
      // missing datasetId, changeType, changes
    });
    expect(result.success).toBe(false);
  });

  // --- quality_alert ---
  it('validates a valid quality_alert event', () => {
    const result = QualityAlertSchema.safeParse(sampleEvents.quality_alert);
    expect(result.success).toBe(true);
  });

  it('rejects quality_alert event with missing required fields', () => {
    const result = QualityAlertSchema.safeParse({
      eventType: 'quality_alert',
      timestamp: Date.now(),
      customerId: 'cust-001',
      sourceAgent: 'dw-quality',
      // missing datasetId, metric, value, threshold, severity
    });
    expect(result.success).toBe(false);
  });

  // --- access_granted ---
  it('validates a valid access_granted event', () => {
    const result = AccessGrantedSchema.safeParse(sampleEvents.access_granted);
    expect(result.success).toBe(true);
  });

  it('rejects access_granted event with missing required fields', () => {
    const result = AccessGrantedSchema.safeParse({
      eventType: 'access_granted',
      timestamp: Date.now(),
      customerId: 'cust-001',
      sourceAgent: 'dw-governance',
      // missing userId, resource, accessLevel
    });
    expect(result.success).toBe(false);
  });

  // --- Additional validation edge cases ---
  it('rejects incident_detected with confidence > 1', () => {
    const result = IncidentDetectedSchema.safeParse({
      ...sampleEvents.incident_detected,
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects incident_detected with confidence < 0', () => {
    const result = IncidentDetectedSchema.safeParse({
      ...sampleEvents.incident_detected,
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects pipeline_deployed with invalid orchestrator', () => {
    const result = PipelineDeployedSchema.safeParse({
      ...sampleEvents.pipeline_deployed,
      orchestrator: 'luigi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects pipeline_deployed with invalid environment', () => {
    const result = PipelineDeployedSchema.safeParse({
      ...sampleEvents.pipeline_deployed,
      environment: 'development',
    });
    expect(result.success).toBe(false);
  });

  it('accepts pipeline_created with null source and target', () => {
    const result = PipelineCreatedSchema.safeParse({
      ...sampleEvents.pipeline_created,
      source: null,
      target: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts access_granted without optional expiresAt', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { expiresAt, ...withoutExpiry } = sampleEvents.access_granted;
    const result = AccessGrantedSchema.safeParse(withoutExpiry);
    expect(result.success).toBe(true);
  });
});

describe('Cross-Agent Event Routes', () => {
  it('pipeline_created from dw-pipelines is consumable by dw-catalog', () => {
    const event = {
      ...sampleEvents.pipeline_created,
      sourceAgent: 'dw-pipelines',
    };
    const result = PipelineCreatedSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceAgent).toBe('dw-pipelines');
      expect(result.data.pipelineId).toBeDefined();
      expect(result.data.pipelineName).toBeDefined();
    }
  });

  it('incident_detected from dw-incidents is consumable by dw-observability', () => {
    const event = {
      ...sampleEvents.incident_detected,
      sourceAgent: 'dw-incidents',
    };
    const result = IncidentDetectedSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceAgent).toBe('dw-incidents');
      expect(result.data.severity).toBeDefined();
      expect(result.data.affectedResources.length).toBeGreaterThan(0);
    }
  });

  it('schema_changed from dw-schema is consumable by dw-quality', () => {
    const event = {
      ...sampleEvents.schema_changed,
      sourceAgent: 'dw-schema',
    };
    const result = SchemaChangedSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceAgent).toBe('dw-schema');
      expect(result.data.datasetId).toBeDefined();
      expect(result.data.changes.length).toBeGreaterThan(0);
    }
  });

  it('quality_alert from dw-quality is consumable by dw-incidents', () => {
    const event = {
      ...sampleEvents.quality_alert,
      sourceAgent: 'dw-quality',
    };
    const result = QualityAlertSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceAgent).toBe('dw-quality');
      expect(result.data.value).toBeGreaterThan(result.data.threshold);
    }
  });

  it('incident_remediated from dw-incidents is consumable by dw-observability', () => {
    const event = {
      ...sampleEvents.incident_remediated,
      sourceAgent: 'dw-incidents',
    };
    const result = IncidentRemediatedSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceAgent).toBe('dw-incidents');
      expect(result.data.actionsPerformed.length).toBeGreaterThan(0);
    }
  });

  it('access_granted from dw-governance is consumable by dw-catalog', () => {
    const event = {
      ...sampleEvents.access_granted,
      sourceAgent: 'dw-governance',
    };
    const result = AccessGrantedSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceAgent).toBe('dw-governance');
      expect(result.data.userId).toBeDefined();
      expect(result.data.resource).toBeDefined();
    }
  });
});

describe('Event Envelope Consistency', () => {
  const allSchemaNames = Object.keys(schemas);

  it('all event schemas require timestamp', () => {
    for (const name of allSchemaNames) {
      const schema = schemas[name];
      const event = { ...sampleEvents[name as keyof typeof sampleEvents] };
      delete (event as Record<string, unknown>).timestamp;
      const result = schema.safeParse(event);
      expect(result.success, `${name} should reject missing timestamp`).toBe(false);
    }
  });

  it('all event schemas require customerId', () => {
    for (const name of allSchemaNames) {
      const schema = schemas[name];
      const event = { ...sampleEvents[name as keyof typeof sampleEvents] };
      delete (event as Record<string, unknown>).customerId;
      const result = schema.safeParse(event);
      expect(result.success, `${name} should reject missing customerId`).toBe(false);
    }
  });

  it('all event schemas require sourceAgent', () => {
    for (const name of allSchemaNames) {
      const schema = schemas[name];
      const event = { ...sampleEvents[name as keyof typeof sampleEvents] };
      delete (event as Record<string, unknown>).sourceAgent;
      const result = schema.safeParse(event);
      expect(result.success, `${name} should reject missing sourceAgent`).toBe(false);
    }
  });

  it('all event schemas accept optional correlationId', () => {
    for (const name of allSchemaNames) {
      const schema = schemas[name];
      const event = { ...sampleEvents[name as keyof typeof sampleEvents] };
      delete (event as Record<string, unknown>).correlationId;
      const result = schema.safeParse(event);
      expect(result.success, `${name} should accept missing correlationId`).toBe(true);
    }
  });

  it('all event schemas require eventType to be a string', () => {
    for (const name of allSchemaNames) {
      const schema = schemas[name];
      const event = { ...sampleEvents[name as keyof typeof sampleEvents], eventType: 12345 };
      const result = schema.safeParse(event);
      expect(result.success, `${name} should reject numeric eventType`).toBe(false);
    }
  });

  it('all event schemas reject timestamp as string', () => {
    for (const name of allSchemaNames) {
      const schema = schemas[name];
      const event = {
        ...sampleEvents[name as keyof typeof sampleEvents],
        timestamp: '2026-01-01T00:00:00Z',
      };
      const result = schema.safeParse(event);
      expect(result.success, `${name} should reject string timestamp`).toBe(false);
    }
  });
});
