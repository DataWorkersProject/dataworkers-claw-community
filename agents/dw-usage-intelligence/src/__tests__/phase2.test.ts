/**
 * Phase 2 tests for Usage Intelligence Agent Pro tools.
 *
 * Tests schedule_anomaly_scan, export_usage_report,
 * configure_usage_alerts, and set_adoption_targets.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server } from '../index.js';

describe('Phase 2: Pro Tools', () => {
  const originalTier = process.env.DW_LICENSE_TIER;

  afterAll(() => {
    // Restore original tier
    if (originalTier !== undefined) {
      process.env.DW_LICENSE_TIER = originalTier;
    } else {
      delete process.env.DW_LICENSE_TIER;
    }
  });

  describe('tool registration', () => {
    it('registers all 26 tools (13 community + 4 pro + 9 P3/P4)', () => {
      const tools = server.listTools();
      expect(tools).toHaveLength(26);
      const names = tools.map((t) => t.name);
      expect(names).toContain('schedule_anomaly_scan');
      expect(names).toContain('export_usage_report');
      expect(names).toContain('configure_usage_alerts');
      expect(names).toContain('set_adoption_targets');
    });
  });

  describe('license gating (community tier)', () => {
    beforeAll(() => {
      process.env.DW_LICENSE_TIER = 'community';
    });

    it('schedule_anomaly_scan is blocked on community tier', async () => {
      const result = await server.callTool('schedule_anomaly_scan', {});
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error.toLowerCase()).toContain('pro tier');
    });

    it('export_usage_report is blocked on community tier', async () => {
      const result = await server.callTool('export_usage_report', {});
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error.toLowerCase()).toContain('pro tier');
    });

    it('configure_usage_alerts is blocked on community tier', async () => {
      const result = await server.callTool('configure_usage_alerts', {});
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error.toLowerCase()).toContain('pro tier');
    });

    it('set_adoption_targets is blocked on community tier', async () => {
      const result = await server.callTool('set_adoption_targets', { agentName: 'pipelines' });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error.toLowerCase()).toContain('pro tier');
    });
  });

  describe('Pro tools with Pro tier', () => {
    beforeAll(() => {
      process.env.DW_LICENSE_TIER = 'pro';
    });

    describe('schedule_anomaly_scan', () => {
      it('creates a schedule with defaults', async () => {
        const result = await server.callTool('schedule_anomaly_scan', {});
        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0].text!);
        expect(data.status).toBe('scheduled');
        expect(data.cron).toBe('0 */6 * * *');
        expect(data.sensitivity).toBe('medium');
        expect(data.agentName).toBe('all');
        expect(data.enabled).toBe(true);
        expect(data.scheduleId).toBeDefined();
      });

      it('creates a schedule with custom params', async () => {
        const result = await server.callTool('schedule_anomaly_scan', {
          scheduleId: 'custom-scan-1',
          cron: '0 * * * *',
          sensitivity: 'high',
          agentName: 'pipelines',
          enabled: false,
        });
        const data = JSON.parse(result.content[0].text!);
        expect(data.scheduleId).toBe('custom-scan-1');
        expect(data.cron).toBe('0 * * * *');
        expect(data.sensitivity).toBe('high');
        expect(data.agentName).toBe('pipelines');
        expect(data.enabled).toBe(false);
      });
    });

    describe('export_usage_report', () => {
      it('exports as JSON by default', async () => {
        const result = await server.callTool('export_usage_report', { since: '30d', limit: 10 });
        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0].text!);
        expect(data.format).toBe('json');
        expect(data.rowCount).toBeGreaterThan(0);
        expect(data.rowCount).toBeLessThanOrEqual(10);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('exports as CSV', async () => {
        const result = await server.callTool('export_usage_report', { format: 'csv', since: '30d', limit: 5 });
        const data = JSON.parse(result.content[0].text!);
        expect(data.format).toBe('csv');
        expect(data.rowCount).toBeGreaterThan(0);
        expect(data.data).toContain('id,timestamp,userId');
      });

      it('filters by agent', async () => {
        const result = await server.callTool('export_usage_report', { agentName: 'pipelines', since: '30d', limit: 20 });
        const data = JSON.parse(result.content[0].text!);
        for (const row of data.data) {
          expect(row.agentName).toBe('pipelines');
        }
      });

      it('filters by user', async () => {
        const result = await server.callTool('export_usage_report', { userId: 'eng-sarah', since: '30d', limit: 20 });
        const data = JSON.parse(result.content[0].text!);
        for (const row of data.data) {
          expect(row.userId).toBe('eng-sarah');
        }
      });
    });

    describe('configure_usage_alerts', () => {
      it('creates an alert with defaults', async () => {
        const result = await server.callTool('configure_usage_alerts', {});
        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0].text!);
        expect(data.status).toBe('configured');
        expect(data.metric).toBe('usage_drop');
        expect(data.threshold).toBe(0.3);
        expect(data.enabled).toBe(true);
        expect(data.agentName).toBe('all');
      });

      it('creates an alert with custom params', async () => {
        const result = await server.callTool('configure_usage_alerts', {
          alertId: 'custom-alert-1',
          agentName: 'governance',
          metric: 'error_rate',
          threshold: 0.1,
          enabled: true,
        });
        const data = JSON.parse(result.content[0].text!);
        expect(data.alertId).toBe('custom-alert-1');
        expect(data.agentName).toBe('governance');
        expect(data.metric).toBe('error_rate');
        expect(data.threshold).toBe(0.1);
      });
    });

    describe('set_adoption_targets', () => {
      it('sets targets for an agent', async () => {
        const result = await server.callTool('set_adoption_targets', {
          agentName: 'pipelines',
          targetActiveUsers: 15,
          targetCallsPerDay: 100,
          targetAdoptionRate: 0.9,
        });
        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0].text!);
        expect(data.status).toBe('target_set');
        expect(data.agentName).toBe('pipelines');
        expect(data.targetActiveUsers).toBe(15);
        expect(data.targetCallsPerDay).toBe(100);
        expect(data.targetAdoptionRate).toBe(0.9);
      });

      it('uses defaults when optional params omitted', async () => {
        const result = await server.callTool('set_adoption_targets', { agentName: 'catalog' });
        const data = JSON.parse(result.content[0].text!);
        expect(data.agentName).toBe('catalog');
        expect(data.targetActiveUsers).toBe(10);
        expect(data.targetCallsPerDay).toBe(50);
        expect(data.targetAdoptionRate).toBe(0.8);
      });
    });
  });

  describe('Retention-based tier gating', () => {
    it('community tier has 7-day retention', async () => {
      const { RETENTION_LIMITS } = await import('../types.js');
      expect(RETENTION_LIMITS.community).toBe(7);
    });

    it('pro tier has 90-day retention', async () => {
      const { RETENTION_LIMITS } = await import('../types.js');
      expect(RETENTION_LIMITS.pro).toBe(90);
    });

    it('enterprise tier has unlimited retention', async () => {
      const { RETENTION_LIMITS } = await import('../types.js');
      expect(RETENTION_LIMITS.enterprise).toBe(Infinity);
    });

    it('getRetentionCutoff returns appropriate cutoff for community tier', async () => {
      process.env.DW_LICENSE_TIER = 'community';
      const { getRetentionCutoff, getRetentionDays } = await import('../retention.js');
      const days = getRetentionDays();
      expect(days).toBe(7);
      const cutoff = getRetentionCutoff();
      const expectedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      // Allow 1 second tolerance
      expect(Math.abs(cutoff - expectedCutoff)).toBeLessThan(1000);
    });

    it('getRetentionCutoff returns 0 for enterprise tier', async () => {
      process.env.DW_LICENSE_TIER = 'enterprise';
      const { getRetentionCutoff } = await import('../retention.js');
      const cutoff = getRetentionCutoff();
      expect(cutoff).toBe(0);
    });
  });
});
