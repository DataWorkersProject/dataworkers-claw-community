import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { server } from '../index.js';
import { relationalStore, kvStore } from '../backends.js';

describe('dw-observability MCP Server', () => {
  it('registers all 6 tools', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(6);
    expect(tools.map((t) => t.name)).toEqual([
      'get_agent_metrics',
      'get_audit_trail',
      'check_agent_health',
      'detect_drift',
      'get_evaluation_report',
      'list_active_agents',
    ]);
  });

  // ── get_agent_metrics ───────────────────────────────────────────────

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

  // ── get_audit_trail ─────────────────────────────────────────────────

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

        // Verify hash is 64 hex chars (SHA-256)
        expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
        expect(entry.previousHash).toMatch(/^[a-f0-9]{64}$/);

        // Verify hash chain: recompute hash from content + previousHash
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

        // Verify chain linkage (except first entry)
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

  // ── check_agent_health ──────────────────────────────────────────────

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
      // pipelines has 2% error rate
      expect(data.status).toBe('healthy');
      expect(data.errorRateLast5m).toBeLessThanOrEqual(0.05);
    });

    it('correctly classifies degraded agents (errorRate > 5%)', async () => {
      const result = await server.callTool('check_agent_health', { agentName: 'governance' });
      const data = JSON.parse(result.content[0].text!);
      // governance has 8% error rate
      expect(data.status).toBe('degraded');
      expect(data.errorRateLast5m).toBeGreaterThan(0.05);
    });

    it('classifies agent as unhealthy when error rate > 20%', async () => {
      // Inject unhealthy state
      await kvStore.set('health:test-unhealthy', JSON.stringify({
        agentName: 'test-unhealthy',
        status: 'unhealthy',
        lastHeartbeat: Date.now() - 10_000,
        startedAt: Date.now() - 86400000,
        errorRateLast5m: 0.25,
      }));

      const result = await server.callTool('check_agent_health', { agentName: 'test-unhealthy' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.status).toBe('unhealthy');

      // Cleanup
      await kvStore.delete('health:test-unhealthy');
    });
  });

  // ── detect_drift ────────────────────────────────────────────────────

  describe('detect_drift', () => {
    it('detects drift for governance agent (error rate > 5%)', async () => {
      const result = await server.callTool('detect_drift', { agentName: 'governance' });
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);

      // governance has 8% error rate, should trigger drift
      const errorDrift = data.find(
        (a: { metric: string }) => a.metric === 'error_rate',
      );
      expect(errorDrift).toBeDefined();
      expect(errorDrift.agentName).toBe('governance');
      expect(errorDrift.currentValue).toBeGreaterThan(0.05);
      expect(errorDrift.threshold).toBe(0.05);
    });

    it('fires on injected anomaly', async () => {
      // Inject a high error rate for day 0
      await relationalStore.insert('agent_metrics', {
        agentName: 'test-drift-agent',
        timestamp: Date.now(),
        day: 0,
        p50: 100,
        p95: 250,
        p99: 800, // very high p99
        errorRate: 0.30, // 30% error rate
        totalInvocations: 500,
        avgTokens: 600,
        avgConfidence: 0.70,
        escalationRate: 0.15,
      });

      // Inject baseline days
      for (let d = 1; d <= 6; d++) {
        await relationalStore.insert('agent_metrics', {
          agentName: 'test-drift-agent',
          timestamp: Date.now() - d * 86400000,
          day: d,
          p50: 50,
          p95: 125,
          p99: 200,
          errorRate: 0.01,
          totalInvocations: 1000,
          avgTokens: 500,
          avgConfidence: 0.90,
          escalationRate: 0.03,
        });
      }

      const result = await server.callTool('detect_drift', { agentName: 'test-drift-agent' });
      const alerts = JSON.parse(result.content[0].text!);
      expect(alerts.length).toBeGreaterThanOrEqual(2);

      const errorAlert = alerts.find((a: { metric: string }) => a.metric === 'error_rate');
      expect(errorAlert).toBeDefined();
      expect(errorAlert.severity).toBe('critical'); // 30% > 20%
      expect(errorAlert.currentValue).toBe(0.3);

      const latencyAlert = alerts.find((a: { metric: string }) => a.metric === 'p99_latency');
      expect(latencyAlert).toBeDefined();
      expect(latencyAlert.currentValue).toBe(800);
    });

    it('returns empty array when no drift', async () => {
      const result = await server.callTool('detect_drift', { agentName: 'pipelines' });
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
      // pipelines has low error rate and consistent latency
      const errorDrift = data.find(
        (a: { metric: string }) => a.metric === 'error_rate',
      );
      expect(errorDrift).toBeUndefined();
    });
  });

  // ── get_evaluation_report ───────────────────────────────────────────

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

  // ── list_active_agents ──────────────────────────────────────────────

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

  // ── Anti-recursion: NO LLM imports ────────────────────────────────

  describe('anti-recursion guarantee', () => {
    it('no source file imports LLM or AI SDK modules', async () => {
      // Dynamically read all source files and verify no LLM imports
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

  // ── E2E: metrics -> health -> drift ───────────────────────────────

  describe('E2E: observability workflow', () => {
    it('metrics, health, and drift produce consistent results', async () => {
      // Step 1: List active agents
      const agentsResult = await server.callTool('list_active_agents', {});
      const agents = JSON.parse(agentsResult.content[0].text!);
      expect(agents.length).toBeGreaterThanOrEqual(6);

      // Step 2: Get metrics for first agent
      const metricsResult = await server.callTool('get_agent_metrics', {
        agentName: agents[0].agentName,
      });
      const metrics = JSON.parse(metricsResult.content[0].text!);
      expect(metrics.agentName).toBe(agents[0].agentName);

      // Step 3: Check health of same agent
      const healthResult = await server.callTool('check_agent_health', {
        agentName: agents[0].agentName,
      });
      const health = JSON.parse(healthResult.content[0].text!);
      expect(health.agentName).toBe(agents[0].agentName);

      // Step 4: Check drift for same agent
      const driftResult = await server.callTool('detect_drift', {
        agentName: agents[0].agentName,
      });
      const drift = JSON.parse(driftResult.content[0].text!);
      expect(Array.isArray(drift)).toBe(true);
    });
  });
});
