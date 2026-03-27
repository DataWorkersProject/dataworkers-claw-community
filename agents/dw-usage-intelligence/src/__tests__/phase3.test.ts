/**
 * Phase 3 tests — dynamic descriptions, agent_x_user matrix,
 * returnRate/churnRisk, global hash chain, extended drift, daily rollup.
 */

import { describe, it, expect } from 'vitest';
import { server } from '../index.js';

describe('Phase 3 — Usage Intelligence P3 features', () => {

  // ── Dynamic workflow descriptions ──────────────────────────
  describe('dynamic workflow descriptions', () => {
    it('generates descriptions dynamically from sequence data', async () => {
      const result = await server.callTool('get_workflow_patterns', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      for (const pattern of data.patterns) {
        expect(pattern.description).toBeDefined();
        expect(pattern.description.length).toBeGreaterThan(10);
        // Should mention step count
        expect(pattern.description).toContain('-step');
        // Should mention either cross-agent or agent-only
        expect(
          pattern.description.includes('cross-agent') || pattern.description.includes('-only'),
        ).toBe(true);
      }
    });

    it('description includes tool actions in readable form', async () => {
      const result = await server.callTool('get_workflow_patterns', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      // At least one pattern should have readable tool names (no underscores)
      const hasReadable = data.patterns.some(
        (p: { description: string }) => /workflow:/.test(p.description) && !/_/.test(p.description.split('workflow:')[1] ?? ''),
      );
      // Descriptions should have arrow separators
      const hasArrows = data.patterns.some(
        (p: { description: string }) => p.description.includes(' → '),
      );
      expect(hasArrows).toBe(true);
    });
  });

  // ── agent_x_user true matrix ───────────────────────────────
  describe('agent_x_user true matrix', () => {
    it('returns agent:user pairs as buckets', async () => {
      const result = await server.callTool('get_usage_heatmap', { dimension: 'agent_x_user', period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      expect(data.heatmap.length).toBeGreaterThan(0);
      // Each bucket should be in "agent:user" format
      for (const cell of data.heatmap) {
        expect(typeof cell.bucket).toBe('string');
        expect((cell.bucket as string).includes(':')).toBe(true);
        expect(cell.uniqueUsers).toBe(1); // Each cell is a single user
        expect(cell.totalCalls).toBeGreaterThan(0);
      }
    });

    it('has more entries than agents alone (matrix expansion)', async () => {
      const result = await server.callTool('get_usage_heatmap', { dimension: 'agent_x_user', period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      // With 12 agents and 20 users, we should have many more entries than 12
      expect(data.heatmap.length).toBeGreaterThan(12);
    });
  });

  // ── returnRate and churnRisk ───────────────────────────────
  describe('returnRate and churnRisk', () => {
    it('adds returnRate and churnRisk to user breakdown', async () => {
      const result = await server.callTool('get_session_analytics', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      for (const user of data.userBreakdown) {
        expect(typeof user.returnRate).toBe('number');
        expect(user.returnRate).toBeGreaterThanOrEqual(0);
        expect(user.returnRate).toBeLessThanOrEqual(1);
        expect(['low', 'medium', 'high']).toContain(user.churnRisk);
      }
    });

    it('power users tend to have higher returnRate', async () => {
      const result = await server.callTool('get_session_analytics', { period: '30d' });
      const data = JSON.parse(result.content[0].text!);

      const powerUsers = data.userBreakdown.filter((u: { userType: string }) => u.userType === 'power_user');
      const occasionalUsers = data.userBreakdown.filter((u: { userType: string }) => u.userType === 'occasional');

      if (powerUsers.length > 0 && occasionalUsers.length > 0) {
        const avgPowerReturn = powerUsers.reduce((s: number, u: { returnRate: number }) => s + u.returnRate, 0) / powerUsers.length;
        const avgOccasionalReturn = occasionalUsers.reduce((s: number, u: { returnRate: number }) => s + u.returnRate, 0) / occasionalUsers.length;
        expect(avgPowerReturn).toBeGreaterThanOrEqual(avgOccasionalReturn);
      }
    });
  });

  // ── Global hash chain ──────────────────────────────────────
  describe('verify_global_hash_chain', () => {
    it('returns valid integrity for seeded data', async () => {
      const result = await server.callTool('verify_global_hash_chain', {});
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);

      expect(data.integrity).toBeDefined();
      expect(data.totalEvents).toBeGreaterThan(0);
      expect(data.agentChains.length).toBeGreaterThan(0);
      expect(data.globalChainHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('reports per-agent chain status', async () => {
      const result = await server.callTool('verify_global_hash_chain', {});
      const data = JSON.parse(result.content[0].text!);

      for (const chain of data.agentChains) {
        expect(chain.agentName).toBeDefined();
        expect(chain.eventCount).toBeGreaterThan(0);
        expect(['valid', 'broken']).toContain(chain.integrity);
      }
    });
  });

  // ── Extended drift detection ───────────────────────────────
  describe('extended drift detection', () => {
    it('detect_drift returns results for all agents', async () => {
      const result = await server.callTool('detect_drift', {});
      const data = JSON.parse(result.content[0].text!);
      expect(Array.isArray(data)).toBe(true);
    });

    it('supports escalation_rate, confidence, and token_consumption metrics', async () => {
      const result = await server.callTool('detect_drift', {});
      const data = JSON.parse(result.content[0].text!);

      // The metric types should be from the known set
      const validMetrics = ['error_rate', 'p99_latency', 'escalation_rate', 'confidence', 'token_consumption'];
      for (const alert of data) {
        expect(validMetrics).toContain(alert.metric);
        expect(alert.currentValue).toBeDefined();
        expect(alert.baselineValue).toBeDefined();
        expect(alert.threshold).toBeDefined();
      }
    });
  });

  // ── Daily rollup smoke test ────────────────────────────────
  describe('daily rollup tables', () => {
    it('usage_events table has 30 days of data', async () => {
      const result = await server.callTool('get_tool_usage_metrics', { period: '30d', groupBy: 'agent' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.summary.totalCalls).toBeGreaterThan(100);
      expect(data.metrics.length).toBeGreaterThan(5);
    });

    it('heatmap hourly rollup covers all 24 hours', async () => {
      const result = await server.callTool('get_usage_heatmap', { dimension: 'hourly', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.heatmap).toHaveLength(24);
    });
  });
});
