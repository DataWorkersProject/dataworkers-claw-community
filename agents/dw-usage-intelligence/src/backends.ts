/**
 * Shared backend instances for the dw-usage-intelligence agent.
 *
 * Seeds deterministic usage data simulating 30 days of practitioner interactions:
 * - 20 practitioners across 3 teams
 * - 12 agents with 48 MCP tools
 * - Realistic temporal patterns (peak hours, weekday/weekend, Monday spikes)
 * - Embedded workflow sequences (catalog → schema → pipeline → quality)
 * - 5 power users, 10 regular, 5 occasional
 *
 * Also retains agent health + drift data from the original observability agent.
 *
 * CRITICAL: All data is deterministic. NO LLM calls anywhere.
 */

import { createHash } from 'crypto';
import { createRelationalStore, InMemoryRelationalStore, createKeyValueStore, InMemoryKeyValueStore, createMessageBus } from '@data-workers/infrastructure-stubs';

// ── Stores ──────────────────────────────────────────────────────────

export const relationalStore = await createRelationalStore();
export const kvStore = await createKeyValueStore();
export const messageBus = await createMessageBus();

// ── Injectable timestamp ──────────────────────────────────
// All tool handlers use this instead of Date.now() directly.
// Tests can override via setCurrentTimestamp() for determinism.

let _timestampOverride: number | null = null;

/** Returns the current timestamp. Uses override if set, otherwise Date.now(). */
export function getCurrentTimestamp(): number {
  return _timestampOverride ?? Date.now();
}

/** Set a fixed timestamp for test determinism. Pass null to reset. */
export function setCurrentTimestamp(ts: number | null): void {
  _timestampOverride = ts;
}

// ── Constants ───────────────────────────────────────────────────────

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const minuteMs = 60 * 1000;

// ── Practitioners ───────────────────────────────────────────────────

interface Practitioner {
  userId: string;
  teamId: string;
  type: 'power_user' | 'regular' | 'occasional';
  /** Average daily tool calls */
  avgDailyCalls: number;
  /** Preferred agents (higher weight) */
  preferredAgents: string[];
}

const PRACTITIONERS: Practitioner[] = [
  // Power users (5) — 20-40 calls/day
  { userId: 'eng-sarah', teamId: 'platform', type: 'power_user', avgDailyCalls: 35, preferredAgents: ['pipelines', 'schema', 'quality'] },
  { userId: 'eng-raj', teamId: 'platform', type: 'power_user', avgDailyCalls: 30, preferredAgents: ['pipelines', 'incidents', 'streaming'] },
  { userId: 'eng-chen', teamId: 'analytics', type: 'power_user', avgDailyCalls: 28, preferredAgents: ['insights', 'catalog', 'quality'] },
  { userId: 'eng-maria', teamId: 'governance', type: 'power_user', avgDailyCalls: 25, preferredAgents: ['governance', 'catalog', 'schema'] },
  { userId: 'eng-alex', teamId: 'platform', type: 'power_user', avgDailyCalls: 32, preferredAgents: ['pipelines', 'migration', 'cost'] },
  // Regular users (10) — 8-18 calls/day
  { userId: 'eng-mike', teamId: 'platform', type: 'regular', avgDailyCalls: 15, preferredAgents: ['incidents', 'pipelines'] },
  { userId: 'eng-priya', teamId: 'analytics', type: 'regular', avgDailyCalls: 14, preferredAgents: ['insights', 'catalog'] },
  { userId: 'eng-james', teamId: 'platform', type: 'regular', avgDailyCalls: 12, preferredAgents: ['pipelines', 'streaming'] },
  { userId: 'eng-lisa', teamId: 'governance', type: 'regular', avgDailyCalls: 10, preferredAgents: ['governance', 'quality'] },
  { userId: 'eng-omar', teamId: 'analytics', type: 'regular', avgDailyCalls: 11, preferredAgents: ['insights', 'schema'] },
  { userId: 'eng-kim', teamId: 'platform', type: 'regular', avgDailyCalls: 13, preferredAgents: ['pipelines', 'cost'] },
  { userId: 'eng-david', teamId: 'analytics', type: 'regular', avgDailyCalls: 9, preferredAgents: ['catalog', 'insights'] },
  { userId: 'eng-anna', teamId: 'governance', type: 'regular', avgDailyCalls: 8, preferredAgents: ['governance', 'schema'] },
  { userId: 'eng-tom', teamId: 'platform', type: 'regular', avgDailyCalls: 16, preferredAgents: ['incidents', 'streaming'] },
  { userId: 'eng-nina', teamId: 'analytics', type: 'regular', avgDailyCalls: 18, preferredAgents: ['quality', 'catalog'] },
  // Occasional users (5) — 1-5 calls/day
  { userId: 'eng-pat', teamId: 'platform', type: 'occasional', avgDailyCalls: 3, preferredAgents: ['incidents'] },
  { userId: 'eng-sam', teamId: 'analytics', type: 'occasional', avgDailyCalls: 2, preferredAgents: ['insights'] },
  { userId: 'eng-eva', teamId: 'governance', type: 'occasional', avgDailyCalls: 4, preferredAgents: ['governance'] },
  { userId: 'eng-leo', teamId: 'platform', type: 'occasional', avgDailyCalls: 1, preferredAgents: ['pipelines'] },
  { userId: 'eng-zoe', teamId: 'analytics', type: 'occasional', avgDailyCalls: 5, preferredAgents: ['catalog'] },
];

// ── Agents and Tools ────────────────────────────────────────────────

const AGENT_TOOLS: Record<string, string[]> = {
  pipelines: ['build_pipeline', 'get_pipeline_status', 'validate_pipeline', 'optimize_pipeline'],
  incidents: ['detect_anomaly', 'get_incident_status', 'run_playbook', 'resolve_incident'],
  catalog: ['search_assets', 'get_lineage', 'enrich_metadata', 'crawl_catalog', 'get_asset_details', 'register_asset'],
  schema: ['validate_schema', 'diff_schema', 'evolve_schema', 'get_schema_history'],
  quality: ['run_quality_check', 'get_quality_profile', 'detect_quality_anomaly', 'get_quality_trends'],
  governance: ['check_policy', 'scan_pii', 'grant_access', 'audit_compliance', 'review_policy'],
  cost: ['get_cost_report', 'estimate_cost', 'detect_cost_anomaly', 'recommend_archival'],
  migration: ['translate_sql', 'validate_migration', 'plan_migration', 'execute_migration'],
  insights: ['query_data', 'explain_anomaly', 'get_data_summary'],
  observability: ['get_agent_metrics', 'get_audit_trail', 'check_agent_health', 'detect_drift', 'get_evaluation_report', 'list_active_agents'],
  streaming: ['configure_connector', 'monitor_lag', 'get_consumer_status', 'scale_partitions'],
  orchestration: ['schedule_task', 'get_task_status', 'cancel_task', 'list_workflows'],
};

const ALL_AGENTS = Object.keys(AGENT_TOOLS);

// ── Workflow Templates ──────────────────────────────────────────────

const WORKFLOW_TEMPLATES = [
  // Discovery → build → verify
  ['catalog:search_assets', 'schema:validate_schema', 'pipelines:build_pipeline', 'quality:run_quality_check'],
  // Incident response
  ['incidents:detect_anomaly', 'incidents:get_incident_status', 'pipelines:get_pipeline_status', 'incidents:resolve_incident'],
  // Schema evolution
  ['schema:diff_schema', 'schema:validate_schema', 'schema:evolve_schema', 'quality:run_quality_check'],
  // Governance review
  ['governance:check_policy', 'governance:scan_pii', 'catalog:get_lineage', 'governance:audit_compliance'],
  // Cost optimization
  ['cost:get_cost_report', 'cost:detect_cost_anomaly', 'cost:recommend_archival', 'pipelines:optimize_pipeline'],
  // Migration workflow
  ['migration:plan_migration', 'migration:translate_sql', 'migration:validate_migration', 'migration:execute_migration'],
  // Data exploration
  ['catalog:search_assets', 'insights:query_data', 'insights:explain_anomaly'],
  // Streaming setup
  ['streaming:configure_connector', 'streaming:monitor_lag', 'streaming:get_consumer_status'],
];

// ── Deterministic RNG ───────────────────────────────────────────────

function deterministicRandom(seed: number): number {
  // Simple LCG
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  return ((a * seed + c) % m) / m;
}

function hashSeed(str: string, extra: number): number {
  let h = extra;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── SHA-256 hash chain ──────────────────────────────────────────────

function computeHash(content: string, previousHash: string): string {
  return createHash('sha256').update(content + previousHash).digest('hex');
}

// ── Seed data ───────────────────────────────────────────────────────

/** Tool input summary templates */
const INPUT_SUMMARIES: Record<string, string> = {
  build_pipeline: 'source=warehouse.orders, sink=lake.orders_v2',
  get_pipeline_status: 'pipeline_id=pipe-2847',
  validate_pipeline: 'pipeline_id=pipe-2847, check=schema_compat',
  optimize_pipeline: 'pipeline_id=pipe-2847, target=latency',
  detect_anomaly: 'dataset=orders, window=1h',
  get_incident_status: 'incident_id=inc-0442',
  run_playbook: 'playbook=stale_data_remediation',
  resolve_incident: 'incident_id=inc-0442, resolution=auto_remediated',
  search_assets: 'query=customer orders, scope=production',
  get_lineage: 'asset=orders, depth=3',
  enrich_metadata: 'asset=orders, tags=pii,financial',
  crawl_catalog: 'source=iceberg, namespace=analytics',
  get_asset_details: 'asset=orders',
  register_asset: 'name=orders_v2, type=table',
  validate_schema: 'table=orders, check=backward_compat',
  diff_schema: 'table=orders, version=v3..v4',
  evolve_schema: 'table=orders, add_column=region',
  get_schema_history: 'table=orders, limit=10',
  run_quality_check: 'dataset=orders, checks=null_rate,freshness',
  get_quality_profile: 'dataset=orders',
  detect_quality_anomaly: 'dataset=orders, metric=null_rate',
  get_quality_trends: 'dataset=orders, period=30d',
  check_policy: 'asset=orders, policy=retention',
  scan_pii: 'table=customers, columns=*',
  grant_access: 'user=eng-new, asset=orders, role=reader',
  audit_compliance: 'scope=production, standard=soc2',
  review_policy: 'policy_id=pol-retention-90d',
  get_cost_report: 'period=30d, group_by=agent',
  estimate_cost: 'query=SELECT * FROM orders WHERE region=US',
  detect_cost_anomaly: 'period=7d',
  recommend_archival: 'dataset=legacy_orders, threshold=90d',
  translate_sql: 'source=oracle, target=snowflake',
  validate_migration: 'migration_id=mig-0023',
  plan_migration: 'source=teradata, tables=orders,customers',
  execute_migration: 'migration_id=mig-0023, mode=dry_run',
  query_data: 'nl_query=top 10 customers by revenue last quarter',
  explain_anomaly: 'metric=order_volume, direction=drop',
  get_data_summary: 'dataset=orders',
  get_agent_metrics: 'agentName=pipelines, period=7d',
  get_audit_trail: 'limit=20',
  check_agent_health: 'agentName=pipelines',
  detect_drift: 'agentName=governance',
  get_evaluation_report: 'agentName=quality',
  list_active_agents: '',
  configure_connector: 'type=jdbc, source=postgres',
  monitor_lag: 'consumer_group=etl-pipeline',
  get_consumer_status: 'consumer_group=etl-pipeline',
  scale_partitions: 'topic=events, partitions=12',
  schedule_task: 'task=daily_quality_check, cron=0 9 * * *',
  get_task_status: 'task_id=task-1847',
  cancel_task: 'task_id=task-1847',
  list_workflows: 'status=active',
};

if (relationalStore instanceof InMemoryRelationalStore) {
  // ── Generate Usage Events ───────────────────────────────────────────

  await relationalStore.createTable('usage_events');
  await relationalStore.createTable('agent_metrics');
  await relationalStore.createTable('audit_trail');
  await relationalStore.createTable('evaluation_scores');

  let previousHash = '0'.repeat(64); // genesis hash
  let eventCounter = 0;
  let sessionCounter = 0;

  /** Hour weights: higher = more likely to have calls at this hour */
  const HOUR_WEIGHTS = [
    2, 1, 1, 1, 1, 2,     // 00-05: overnight (low, some incident work)
    5, 8, 14, 16, 15, 12,  // 06-11: morning ramp-up, peak at 9-10
    10, 13, 16, 15, 12, 8, // 12-17: afternoon, peak at 14-15
    5, 3, 3, 2, 2, 2,      // 18-23: wind down
  ];

  // Generate events for 30 days
  for (let day = 29; day >= 0; day--) {
    const dayStart = now - day * dayMs;
    const dayOfWeek = new Date(dayStart).getDay(); // 0=Sunday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isMonday = dayOfWeek === 1;

    for (const practitioner of PRACTITIONERS) {
      // Weekend: reduce calls significantly
      let dailyCalls = practitioner.avgDailyCalls;
      if (isWeekend) {
        dailyCalls = Math.max(1, Math.floor(dailyCalls * 0.15));
        // Occasional users skip weekends entirely
        if (practitioner.type === 'occasional') continue;
      }
      if (isMonday) {
        dailyCalls = Math.floor(dailyCalls * 1.3); // Monday spike
      }

      // Add some day-to-day variance
      const daySeed = hashSeed(practitioner.userId, day);
      const variance = deterministicRandom(daySeed);
      dailyCalls = Math.max(1, Math.floor(dailyCalls * (0.7 + variance * 0.6)));

      // Decide if this user follows a workflow template today
      const workflowSeed = hashSeed(practitioner.userId, day * 100);
      const doWorkflow = deterministicRandom(workflowSeed) < 0.4; // 40% chance
      let workflowCalls = 0;

      if (doWorkflow && dailyCalls >= 3) {
        const templateIdx = hashSeed(practitioner.userId, day * 200) % WORKFLOW_TEMPLATES.length;
        const template = WORKFLOW_TEMPLATES[templateIdx];
        const sessionId = `sess-${String(++sessionCounter).padStart(5, '0')}`;
        const sessionStartHour = 9 + (hashSeed(practitioner.userId, day * 300) % 7); // 9-15

        for (let step = 0; step < template.length; step++) {
          const [agentName, toolName] = template[step].split(':');
          const callTimestamp = dayStart + sessionStartHour * hourMs + step * 5 * minuteMs;
          const eventId = `evt-${String(++eventCounter).padStart(5, '0')}`;
          const durationMs = 80 + (hashSeed(toolName, day + step) % 400);
          const outcome: 'success' | 'error' = deterministicRandom(hashSeed(toolName, day * step + 999)) < 0.95 ? 'success' : 'error';
          const tokenCount = 200 + (hashSeed(toolName, day) % 800);
          const inputSummary = INPUT_SUMMARIES[toolName] || `${toolName}_input`;

          const content = JSON.stringify({ id: eventId, timestamp: callTimestamp, userId: practitioner.userId, agentName, toolName });
          const hash = computeHash(content, previousHash);

          await relationalStore.insert('usage_events', {
            id: eventId,
            timestamp: callTimestamp,
            userId: practitioner.userId,
            teamId: practitioner.teamId,
            agentName,
            toolName,
            inputSummary,
            outcome,
            durationMs,
            tokenCount,
            sessionId,
            sequenceIndex: step,
            hash,
            previousHash,
          });

          previousHash = hash;
          workflowCalls++;
        }
      }

      // Fill remaining calls with individual tool uses
      const remainingCalls = dailyCalls - workflowCalls;
      let currentSessionId = `sess-${String(++sessionCounter).padStart(5, '0')}`;
      let sessionSeqIndex = 0;
      let lastCallHour = -1;

      for (let c = 0; c < remainingCalls; c++) {
        // Pick agent: weighted toward preferred agents
        const agentSeed = hashSeed(practitioner.userId, day * 1000 + c);
        let agentName: string;
        if (deterministicRandom(agentSeed) < 0.7 && practitioner.preferredAgents.length > 0) {
          agentName = practitioner.preferredAgents[agentSeed % practitioner.preferredAgents.length];
        } else {
          agentName = ALL_AGENTS[agentSeed % ALL_AGENTS.length];
        }

        // Pick tool from that agent
        const tools = AGENT_TOOLS[agentName];
        const toolIdx = hashSeed(practitioner.userId, day * 2000 + c * 7) % tools.length;
        const toolName = tools[toolIdx];

        // Pick hour weighted by HOUR_WEIGHTS
        const hourSeed = hashSeed(practitioner.userId, day * 3000 + c);
        const totalWeight = HOUR_WEIGHTS.reduce((s, w) => s + w, 0);
        let targetWeight = (hourSeed % totalWeight);
        let hour = 0;
        for (let h = 0; h < 24; h++) {
          targetWeight -= HOUR_WEIGHTS[h];
          if (targetWeight <= 0) { hour = h; break; }
        }

        // New session if gap > 30 min (different hour)
        if (Math.abs(hour - lastCallHour) > 1 || lastCallHour === -1) {
          currentSessionId = `sess-${String(++sessionCounter).padStart(5, '0')}`;
          sessionSeqIndex = 0;
        }
        lastCallHour = hour;

        const minuteOffset = hashSeed(practitioner.userId, day * 4000 + c) % 60;
        const callTimestamp = dayStart + hour * hourMs + minuteOffset * minuteMs;
        const eventId = `evt-${String(++eventCounter).padStart(5, '0')}`;
        const durationMs = 80 + (hashSeed(toolName, day + c) % 400);
        const outcome: 'success' | 'error' = deterministicRandom(hashSeed(toolName, day * c + 777)) < 0.93 ? 'success' : 'error';
        const tokenCount = 200 + (hashSeed(toolName, day + c) % 800);
        const inputSummary = INPUT_SUMMARIES[toolName] || `${toolName}_input`;

        const content = JSON.stringify({ id: eventId, timestamp: callTimestamp, userId: practitioner.userId, agentName, toolName });
        const hash = computeHash(content, previousHash);

        await relationalStore.insert('usage_events', {
          id: eventId,
          timestamp: callTimestamp,
          userId: practitioner.userId,
          teamId: practitioner.teamId,
          agentName,
          toolName,
          inputSummary,
          outcome,
          durationMs,
          tokenCount,
          sessionId: currentSessionId,
          sequenceIndex: sessionSeqIndex++,
          hash,
          previousHash,
        });

        previousHash = hash;
      }
    }
  }

  // ── Behavior shift seed data ──────────────────────────────
  // Inject 20 extra "cost:get_cost_report" calls on day 0 to create
  // a clear tool-distribution shift for the cost agent (baseline has
  // roughly even distribution across 4 cost tools).
  {
    const dayStart = now;
    for (let i = 0; i < 20; i++) {
      const eventId = `evt-${String(++eventCounter).padStart(5, '0')}`;
      const callTimestamp = dayStart - (i + 1) * 10 * minuteMs;
      const userId = PRACTITIONERS[i % 5].userId; // rotate across power users
      const teamId = PRACTITIONERS[i % 5].teamId;
      const agentName = 'cost';
      const toolName = 'get_cost_report';
      const inputSummary = INPUT_SUMMARIES[toolName];
      const durationMs = 100 + (i * 17 % 300);
      const tokenCount = 300 + (i * 31 % 500);
      const outcome: 'success' | 'error' = 'success';
      const sessionId = `sess-${String(++sessionCounter).padStart(5, '0')}`;

      const content = JSON.stringify({ id: eventId, timestamp: callTimestamp, userId, agentName, toolName });
      const hash = computeHash(content, previousHash);

      await relationalStore.insert('usage_events', {
        id: eventId, timestamp: callTimestamp, userId, teamId,
        agentName, toolName, inputSummary, outcome, durationMs,
        tokenCount, sessionId, sequenceIndex: 0, hash, previousHash,
      });

      previousHash = hash;
    }
  }

  // ── Retained: Agent metrics for drift detection ─────────────────────

  const HEALTH_AGENTS = ['pipelines', 'incidents', 'catalog', 'schema', 'quality', 'governance'];

  for (const agentName of HEALTH_AGENTS) {
    for (let day = 0; day < 7; day++) {
      const timestamp = now - day * dayMs;
      const seed = agentName.length * 17 + day * 13;
      const baseLatency = 50 + (seed % 100);

      await relationalStore.insert('agent_metrics', {
        agentName,
        timestamp,
        day,
        p50: baseLatency,
        p95: baseLatency * 2.5,
        p99: baseLatency * 4,
        errorRate: agentName === 'governance' ? 0.08 : 0.02 + (day * 0.002),
        totalInvocations: 1000 + seed * 10,
        avgTokens: 500 + (seed % 300),
        avgConfidence: 0.85 + (seed % 10) * 0.01,
        escalationRate: 0.05 + (seed % 5) * 0.01,
      });
    }
  }

  // ── Retained: SHA-256 hash-chain audit trail (20 entries) ───────────

  const auditActions = [
    'pipeline_executed', 'schema_validated', 'incident_detected', 'catalog_updated',
    'quality_check_passed', 'governance_review', 'pipeline_failed', 'schema_migrated',
    'incident_resolved', 'catalog_enriched', 'quality_check_failed', 'governance_approved',
    'pipeline_retried', 'schema_rollback', 'incident_escalated', 'catalog_deprecated',
    'quality_anomaly', 'governance_denied', 'pipeline_optimized', 'schema_published',
  ];

  let auditPreviousHash = '0'.repeat(64);

  for (let i = 0; i < 20; i++) {
    const agentName = HEALTH_AGENTS[i % HEALTH_AGENTS.length];
    const action = auditActions[i];
    const timestamp = now - (20 - i) * hourMs;
    const entryId = `audit-${String(i + 1).padStart(3, '0')}`;
    const input = `input_for_${action}`;
    const output = `result_of_${action}`;
    const confidence = 0.80 + (i % 10) * 0.02;

    const content = JSON.stringify({ id: entryId, timestamp, agentName, action, input, output, confidence });
    const hash = computeHash(content, auditPreviousHash);

    await relationalStore.insert('audit_trail', {
      id: entryId,
      timestamp,
      agentName,
      action,
      input,
      output,
      confidence,
      hash,
      previousHash: auditPreviousHash,
    });

    auditPreviousHash = hash;
  }

  // ── Retained: Evaluation scores ─────────────────────────────────────

  for (const agentName of HEALTH_AGENTS) {
    const seed = agentName.length * 7;
    for (let i = 0; i < 5; i++) {
      await relationalStore.insert('evaluation_scores', {
        agentName,
        evaluatedAt: now - i * dayMs,
        accuracy: 0.75 + ((seed + i) % 20) * 0.01,
        completeness: 0.70 + ((seed + i * 3) % 25) * 0.01,
        safety: 0.90 + ((seed + i * 2) % 10) * 0.01,
        helpfulness: 0.72 + ((seed + i * 5) % 22) * 0.01,
      });
    }
  }
}

// ── KV store seed: real-time health cache ───────────────────────────

if (kvStore instanceof InMemoryKeyValueStore) {
  const HEALTH_AGENTS = ['pipelines', 'incidents', 'catalog', 'schema', 'quality', 'governance'];

  for (const agentName of HEALTH_AGENTS) {
    const errorRate = agentName === 'governance' ? 0.08 : 0.02;
    const status = errorRate > 0.20 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy';

    await kvStore.set(`health:${agentName}`, JSON.stringify({
      agentName,
      status,
      lastHeartbeat: now - 10_000,
      startedAt: now - 3 * dayMs,
      errorRateLast5m: errorRate,
    }));
  }
}
