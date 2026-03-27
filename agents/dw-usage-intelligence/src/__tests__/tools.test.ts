import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { server } from '../index.js';
import { relationalStore, kvStore } from '../backends.js';

describe('dw-usage-intelligence MCP Server', () => {
  it('registers all 26 tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(26);
    expect(tools.map((t) => t.name)).toEqual([
      // Usage Analytics (7 new)
      'get_tool_usage_metrics',
      'get_usage_activity_log',
      'get_adoption_dashboard',
      'detect_usage_anomalies',
      'get_workflow_patterns',
      'get_usage_heatmap',
      'get_session_analytics',
      // Agent Observability (6 retained)
      'get_agent_metrics',
      'get_audit_trail',
      'check_agent_health',
      'detect_drift',
      'get_evaluation_report',
      'list_active_agents',
      // Pro-tier tools (4)
      'schedule_anomaly_scan',
      'export_usage_report',
      'configure_usage_alerts',
      'set_adoption_targets',
      // P3 tools (1)
      'verify_global_hash_chain',
      // P4 tools (8)
      'cross_agent_query',
      'get_metering_summary',
      'get_cost_enrichment',
      'publish_usage_events',
      'get_anomaly_context',
      'register_usage_datasets',
      'ingest_otel_spans',
      'export_otel_spans',
    ]);
  });

  // ── get_tool_usage_metrics ──────────────────────────────────────────

  describe('get_tool_usage_metrics', () => {
    it('returns metrics grouped by tool', async () => {
      const result = await server.callTool('get_tool_usage_metrics', { period: '30d' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.period).toBe('30d');
      expect(data.groupBy).toBe('tool');
      expect(data.metrics.length).toBeGreaterThan(0);
      expect(data.summary.totalCalls).toBeGreaterThan(0);
      expect(data.summary.totalUniqueUsers).toBeGreaterThan(0);
      expect(data.summary.mostUsedTool).toBeDefined();
      expect(data.summary.leastUsedTool).toBeDefined();
    });

    it('each metric has required fields', async () => {
      const result = await server.callTool('get_tool_usage_metrics', { period: '7d' });
      const data = JSON.parse(result.content[0].text!);

      for (const metric of data.metrics) {
        expect(metric.name).toBeDefined();
        expect(metric.totalCalls).toBeGreaterThan(0);
        expect(metric.uniqueUsers).toBeGreaterThan(0);
        expect(metric.avgCallsPerUser).toBeGreaterThan(0);
        expect(metric.avgResponseTimeMs).toBeGreaterThan(0);
        expect(['up', 'down', 'stable']).toContain(metric.trendDirection);
        expect(typeof metric.trendPercentage).toBe('number');
        expect(metric.peakHour).toBeGreaterThanOrEqual(0);
        expect(metric.peakHour).toBeLessThan(24);
      }
    });

    it('filters by agent name', async () => {
      const result = await server.callTool('get_tool_usage_metrics', { agentName: 'pipelines', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      for (const metric of data.metrics) {
        expect(metric.agent).toBe('pipelines');
      }
    });

    it('groups by agent', async () => {
      const result = await server.callTool('get_tool_usage_metrics', { groupBy: 'agent', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.groupBy).toBe('agent');
      const names = data.metrics.map((m: { name: string }) => m.name);
      expect(names).toContain('pipelines');
    });

    it('groups by user', async () => {
      const result = await server.callTool('get_tool_usage_metrics', { groupBy: 'user', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.groupBy).toBe('user');
      const names = data.metrics.map((m: { name: string }) => m.name);
      expect(names).toContain('eng-sarah');
    });

    it('supports 1d period', async () => {
      const result = await server.callTool('get_tool_usage_metrics', { period: '1d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.period).toBe('1d');
    });
  });

  // ── get_usage_activity_log ──────────────────────────────────────────

  describe('get_usage_activity_log', () => {
    it('returns activity entries with hash chain', async () => {
      const result = await server.callTool('get_usage_activity_log', { since: '30d', limit: 10 });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.entries.length).toBeGreaterThan(0);
      expect(data.entries.length).toBeLessThanOrEqual(10);
      expect(data.totalEntries).toBeGreaterThan(0);
      expect(['valid', 'broken']).toContain(data.chainIntegrity);
    });

    it('entries have required fields', async () => {
      const result = await server.callTool('get_usage_activity_log', { since: '7d', limit: 5 });
      const data = JSON.parse(result.content[0].text!);

      for (const entry of data.entries) {
        expect(entry.id).toBeDefined();
        expect(entry.timestamp).toBeGreaterThan(0);
        expect(entry.userId).toBeDefined();
        expect(entry.agentName).toBeDefined();
        expect(entry.toolName).toBeDefined();
        expect(entry.inputSummary).toBeDefined();
        expect(['success', 'error']).toContain(entry.outcome);
        expect(entry.durationMs).toBeGreaterThan(0);
        expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
        expect(entry.previousHash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('filters by userId', async () => {
      const result = await server.callTool('get_usage_activity_log', { userId: 'eng-sarah', since: '30d', limit: 20 });
      const data = JSON.parse(result.content[0].text!);
      for (const entry of data.entries) {
        expect(entry.userId).toBe('eng-sarah');
      }
    });

    it('filters by agentName', async () => {
      const result = await server.callTool('get_usage_activity_log', { agentName: 'pipelines', since: '30d', limit: 20 });
      const data = JSON.parse(result.content[0].text!);
      for (const entry of data.entries) {
        expect(entry.agentName).toBe('pipelines');
      }
    });
  });

  // ── get_adoption_dashboard ──────────────────────────────────────────

  describe('get_adoption_dashboard', () => {
    it('returns adoption data for all agents', async () => {
      const result = await server.callTool('get_adoption_dashboard', { period: '30d' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.period).toBe('30d');
      expect(data.agents.length).toBeGreaterThan(0);
      expect(data.platformSummary.totalPractitioners).toBe(20);
      expect(data.platformSummary.activePractitioners).toBeGreaterThan(0);
      expect(data.platformSummary.fastestGrowingAgent).toBeDefined();
      expect(data.platformSummary.needsAttentionAgent).toBeDefined();
    });

    it('each agent has adoption status', async () => {
      const result = await server.callTool('get_adoption_dashboard', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      for (const agent of data.agents) {
        expect(agent.agentName).toBeDefined();
        expect(['fully_adopted', 'growing', 'underused', 'shelfware']).toContain(agent.status);
        expect(agent.totalUsers).toBeGreaterThan(0);
        expect(agent.adoptionRate).toBeGreaterThanOrEqual(0);
        expect(agent.adoptionRate).toBeLessThanOrEqual(1);
        expect(agent.totalCalls).toBeGreaterThan(0);
        expect(typeof agent.weekOverWeekGrowth).toBe('number');
        expect(Array.isArray(agent.topTools)).toBe(true);
      }
    });

    it('supports 7d period', async () => {
      const result = await server.callTool('get_adoption_dashboard', { period: '7d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.period).toBe('7d');
    });
  });

  // ── detect_usage_anomalies ──────────────────────────────────────────

  describe('detect_usage_anomalies', () => {
    it('returns anomaly results', async () => {
      const result = await server.callTool('detect_usage_anomalies', {});
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.checkedAgents).toBeGreaterThan(0);
      expect(typeof data.totalAnomalies).toBe('number');
      expect(Array.isArray(data.anomalies)).toBe(true);
    });

    it('anomalies have required fields', async () => {
      const result = await server.callTool('detect_usage_anomalies', { sensitivity: 'high' });
      const data = JSON.parse(result.content[0].text!);

      for (const anomaly of data.anomalies) {
        expect(['usage_drop', 'usage_spike', 'behavior_shift']).toContain(anomaly.type);
        expect(anomaly.agentName).toBeDefined();
        expect(anomaly.toolName).toBeDefined();
        expect(anomaly.description).toBeDefined();
        expect(typeof anomaly.currentValue).toBe('number');
        expect(typeof anomaly.baselineValue).toBe('number');
        expect(['info', 'warning', 'critical']).toContain(anomaly.severity);
        expect(Array.isArray(anomaly.possibleCauses)).toBe(true);
        expect(anomaly.detectedAt).toBeGreaterThan(0);
      }
    });

    it('filters by agent', async () => {
      const result = await server.callTool('detect_usage_anomalies', { agentName: 'pipelines' });
      const data = JSON.parse(result.content[0].text!);
      for (const anomaly of data.anomalies) {
        expect(anomaly.agentName).toBe('pipelines');
      }
    });

    it('sensitivity affects detection thresholds', async () => {
      const highResult = await server.callTool('detect_usage_anomalies', { sensitivity: 'high' });
      const medResult = await server.callTool('detect_usage_anomalies', { sensitivity: 'medium' });
      const lowResult = await server.callTool('detect_usage_anomalies', { sensitivity: 'low' });
      const highData = JSON.parse(highResult.content[0].text!);
      const medData = JSON.parse(medResult.content[0].text!);
      const lowData = JSON.parse(lowResult.content[0].text!);
      // All should return valid results
      expect(highData.checkedAgents).toBeGreaterThan(0);
      expect(medData.checkedAgents).toBeGreaterThan(0);
      expect(lowData.checkedAgents).toBeGreaterThan(0);
      // High sensitivity detects more drops (lower threshold)
      const highDrops = highData.anomalies.filter((a: { type: string }) => a.type === 'usage_drop').length;
      const lowDrops = lowData.anomalies.filter((a: { type: string }) => a.type === 'usage_drop').length;
      expect(highDrops).toBeGreaterThanOrEqual(lowDrops);
    });
  });

  // ── get_workflow_patterns ───────────────────────────────────────────

  describe('get_workflow_patterns', () => {
    it('returns workflow patterns', async () => {
      const result = await server.callTool('get_workflow_patterns', { period: '30d' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.patterns.length).toBeGreaterThan(0);
      expect(Array.isArray(data.crossAgentFlows)).toBe(true);
      expect(data.isolatedToolUsage.percentage).toBeGreaterThanOrEqual(0);
      expect(data.isolatedToolUsage.percentage).toBeLessThanOrEqual(1);
    });

    it('patterns are ranked by frequency', async () => {
      const result = await server.callTool('get_workflow_patterns', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      for (let i = 0; i < data.patterns.length; i++) {
        expect(data.patterns[i].rank).toBe(i + 1);
        if (i > 0) {
          expect(data.patterns[i].frequency).toBeLessThanOrEqual(data.patterns[i - 1].frequency);
        }
      }
    });

    it('patterns have required fields', async () => {
      const result = await server.callTool('get_workflow_patterns', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      for (const pattern of data.patterns) {
        expect(pattern.rank).toBeGreaterThan(0);
        expect(Array.isArray(pattern.sequence)).toBe(true);
        expect(pattern.sequence.length).toBeGreaterThanOrEqual(2);
        expect(pattern.frequency).toBeGreaterThan(0);
        expect(pattern.uniqueUsers).toBeGreaterThan(0);
        expect(typeof pattern.avgDurationMinutes).toBe('number');
        expect(pattern.description).toBeDefined();
      }
    });

    it('cross-agent flows have from/to/frequency', async () => {
      const result = await server.callTool('get_workflow_patterns', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      for (const flow of data.crossAgentFlows) {
        expect(flow.from).toBeDefined();
        expect(flow.to).toBeDefined();
        expect(flow.from).not.toBe(flow.to);
        expect(flow.frequency).toBeGreaterThan(0);
      }
    });

    it('filters by user', async () => {
      const result = await server.callTool('get_workflow_patterns', { userId: 'eng-sarah', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      // Should still return patterns (eng-sarah is a power user)
      expect(Array.isArray(data.patterns)).toBe(true);
    });
  });

  // ── get_usage_heatmap ───────────────────────────────────────────────

  describe('get_usage_heatmap', () => {
    it('returns hourly heatmap with 24 buckets', async () => {
      const result = await server.callTool('get_usage_heatmap', { dimension: 'hourly', period: '30d' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.dimension).toBe('hourly');
      expect(data.heatmap).toHaveLength(24);
      expect(typeof data.peakBucket).toBe('number');
      expect(typeof data.quietBucket).toBe('number');
      expect(data.weekdayVsWeekend).toBeDefined();
      expect(data.weekdayVsWeekend.weekdayAvgCalls).toBeGreaterThan(data.weekdayVsWeekend.weekendAvgCalls);
    });

    it('hourly heatmap cells have required fields', async () => {
      const result = await server.callTool('get_usage_heatmap', { dimension: 'hourly', period: '7d' });
      const data = JSON.parse(result.content[0].text!);

      for (const cell of data.heatmap) {
        expect(typeof cell.bucket).toBe('number');
        expect(cell.bucket).toBeGreaterThanOrEqual(0);
        expect(cell.bucket).toBeLessThan(24);
        expect(typeof cell.totalCalls).toBe('number');
        expect(typeof cell.uniqueUsers).toBe('number');
        expect(cell.topAgent).toBeDefined();
      }
    });

    it('returns daily heatmap with 7 buckets', async () => {
      const result = await server.callTool('get_usage_heatmap', { dimension: 'daily', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.dimension).toBe('daily');
      expect(data.heatmap).toHaveLength(7);
      const buckets = data.heatmap.map((c: { bucket: string }) => c.bucket);
      expect(buckets).toContain('Monday');
      expect(buckets).toContain('Saturday');
    });

    it('returns agent_x_user dimension', async () => {
      const result = await server.callTool('get_usage_heatmap', { dimension: 'agent_x_user', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.dimension).toBe('agent_x_user');
      expect(data.heatmap.length).toBeGreaterThan(0);
      // Should be sorted by totalCalls descending
      for (let i = 1; i < data.heatmap.length; i++) {
        expect(data.heatmap[i].totalCalls).toBeLessThanOrEqual(data.heatmap[i - 1].totalCalls);
      }
    });

    it('filters by agent', async () => {
      const result = await server.callTool('get_usage_heatmap', { dimension: 'hourly', agentName: 'pipelines', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      // With agent filter on hourly, topAgent should always be pipelines (or none if no calls)
      for (const cell of data.heatmap) {
        if (cell.totalCalls > 0) {
          expect(cell.topAgent).toBe('pipelines');
        }
      }
    });
  });

  // ── get_session_analytics ───────────────────────────────────────────

  describe('get_session_analytics', () => {
    it('returns session overview and user breakdown', async () => {
      const result = await server.callTool('get_session_analytics', { period: '30d' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);

      expect(data.period).toBe('30d');
      expect(data.sessionGapMinutes).toBe(30);
      expect(data.overview.totalSessions).toBeGreaterThan(0);
      expect(data.overview.avgSessionDurationMinutes).toBeGreaterThanOrEqual(0);
      expect(data.overview.avgToolCallsPerSession).toBeGreaterThan(0);
      expect(data.overview.avgAgentsPerSession).toBeGreaterThan(0);
      expect(data.overview.medianSessionDurationMinutes).toBeGreaterThanOrEqual(0);
    });

    it('user breakdown has all 20 practitioners', async () => {
      const result = await server.callTool('get_session_analytics', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.userBreakdown.length).toBe(20);
    });

    it('user types are classified correctly', async () => {
      const result = await server.callTool('get_session_analytics', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      const distribution = data.userTypeDistribution;
      expect(distribution.power_user).toBeGreaterThan(0);
      expect(distribution.regular).toBeGreaterThan(0);
      expect(distribution.occasional).toBeGreaterThanOrEqual(0);
      expect(distribution.power_user + distribution.regular + distribution.occasional).toBe(20);

      for (const user of data.userBreakdown) {
        expect(['power_user', 'regular', 'occasional']).toContain(user.userType);
        expect(user.userId).toBeDefined();
        expect(user.totalSessions).toBeGreaterThan(0);
        expect(user.mostUsedAgent).toBeDefined();
      }
    });

    it('filters by specific user', async () => {
      const result = await server.callTool('get_session_analytics', { userId: 'eng-sarah', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.userBreakdown).toHaveLength(1);
      expect(data.userBreakdown[0].userId).toBe('eng-sarah');
      expect(data.userBreakdown[0].userType).toBe('power_user');
    });

    it('custom session gap changes results', async () => {
      const shortGap = await server.callTool('get_session_analytics', { sessionGapMinutes: 5, period: '30d' });
      const longGap = await server.callTool('get_session_analytics', { sessionGapMinutes: 120, period: '30d' });
      const shortData = JSON.parse(shortGap.content[0].text!);
      const longData = JSON.parse(longGap.content[0].text!);
      // Shorter gap = more sessions (more splits)
      expect(shortData.overview.totalSessions).toBeGreaterThanOrEqual(longData.overview.totalSessions);
    });
  });

  // ── check_agent_health (retained) ───────────────────────────────────

  describe('check_agent_health', () => {
    it('returns health for all agents', async () => {
      const result = await server.callTool('check_agent_health', {});
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(6);

      for (const agent of data) {
        expect(['healthy', 'degraded', 'unhealthy']).toContain(agent.status);
        expect(agent.lastHeartbeat).toBeGreaterThan(0);
        expect(agent.uptime).toBeGreaterThan(0);
        expect(agent.errorRateLast5m).toBeGreaterThanOrEqual(0);
      }
    });

    it('correctly classifies healthy agents (errorRate <= 5%)', async () => {
      const result = await server.callTool('check_agent_health', { agentName: 'pipelines' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.status).toBe('healthy');
      expect(data.errorRateLast5m).toBeLessThanOrEqual(0.05);
    });

    it('correctly classifies degraded agents (errorRate > 5%)', async () => {
      const result = await server.callTool('check_agent_health', { agentName: 'governance' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.status).toBe('degraded');
      expect(data.errorRateLast5m).toBeGreaterThan(0.05);
    });
  });

  // ── detect_drift (retained) ─────────────────────────────────────────

  describe('detect_drift', () => {
    it('detects drift for governance agent (error rate > 5%)', async () => {
      const result = await server.callTool('detect_drift', { agentName: 'governance' });
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);

      const errorDrift = data.find(
        (a: { metric: string }) => a.metric === 'error_rate',
      );
      expect(errorDrift).toBeDefined();
      expect(errorDrift.agentName).toBe('governance');
      expect(errorDrift.currentValue).toBeGreaterThan(0.05);
      expect(errorDrift.threshold).toBe(0.05);
    });

    it('returns empty array when no drift', async () => {
      const result = await server.callTool('detect_drift', { agentName: 'pipelines' });
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      const errorDrift = data.find(
        (a: { metric: string }) => a.metric === 'error_rate',
      );
      expect(errorDrift).toBeUndefined();
    });
  });

  // ── get_agent_metrics (retained) ──────────────────────────────────

  describe('get_agent_metrics', () => {
    it('returns metrics for a valid agent', async () => {
      const result = await server.callTool('get_agent_metrics', { agentName: 'pipelines' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.agentName).toBe('pipelines');
      expect(data.period).toBe('7d');
      expect(data.latency.p50).toBeGreaterThan(0);
      expect(data.latency.p95).toBeGreaterThan(data.latency.p50);
      expect(data.latency.p99).toBeGreaterThan(data.latency.p95);
      expect(data.errorRate).toBeGreaterThanOrEqual(0);
      expect(data.totalInvocations).toBeGreaterThan(0);
      expect(data.avgTokens).toBeGreaterThan(0);
      expect(data.avgConfidence).toBeGreaterThan(0);
      expect(data.escalationRate).toBeGreaterThanOrEqual(0);
    });

    it('returns graceful default for unknown agent', async () => {
      const result = await server.callTool('get_agent_metrics', { agentName: 'nonexistent' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.agentName).toBe('nonexistent');
      expect(data.totalInvocations).toBe(0);
      expect(data.message).toBeDefined();
    });

    it('supports 1d period filter', async () => {
      const result = await server.callTool('get_agent_metrics', { agentName: 'incidents', period: '1d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.period).toBe('1d');
      expect(data.agentName).toBe('incidents');
    });
  });

  // ── get_audit_trail (retained) ────────────────────────────────────

  describe('get_audit_trail', () => {
    it('returns 20 audit entries', async () => {
      const result = await server.callTool('get_audit_trail', {});
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(20);
    });

    it('has valid SHA-256 hash chain', async () => {
      const result = await server.callTool('get_audit_trail', {});
      const entries = JSON.parse(result.content[0].text!);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
        expect(entry.previousHash).toMatch(/^[a-f0-9]{64}$/);

        const content = JSON.stringify({
          id: entry.id,
          timestamp: entry.timestamp,
          agentName: entry.agentName,
          action: entry.action,
          input: entry.input,
          output: entry.output,
          confidence: entry.confidence,
        });
        const expectedHash = createHash('sha256')
          .update(content + entry.previousHash)
          .digest('hex');
        expect(entry.hash).toBe(expectedHash);

        if (i > 0) {
          expect(entry.previousHash).toBe(entries[i - 1].hash);
        }
      }
    });

    it('first entry links to genesis hash', async () => {
      const result = await server.callTool('get_audit_trail', {});
      const entries = JSON.parse(result.content[0].text!);
      expect(entries[0].previousHash).toBe('0'.repeat(64));
    });

    it('filters by agentName', async () => {
      const result = await server.callTool('get_audit_trail', { agentName: 'pipelines' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.length).toBeGreaterThan(0);
      for (const entry of data) {
        expect(entry.agentName).toBe('pipelines');
      }
    });
  });

  // ── get_evaluation_report (retained) ──────────────────────────────

  describe('get_evaluation_report', () => {
    it('returns aggregated evaluation scores', async () => {
      const result = await server.callTool('get_evaluation_report', { agentName: 'pipelines' });
      const data = JSON.parse(result.content[0].text!);

      expect(data.agentName).toBe('pipelines');
      expect(data.period).toBe('7d');
      expect(data.averageScore).toBeGreaterThan(0);
      expect(data.totalEvaluations).toBe(5);
      expect(data.breakdown.accuracy).toBeGreaterThan(0);
      expect(data.breakdown.completeness).toBeGreaterThan(0);
      expect(data.breakdown.safety).toBeGreaterThan(0);
      expect(data.breakdown.helpfulness).toBeGreaterThan(0);
    });

    it('averageScore is mean of breakdown dimensions', async () => {
      const result = await server.callTool('get_evaluation_report', { agentName: 'catalog' });
      const data = JSON.parse(result.content[0].text!);

      const expected =
        (data.breakdown.accuracy + data.breakdown.completeness + data.breakdown.safety + data.breakdown.helpfulness) / 4;
      expect(data.averageScore).toBeCloseTo(expected, 3);
    });

    it('returns graceful default for unknown agent', async () => {
      const result = await server.callTool('get_evaluation_report', { agentName: 'nonexistent' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.agentName).toBe('nonexistent');
      expect(data.totalEvaluations).toBe(0);
      expect(data.message).toBeDefined();
    });
  });

  // ── list_active_agents (retained) ─────────────────────────────────

  describe('list_active_agents', () => {
    it('returns all 6 agents sorted alphabetically', async () => {
      const result = await server.callTool('list_active_agents', {});
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(6);

      const names = data.map((a: { agentName: string }) => a.agentName);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('each agent has required fields', async () => {
      const result = await server.callTool('list_active_agents', {});
      const data = JSON.parse(result.content[0].text!);

      for (const agent of data) {
        expect(agent.agentName).toBeDefined();
        expect(agent.status).toBeDefined();
        expect(agent.lastHeartbeat).toBeGreaterThan(0);
        expect(typeof agent.errorRateLast5m).toBe('number');
      }
    });
  });

  // ── Anti-recursion: NO LLM imports ──────────────────────────────────

  describe('anti-recursion guarantee', () => {
    it('no source file imports LLM or AI SDK modules', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const srcDir = path.resolve(__dirname, '..');
      const sourceFiles: string[] = [];

      function collectFiles(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            collectFiles(fullPath);
          } else if (entry.name.endsWith('.ts')) {
            sourceFiles.push(fullPath);
          }
        }
      }

      collectFiles(srcDir);
      expect(sourceFiles.length).toBeGreaterThan(0);

      const llmPatterns = [
        /import.*anthropic/i,
        /import.*openai/i,
        /import.*['"]ai['"]/,
        /import.*langchain/i,
        /import.*['"]@ai-sdk/,
        /new\s+(Anthropic|OpenAI|ChatOpenAI)/,
      ];

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of llmPatterns) {
          expect(content).not.toMatch(pattern);
        }
      }
    });
  });

  // ── E2E: usage intelligence workflow ────────────────────────────────

  describe('E2E: usage intelligence workflow', () => {
    it('metrics → heatmap → sessions → adoption produce consistent data', async () => {
      // Step 1: Get overall metrics
      const metricsResult = await server.callTool('get_tool_usage_metrics', { period: '30d', groupBy: 'agent' });
      const metrics = JSON.parse(metricsResult.content[0].text!);
      expect(metrics.summary.totalCalls).toBeGreaterThan(0);

      // Step 2: Get heatmap for most used agent
      const topAgent = metrics.metrics[0].name;
      const heatmapResult = await server.callTool('get_usage_heatmap', { dimension: 'hourly', agentName: topAgent, period: '30d' });
      const heatmap = JSON.parse(heatmapResult.content[0].text!);
      const heatmapTotal = heatmap.heatmap.reduce((s: number, c: { totalCalls: number }) => s + c.totalCalls, 0);
      expect(heatmapTotal).toBe(metrics.metrics[0].totalCalls);

      // Step 3: Get session analytics
      const sessionResult = await server.callTool('get_session_analytics', { period: '30d' });
      const sessions = JSON.parse(sessionResult.content[0].text!);
      expect(sessions.userBreakdown.length).toBe(metrics.summary.totalUniqueUsers);

      // Step 4: Check adoption
      const adoptionResult = await server.callTool('get_adoption_dashboard', { period: '30d' });
      const adoption = JSON.parse(adoptionResult.content[0].text!);
      expect(adoption.platformSummary.activePractitioners).toBe(metrics.summary.totalUniqueUsers);
    });
  });
});
