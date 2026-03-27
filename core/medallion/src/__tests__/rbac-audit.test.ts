import { describe, it, expect } from 'vitest';
import { AuditLog, RBACEnforcer } from '../rbac-audit.js';

describe('AuditLog', () => {
  it('exports AuditLog class', () => {
    expect(AuditLog).toBeDefined();
  });

  it('logs and retrieves entries', () => {
    const log = new AuditLog();
    log.log({
      id: 'audit-1',
      timestamp: Date.now(),
      action: 'promote',
      actor: 'system',
      sourceLayer: 'bronze',
      targetLayer: 'silver',
      table: 'events',
      details: {},
    });
    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('promote');
  });

  it('filters by layer', () => {
    const log = new AuditLog();
    log.log({ id: '1', timestamp: Date.now(), action: 'promote', actor: 'sys', sourceLayer: 'bronze', table: 'a', details: {} });
    log.log({ id: '2', timestamp: Date.now(), action: 'promote', actor: 'sys', sourceLayer: 'silver', table: 'b', details: {} });
    const filtered = log.getEntries({ layer: 'bronze' });
    expect(filtered).toHaveLength(1);
  });

  it('clears entries', () => {
    const log = new AuditLog();
    log.log({ id: '1', timestamp: Date.now(), action: 'compact', actor: 'sys', sourceLayer: 'gold', table: 'x', details: {} });
    log.clear();
    expect(log.getEntries()).toHaveLength(0);
  });
});

describe('RBACEnforcer', () => {
  it('exports RBACEnforcer class', () => {
    expect(RBACEnforcer).toBeDefined();
  });

  it('checks access for granted permissions', () => {
    const enforcer = new RBACEnforcer();
    enforcer.addPermission({ role: 'admin', layer: 'gold', actions: ['read', 'write', 'promote'] });
    expect(enforcer.checkAccess('admin', 'gold', 'promote')).toBe(true);
    expect(enforcer.checkAccess('admin', 'gold', 'admin')).toBe(false);
  });

  it('denies access for unregistered roles', () => {
    const enforcer = new RBACEnforcer();
    expect(enforcer.checkAccess('unknown', 'bronze', 'read')).toBe(false);
  });

  it('gets permissions for a role', () => {
    const enforcer = new RBACEnforcer();
    enforcer.addPermission({ role: 'viewer', layer: 'bronze', actions: ['read'] });
    enforcer.addPermission({ role: 'viewer', layer: 'silver', actions: ['read'] });
    const perms = enforcer.getPermissions('viewer');
    expect(perms).toHaveLength(2);
  });
});
