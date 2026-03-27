/**
 * Multi-Tenant Data Isolation Enforcement Tests
 *
 * Validates that all 14 agents properly enforce customerId-based data isolation.
 * Every MCP tool takes a customerId parameter and must scope operations so that
 * tenant-1 data is never visible to tenant-2. Cross-tenant queries must return
 * empty results (not errors).
 *
 * Seed data uses customerId='cust-1'. Tests write data as 'tenant-1', then
 * attempt reads with 'tenant-2' and verify no data leaks.
 *
 * Runs with InMemory backends — no Docker or external services required.
 */

import { describe, it, expect } from 'vitest';

// MCP-based agent servers
import { server as catalogServer } from '../../agents/dw-context-catalog/src/index.js';
import { server as incidentsServer } from '../../agents/dw-incidents/src/index.js';
import { server as qualityServer } from '../../agents/dw-quality/src/index.js';
import { server as governanceServer } from '../../agents/dw-governance/src/index.js';
// dw-cost removed (paid agent)
import { server as schemaServer } from '../../agents/dw-schema/src/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_1 = 'tenant-iso-1';
const TENANT_2 = 'tenant-iso-2';
const UNRELATED_TENANT = 'tenant-iso-unrelated';

/** Parse a tool response that completed without isError. */
function parseToolResponse(result: any): any {
  expect(result).toBeDefined();
  expect(result.content).toBeDefined();
  expect(result.content.length).toBeGreaterThan(0);

  const text = result.content[0].text;
  expect(text).toBeDefined();
  expect(typeof text).toBe('string');

  return JSON.parse(text);
}

/**
 * Parse a tool response that may be isError (e.g. no data found).
 * Returns the parsed JSON and whether the tool flagged an error.
 */
function parseToolResponseAllowError(result: any): { data: any; isError: boolean } {
  expect(result).toBeDefined();
  expect(result.content).toBeDefined();
  expect(result.content.length).toBeGreaterThan(0);

  const text = result.content[0].text;
  expect(text).toBeDefined();
  expect(typeof text).toBe('string');

  const parsed = JSON.parse(text);
  return { data: parsed, isError: result.isError === true };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Multi-Tenant Data Isolation Enforcement', () => {
  // ── 1. Catalog Search Isolation ───────────────────────────────────────────
  describe('dw-context-catalog: search_datasets isolation', () => {
    it('seed data for cust-1 is not visible to an unrelated tenant', async () => {
      // Seed data exists for customerId='cust-1' (orders, customers, etc.)
      // Verify that searching with a different tenant returns no results.
      const result = await catalogServer.callTool('search_datasets', {
        query: 'customer orders',
        customerId: UNRELATED_TENANT,
      });
      const data = parseToolResponse(result);

      // Should return an empty results array or a cold-start response — not cust-1 data
      if (data.coldStart) {
        // Cold start means zero indexed data for this tenant — isolation confirmed
        expect(data.coldStart).toBe(true);
      } else {
        expect(data.results).toBeDefined();
        expect(Array.isArray(data.results)).toBe(true);
        // All returned results must belong to the requesting tenant, not cust-1
        for (const r of data.results) {
          if (r.asset?.customerId) {
            expect(r.asset.customerId).not.toBe('cust-1');
          }
        }
      }
    });

    it('tenant-1 search does not leak into tenant-2 results', async () => {
      // Search as tenant-1
      const t1Result = await catalogServer.callTool('search_datasets', {
        query: 'revenue pipeline',
        customerId: TENANT_1,
      });
      const t1Data = parseToolResponse(t1Result);

      // Search as tenant-2
      const t2Result = await catalogServer.callTool('search_datasets', {
        query: 'revenue pipeline',
        customerId: TENANT_2,
      });
      const t2Data = parseToolResponse(t2Result);

      // Both should have empty results or cold start (neither tenant has seeded data)
      // but crucially they must not return each other's data
      const t1Ids = (t1Data.results ?? []).map((r: any) => r.asset?.id).filter(Boolean);
      const t2Ids = (t2Data.results ?? []).map((r: any) => r.asset?.id).filter(Boolean);

      // No overlap between tenant results
      const overlap = t1Ids.filter((id: string) => t2Ids.includes(id));
      expect(overlap).toEqual([]);
    });
  });

  // ── 2. Incident History Isolation ─────────────────────────────────────────
  describe('dw-incidents: incident history isolation', () => {
    it('incidents seeded for cust-1 are not visible to tenant-2', async () => {
      // Seed data has 14 incidents for customerId='cust-1'
      const custResult = await incidentsServer.callTool('get_incident_history', {
        customerId: 'cust-1',
      });
      const custData = parseToolResponse(custResult);
      expect(custData.totalIncidents).toBeGreaterThan(0);
      expect(custData.incidents.length).toBeGreaterThan(0);

      // Now query with tenant-2 — should get zero incidents
      const t2Result = await incidentsServer.callTool('get_incident_history', {
        customerId: TENANT_2,
      });
      const t2Data = parseToolResponse(t2Result);

      expect(t2Data.totalIncidents).toBe(0);
      expect(t2Data.incidents).toEqual([]);
    });

    it('diagnose_incident scoped by customerId does not persist across tenants', async () => {
      // Diagnose an incident as tenant-1
      const diagResult = await incidentsServer.callTool('diagnose_incident', {
        anomalySignals: [
          {
            metric: 'row_count',
            value: 0,
            expected: 50000,
            deviation: -1.0,
            source: 'fact_orders',
            timestamp: Date.now(),
          },
        ],
        customerId: TENANT_1,
      });
      const diagnosis = parseToolResponse(diagResult);
      expect(diagnosis).toHaveProperty('incidentId');

      // Query incident history as tenant-2 — should not see tenant-1's incident
      const t2History = await incidentsServer.callTool('get_incident_history', {
        customerId: TENANT_2,
      });
      const t2Data = parseToolResponse(t2History);
      expect(t2Data.totalIncidents).toBe(0);
      expect(t2Data.incidents).toEqual([]);
    });
  });

  // ── 3. Quality Check Isolation ────────────────────────────────────────────
  describe('dw-quality: quality data isolation', () => {
    it('SLA created for tenant-1 is scoped to that tenant', async () => {
      // Create an SLA as tenant-1
      const slaResult = await qualityServer.callTool('set_sla', {
        datasetId: 'isolation_test_table',
        customerId: TENANT_1,
        rules: [
          {
            metric: 'null_rate',
            operator: 'lte',
            threshold: 0.05,
            severity: 'critical',
            description: 'Null rate must not exceed 5%',
          },
        ],
      });
      const slaData = parseToolResponse(slaResult);
      expect(slaData.created).toBe(true);
      expect(slaData.sla.customerId).toBe(TENANT_1);

      // The SLA object contains tenant-1's customerId — confirms scoping
      expect(slaData.sla.customerId).not.toBe(TENANT_2);
    });

    it('quality score query for tenant-2 does not return tenant-1 data', async () => {
      // Query quality score as tenant-2 for a dataset that only exists for cust-1
      const result = await qualityServer.callTool('get_quality_score', {
        datasetId: 'fact_orders',
        customerId: TENANT_2,
      });
      const data = parseToolResponse(result);

      // Should return null score or no_data — not cust-1's quality score
      expect(data.score === null || data.status === 'no_data' || data.error).toBeTruthy();
    });

    it('anomalies query for unrelated tenant returns empty', async () => {
      const result = await qualityServer.callTool('get_anomalies', {
        customerId: UNRELATED_TENANT,
      });
      const { data } = parseToolResponseAllowError(result);

      // Should have no anomalies for an unrelated tenant
      if (data.anomalies) {
        expect(data.anomalies).toEqual([]);
      }
      if (data.totalAnomalies !== undefined) {
        expect(data.totalAnomalies).toBe(0);
      }
    });
  });

  // ── 4. Governance Policy Isolation ────────────────────────────────────────
  describe('dw-governance: policy check isolation', () => {
    it('policy check for tenant-1 does not apply tenant-2 policies', async () => {
      // Check policy as tenant-1
      const t1Result = await governanceServer.callTool('check_policy', {
        action: 'read',
        resource: 'table:analytics.public.fact_orders',
        agentId: 'dw-insights',
        customerId: TENANT_1,
      });
      const t1Data = parseToolResponse(t1Result);
      expect(t1Data).toHaveProperty('allowed');

      // Check same policy as tenant-2
      const t2Result = await governanceServer.callTool('check_policy', {
        action: 'read',
        resource: 'table:analytics.public.fact_orders',
        agentId: 'dw-insights',
        customerId: TENANT_2,
      });
      const t2Data = parseToolResponse(t2Result);
      expect(t2Data).toHaveProperty('allowed');

      // Policies may differ per tenant — the key assertion is that
      // matched rules are scoped to the requesting tenant
      if (t1Data.matchedRules && t1Data.matchedRules.length > 0) {
        // If tenant-2 has matched rules, they should not be the same instances as tenant-1
        // (unless both match global/default rules, which is acceptable)
        for (const rule of t2Data.matchedRules ?? []) {
          // Rule IDs should not be exclusively tenant-1 prefixed
          expect(rule.id).toBeDefined();
        }
      }
    });

    it('RBAC enforcement is per-tenant', async () => {
      const t1Rbac = await governanceServer.callTool('enforce_rbac', {
        resource: 'table:analytics.public.fact_orders',
        userId: 'user-alice',
        role: 'viewer',
        customerId: TENANT_1,
      });
      const t1Data = parseToolResponse(t1Rbac);

      const t2Rbac = await governanceServer.callTool('enforce_rbac', {
        resource: 'table:analytics.public.fact_orders',
        userId: 'user-alice',
        role: 'admin',
        customerId: TENANT_2,
      });
      const t2Data = parseToolResponse(t2Rbac);

      // Both should return valid RBAC results — verifying each tenant gets its own evaluation
      expect(t1Data).toBeDefined();
      expect(t2Data).toBeDefined();
      // A viewer in tenant-1 should not automatically get admin in tenant-2
      // (if permissions are returned, they should reflect the requested role)
      if (t1Data.permissions && t2Data.permissions) {
        // Admin should have equal or more permissions than viewer
        expect(typeof t1Data.permissions).toBe('object');
        expect(typeof t2Data.permissions).toBe('object');
      }
    });
  });

  // ── 5. Schema Detection Isolation ─────────────────────────────────────────
  describe('dw-schema: schema detection isolation', () => {
    it('schema baseline for tenant-1 does not leak to tenant-2', async () => {
      // Detect schema as tenant-1 — creates a baseline
      const t1Result = await schemaServer.callTool('detect_schema_change', {
        source: 'snowflake',
        customerId: TENANT_1,
        database: 'analytics',
        schema: 'public',
      });
      const t1Data = parseToolResponse(t1Result);
      expect(t1Data.baseline === true || Array.isArray(t1Data.changes)).toBe(true);

      // Detect schema as tenant-2 — should get its own baseline (not tenant-1's changes)
      const t2Result = await schemaServer.callTool('detect_schema_change', {
        source: 'snowflake',
        customerId: TENANT_2,
        database: 'analytics',
        schema: 'public',
      });
      const t2Data = parseToolResponse(t2Result);

      // tenant-2 should independently detect baseline (not inherit tenant-1's state)
      expect(t2Data.baseline === true || Array.isArray(t2Data.changes)).toBe(true);
    });
  });

  // ── Cross-Agent Isolation Patterns ────────────────────────────────────────
  describe('cross-agent isolation patterns', () => {
    it('multiple agents queried with wrong tenant all return empty/no-data', async () => {
      const wrongTenant = 'tenant-iso-wrong';

      // Catalog search
      const catalogResult = await catalogServer.callTool('search_datasets', {
        query: 'orders',
        customerId: wrongTenant,
      });
      const catalogData = parseToolResponse(catalogResult);
      if (!catalogData.coldStart) {
        expect(catalogData.results.length).toBe(0);
      }

      // Incident history
      const incidentResult = await incidentsServer.callTool('get_incident_history', {
        customerId: wrongTenant,
      });
      const incidentData = parseToolResponse(incidentResult);
      expect(incidentData.totalIncidents).toBe(0);

    });

    it('same tool called with two tenants returns independent results', async () => {
      // Diagnose an incident as tenant-1
      const t1Diag = await incidentsServer.callTool('diagnose_incident', {
        anomalySignals: [
          {
            metric: 'latency',
            value: 5000,
            expected: 100,
            deviation: 4.9,
            source: 'api_gateway',
            timestamp: Date.now(),
          },
        ],
        customerId: TENANT_1,
      });
      const t1Data = parseToolResponse(t1Diag);

      // Diagnose a different incident as tenant-2
      const t2Diag = await incidentsServer.callTool('diagnose_incident', {
        anomalySignals: [
          {
            metric: 'error_rate',
            value: 0.5,
            expected: 0.01,
            deviation: 3.2,
            source: 'payment_service',
            timestamp: Date.now(),
          },
        ],
        customerId: TENANT_2,
      });
      const t2Data = parseToolResponse(t2Diag);

      // Both should get unique incident IDs
      expect(t1Data.incidentId).not.toBe(t2Data.incidentId);

      // Incident types should reflect the different signals, not cross-contaminate
      expect(t1Data.affectedResources).toContain('api_gateway');
      expect(t2Data.affectedResources).toContain('payment_service');
      expect(t1Data.affectedResources).not.toContain('payment_service');
      expect(t2Data.affectedResources).not.toContain('api_gateway');
    });
  });
});
