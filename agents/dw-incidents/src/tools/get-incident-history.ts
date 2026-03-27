import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { Incident, IncidentHistoryQuery } from '../types.js';
import { relationalStore, vectorStore, getMTTRTracker, getIncidentLogger } from '../backends.js';
import type { IncidentRecord } from '../learning/incident-logger.js';

function safeParseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const getIncidentHistoryDefinition: ToolDefinition = {
  name: 'get_incident_history',
  description: 'Query past incidents for pattern matching and learning. Supports filtering by type, severity, time range, and similarity to a current incident. Uses vector similarity for finding related historical incidents.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      type: { type: 'string', enum: ['schema_change', 'source_delay', 'resource_exhaustion', 'code_regression', 'infrastructure', 'quality_degradation'] },
      severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
      fromTimestamp: { type: 'number', description: 'Start of time range (epoch ms).' },
      toTimestamp: { type: 'number', description: 'End of time range (epoch ms).' },
      limit: { type: 'number', description: 'Max results. Default: 20.' },
      similarTo: { type: 'string', description: 'Incident description to find similar incidents for.' },
      includeMTTRReport: { type: 'boolean', description: 'If true, include 30-day MTTR rolling report.' },
    },
    required: ['customerId'],
  },
};

export const getIncidentHistoryHandler: ToolHandler = async (args) => {
  const query = args as unknown as IncidentHistoryQuery;
  const limit = query.limit ?? 20;

  // Query from relational store with filtering
  const rows = await relationalStore.query(
    'incidents',
    (row) => {
      if (row.customerId !== query.customerId) return false;
      if (query.type && row.type !== query.type) return false;
      if (query.severity && row.severity !== query.severity) return false;
      if (query.fromTimestamp && (row.detectedAt as number) < query.fromTimestamp) return false;
      if (query.toTimestamp && (row.detectedAt as number) > query.toTimestamp) return false;
      return true;
    },
    { column: 'detectedAt', direction: 'desc' },
    limit,
  );

  // Map rows to Incident objects
  const incidents: Incident[] = rows.map((row) => ({
    id: row.id as string,
    customerId: row.customerId as string,
    type: row.type as Incident['type'],
    severity: row.severity as Incident['severity'],
    status: row.status as Incident['status'],
    title: row.title as string,
    description: row.description as string,
    affectedResources: safeParseArray(row.affectedResources),
    detectedAt: row.detectedAt as number,
    resolvedAt: row.resolvedAt as number | undefined,
    confidence: row.confidence as number,
    metadata: {
      resolution: row.resolution as string,
      playbook: row.playbook as string | null,
    },
  }));

  // Find similar incidents via vector store if requested
  let similarIncidents: Array<{ id: string; score: number; type: string }> = [];
  if (query.similarTo) {
    const queryVector = await vectorStore.embed(query.similarTo);
    const results = await vectorStore.query(queryVector, 5, 'incidents', (metadata) => {
      return metadata.customerId === query.customerId;
    });
    similarIncidents = results.map((r) => ({
      id: r.id,
      score: r.score,
      type: r.metadata.type as string,
    }));
  }

  // Calculate MTTR metrics
  const resolved = incidents.filter((i) => i.resolvedAt);
  const avgResolutionTimeMs = resolved.length > 0
    ? resolved.reduce((sum, i) => sum + (i.resolvedAt! - i.detectedAt), 0) / resolved.length
    : 0;
  const autoResolved = incidents.filter((i) => i.metadata?.resolution === 'automated');
  const autoResolvedPercent = incidents.length > 0
    ? (autoResolved.length / incidents.length) * 100
    : 0;

  const summary: Record<string, unknown> = {
    totalIncidents: incidents.length,
    byType: countByField(incidents, 'type'),
    bySeverity: countByField(incidents, 'severity'),
    avgResolutionTimeMs,
    autoResolvedPercent,
    mttrMinutes: avgResolutionTimeMs / 60_000,
    ...(similarIncidents.length > 0 ? { similarIncidents } : {}),
    incidents,
  };

  // Wire MTTRTracker report when requested
  if ((args as Record<string, unknown>).includeMTTRReport) {
    const tracker = getMTTRTracker();

    // Get records from incident_log table
    const logger = getIncidentLogger();
    const logRecords = await logger.getRecords(query.customerId, 1000);

    // Also adapt legacy incidents table rows to IncidentRecord format
    const legacyRecords: IncidentRecord[] = incidents.map(inc => ({
      incidentId: inc.id,
      customerId: inc.customerId,
      timeline: {
        detectedAt: inc.detectedAt,
        resolvedAt: inc.resolvedAt,
        totalDurationMs: inc.resolvedAt ? inc.resolvedAt - inc.detectedAt : undefined,
      },
      diagnosis: {
        type: inc.type,
        severity: inc.severity,
        confidence: inc.confidence,
      },
      outcome: {
        resolved: inc.status === 'resolved',
        automated: inc.metadata?.resolution === 'automated',
        falsePositive: false,
        resolutionMethod: inc.metadata?.resolution === 'automated' ? 'auto_playbook' as const : 'manual_human' as const,
      },
      createdAt: inc.detectedAt,
    }));

    const allRecords = [...logRecords, ...legacyRecords];
    const mttrReport = tracker.generateReport(allRecords, query.customerId);

    summary.mttrReport = mttrReport;
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
  };
};

function countByField(incidents: Incident[], field: keyof Incident): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const inc of incidents) {
    const val = String(inc[field]);
    counts[val] = (counts[val] ?? 0) + 1;
  }
  return counts;
}
