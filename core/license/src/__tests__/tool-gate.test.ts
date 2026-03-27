import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isToolAllowed,
  gateCheck,
  classifyTool,
  getCurrentTier,
  getWriteTools,
  getAdminTools,
  getWriteToolsByAgent,
  filterAllowedTools,
} from '../tool-gate.js';

describe('tool-gate', () => {
  const originalEnv = process.env.DW_LICENSE_TIER;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DW_LICENSE_TIER;
    } else {
      process.env.DW_LICENSE_TIER = originalEnv;
    }
  });

  // -----------------------------------------------------------------------
  // getCurrentTier
  // -----------------------------------------------------------------------
  describe('getCurrentTier', () => {
    it('defaults to community when env var is unset', () => {
      delete process.env.DW_LICENSE_TIER;
      expect(getCurrentTier()).toBe('community');
    });

    it('reads pro from env', () => {
      process.env.DW_LICENSE_TIER = 'pro';
      expect(getCurrentTier()).toBe('pro');
    });

    it('reads enterprise from env (case-insensitive)', () => {
      process.env.DW_LICENSE_TIER = 'Enterprise';
      expect(getCurrentTier()).toBe('enterprise');
    });

    it('falls back to community for unknown values', () => {
      process.env.DW_LICENSE_TIER = 'gold';
      expect(getCurrentTier()).toBe('community');
    });
  });

  // -----------------------------------------------------------------------
  // classifyTool
  // -----------------------------------------------------------------------
  describe('classifyTool', () => {
    it('classifies read tools', () => {
      expect(classifyTool('list_active_agents')).toBe('read');
      expect(classifyTool('get_anomalies')).toBe('read');
      expect(classifyTool('search_datasets')).toBe('read');
      expect(classifyTool('check_agent_health')).toBe('read');
      expect(classifyTool('diagnose_incident')).toBe('read');
    });

    it('classifies write tools', () => {
      expect(classifyTool('deploy_pipeline')).toBe('write');
      expect(classifyTool('apply_migration')).toBe('write');
      expect(classifyTool('trigger_airflow_dag')).toBe('write');
      expect(classifyTool('send_slack_alert')).toBe('write');
      expect(classifyTool('create_servicenow_ticket')).toBe('write');
      expect(classifyTool('emit_lineage_event')).toBe('write');
      expect(classifyTool('register_kafka_schema')).toBe('write');
    });

    it('classifies governance tools as write (not admin)', () => {
      expect(classifyTool('provision_access')).toBe('write');
      expect(classifyTool('enforce_rbac')).toBe('write');
    });

    it('classifies admin tools', () => {
      expect(classifyTool('resolve_pagerduty_alert')).toBe('admin');
    });

    it('treats unknown tools as read (safe default)', () => {
      expect(classifyTool('some_future_tool')).toBe('read');
    });
  });

  // -----------------------------------------------------------------------
  // isToolAllowed
  // -----------------------------------------------------------------------
  describe('isToolAllowed', () => {
    // Community tier: read-only
    it('community: allows read tools', () => {
      expect(isToolAllowed('get_anomalies', 'community')).toBe(true);
      expect(isToolAllowed('list_airflow_dags', 'community')).toBe(true);
    });

    it('community: blocks write tools', () => {
      expect(isToolAllowed('deploy_pipeline', 'community')).toBe(false);
      expect(isToolAllowed('trigger_airflow_dag', 'community')).toBe(false);
      expect(isToolAllowed('send_slack_alert', 'community')).toBe(false);
    });

    it('community: blocks write tools (provision_access, enforce_rbac)', () => {
      expect(isToolAllowed('provision_access', 'community')).toBe(false);
      expect(isToolAllowed('enforce_rbac', 'community')).toBe(false);
    });

    // Pro tier: read + write
    it('pro: allows read tools', () => {
      expect(isToolAllowed('get_anomalies', 'pro')).toBe(true);
    });

    it('pro: allows write tools', () => {
      expect(isToolAllowed('deploy_pipeline', 'pro')).toBe(true);
      expect(isToolAllowed('trigger_airflow_dag', 'pro')).toBe(true);
    });

    it('pro: allows governance write tools', () => {
      expect(isToolAllowed('provision_access', 'pro')).toBe(true);
      expect(isToolAllowed('enforce_rbac', 'pro')).toBe(true);
    });

    // Enterprise tier: everything
    it('enterprise: allows all tools', () => {
      expect(isToolAllowed('get_anomalies', 'enterprise')).toBe(true);
      expect(isToolAllowed('deploy_pipeline', 'enterprise')).toBe(true);
      expect(isToolAllowed('provision_access', 'enterprise')).toBe(true);
    });

    // Uses env var when no tier argument
    it('uses DW_LICENSE_TIER env var when tier not passed', () => {
      process.env.DW_LICENSE_TIER = 'pro';
      expect(isToolAllowed('deploy_pipeline')).toBe(true);
      expect(isToolAllowed('provision_access')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // gateCheck
  // -----------------------------------------------------------------------
  describe('gateCheck', () => {
    it('returns allowed=true with no reason for permitted tools', () => {
      const result = gateCheck('get_anomalies', 'community');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('read');
      expect(result.reason).toBeUndefined();
    });

    it('returns allowed=false with upgrade reason for blocked tools', () => {
      const result = gateCheck('deploy_pipeline', 'community');
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('write');
      expect(result.reason).toContain('pro');
      expect(result.reason).toContain('DW_LICENSE_TIER');
    });

    it('provision_access is allowed at pro tier (write tool)', () => {
      const result = gateCheck('provision_access', 'pro');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('write');
      expect(result.reason).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Registry getters
  // -----------------------------------------------------------------------
  describe('getWriteTools', () => {
    it('returns a non-empty array of write tool names', () => {
      const tools = getWriteTools();
      expect(tools.length).toBeGreaterThan(30);
      expect(tools).toContain('deploy_pipeline');
      expect(tools).toContain('trigger_airflow_dag');
      expect(tools).toContain('send_slack_alert');
    });
  });

  describe('getAdminTools', () => {
    it('returns admin tools (no longer includes provision_access/enforce_rbac)', () => {
      const tools = getAdminTools();
      expect(tools).not.toContain('provision_access');
      expect(tools).not.toContain('enforce_rbac');
      expect(tools).toContain('resolve_pagerduty_alert');
    });
  });

  describe('getWriteToolsByAgent', () => {
    it('returns tools grouped by agent', () => {
      const grouped = getWriteToolsByAgent();
      expect(grouped['dw-pipelines']).toContain('deploy_pipeline');
      expect(grouped['dw-connectors']).toContain('trigger_airflow_dag');
      expect(grouped['dw-schema']).toContain('apply_migration');
    });
  });

  // -----------------------------------------------------------------------
  // filterAllowedTools
  // -----------------------------------------------------------------------
  describe('filterAllowedTools', () => {
    const mixed = ['get_anomalies', 'deploy_pipeline', 'provision_access', 'list_airflow_dags'];

    it('community: only read tools pass', () => {
      const result = filterAllowedTools(mixed, 'community');
      expect(result).toEqual(['get_anomalies', 'list_airflow_dags']);
    });

    it('pro: read + write pass (provision_access is now write)', () => {
      const result = filterAllowedTools(mixed, 'pro');
      expect(result).toEqual(['get_anomalies', 'deploy_pipeline', 'provision_access', 'list_airflow_dags']);
    });

    it('enterprise: everything passes', () => {
      const result = filterAllowedTools(mixed, 'enterprise');
      expect(result).toEqual(mixed);
    });
  });
});
