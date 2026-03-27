/**
 * Phase 4 integration tests — message bus, metering, cost,
 * event publishing, anomaly context, dataset registration, OTel.
 */

import { describe, it, expect } from 'vitest';
import { server } from '../index.js';
import { messageBus } from '../backends.js';

describe('Phase 4 — Usage Intelligence P4 integration features', () => {

  // ── Cross-agent query via message bus ──────────────────────
  describe('cross_agent_query', () => {
    it('gracefully errors when target agent is not available', async () => {
      const result = await server.callTool('cross_agent_query', {
        targetAgent: 'dw-cost',
        queryType: 'get_summary',
        payload: { period: '7d' },
        timeoutMs: 500,
      });
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toBeDefined();
      expect(data.targetAgent).toBe('dw-cost');
    });

    it('succeeds when handler is registered on message bus', async () => {
      // Register a mock handler
      messageBus.onRequest('dw-test.get_status', async (payload) => {
        return { status: 'ok', source: 'mock', received: payload };
      });

      const result = await server.callTool('cross_agent_query', {
        targetAgent: 'dw-test',
        queryType: 'get_status',
        payload: { check: true },
        timeoutMs: 2000,
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.status).toBe('ok');
    });
  });

  // ── Metering integration ──────────────────────────────────
  describe('get_metering_summary', () => {
    it('returns fallback when metering service is unavailable', async () => {
      const result = await server.callTool('get_metering_summary', { customerId: 'cust-1' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.available).toBe(false);
      expect(data.customerId).toBe('cust-1');
    });

    it('returns data when metering handler is registered', async () => {
      messageBus.onRequest('metering.get_usage', async (payload) => {
        return { totalCredits: 1000, usedCredits: 250, period: (payload as Record<string, unknown>).period };
      });

      const result = await server.callTool('get_metering_summary', { customerId: 'cust-1', period: '30d' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.totalCredits).toBe(1000);
    });
  });

  // ── Cost enrichment ────────────────────────────────────────
  describe('get_cost_enrichment', () => {
    it('returns fallback when cost agent is unavailable', async () => {
      const result = await server.callTool('get_cost_enrichment', { agentName: 'pipelines' });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.available).toBe(false);
    });
  });

  // ── Publish usage events ───────────────────────────────────
  describe('publish_usage_events', () => {
    it('publishes anomaly and adoption events', async () => {
      const result = await server.callTool('publish_usage_events', {});
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(typeof data.anomaliesPublished).toBe('number');
      expect(typeof data.adoptionPublished).toBe('number');
    });

    it('supports filtering by event type', async () => {
      const anomalyResult = await server.callTool('publish_usage_events', { eventType: 'anomaly' });
      const anomalyData = JSON.parse(anomalyResult.content[0].text!);
      expect(typeof anomalyData.anomaliesPublished).toBe('number');
      expect(anomalyData.adoptionPublished).toBe(0);

      const adoptionResult = await server.callTool('publish_usage_events', { eventType: 'adoption' });
      const adoptionData = JSON.parse(adoptionResult.content[0].text!);
      expect(adoptionData.anomaliesPublished).toBe(0);
      expect(typeof adoptionData.adoptionPublished).toBe('number');
    });
  });

  // ── Anomaly context ────────────────────────────────────────
  describe('get_anomaly_context', () => {
    it('returns context with deployment and incident data', async () => {
      const result = await server.callTool('get_anomaly_context', {
        agentName: 'pipelines',
        detectedAt: Date.now(),
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.agentName).toBe('pipelines');
      expect(data.detectedAt).toBeGreaterThan(0);
      expect(data.correlationWindow).toBeDefined();
      // When agents are unavailable, should still return structure
      expect(data.deployments).toBeDefined();
      expect(data.incidents).toBeDefined();
    });
  });

  // ── Register usage datasets ────────────────────────────────
  describe('register_usage_datasets', () => {
    it('registers all 4 usage datasets', async () => {
      const result = await server.callTool('register_usage_datasets', {});
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.registered).toBe(4);
      expect(data.totalDatasets).toBe(4);
      expect(data.datasets).toContain('usage_events');
      expect(data.datasets).toContain('agent_metrics');
      expect(data.datasets).toContain('audit_trail');
      expect(data.datasets).toContain('evaluation_scores');
    });
  });

  // ── OTel span ingestion ────────────────────────────────────
  describe('ingest_otel_spans', () => {
    it('ingests valid OTel spans as usage events', async () => {
      const result = await server.callTool('ingest_otel_spans', {
        spans: [
          {
            traceId: 'trace-001',
            spanId: 'span-001',
            operationName: 'validate_schema',
            startTimeUnixNano: Date.now() * 1e6,
            endTimeUnixNano: (Date.now() + 150) * 1e6,
            attributes: {
              'dw.agent.name': 'schema',
              'dw.tool.name': 'validate_schema',
              'dw.user.id': 'eng-otel-test',
              'dw.team.id': 'platform',
              'dw.session.id': 'otel-sess-001',
              'dw.token.count': 500,
            },
            status: { code: 'OK' },
          },
        ],
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);
      expect(data.ingested).toBe(1);
      expect(data.skipped).toBe(0);
    });

    it('skips spans missing required fields', async () => {
      const result = await server.callTool('ingest_otel_spans', {
        spans: [
          { operationName: 'test', attributes: {} }, // missing spanId and startTimeUnixNano
        ],
      });
      const data = JSON.parse(result.content[0].text!);
      expect(data.skipped).toBe(1);
      expect(data.ingested).toBe(0);
    });
  });

  // ── OTel export ────────────────────────────────────────────
  describe('export_otel_spans', () => {
    it('exports usage events in OTel format', async () => {
      const result = await server.callTool('export_otel_spans', { period: '7d', limit: 5 });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text!);

      expect(data.resourceSpans).toHaveLength(1);
      const resource = data.resourceSpans[0];
      expect(resource.resource.attributes['service.name']).toBe('dw-usage-intelligence');
      expect(resource.scopeSpans).toHaveLength(1);

      const spans = resource.scopeSpans[0].spans;
      expect(spans.length).toBeGreaterThan(0);
      expect(spans.length).toBeLessThanOrEqual(5);

      for (const span of spans) {
        expect(span.traceId).toBeDefined();
        expect(span.spanId).toBeDefined();
        expect(span.operationName).toBeDefined();
        expect(span.startTimeUnixNano).toBeGreaterThan(0);
        expect(span.endTimeUnixNano).toBeGreaterThanOrEqual(span.startTimeUnixNano);
        expect(span.attributes['dw.agent.name']).toBeDefined();
        expect(span.attributes['dw.tool.name']).toBeDefined();
        expect(['OK', 'ERROR']).toContain(span.status.code);
      }
    });

    it('filters by agent name', async () => {
      const result = await server.callTool('export_otel_spans', { agentName: 'pipelines', period: '7d', limit: 10 });
      const data = JSON.parse(result.content[0].text!);
      const spans = data.resourceSpans[0].scopeSpans[0].spans;

      for (const span of spans) {
        expect(span.attributes['dw.agent.name']).toBe('pipelines');
      }
    });
  });
});
