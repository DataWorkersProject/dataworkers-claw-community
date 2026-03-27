import { describe, it, expect } from 'vitest';
import { RbacEngine } from '../rbac-engine.js';

describe('RbacEngine', () => {
  it('exports RbacEngine class', () => {
    expect(RbacEngine).toBeDefined();
  });

  it('returns SELECT for viewer role', () => {
    const engine = new RbacEngine();
    expect(engine.getRolePermissions('viewer')).toEqual(['SELECT']);
  });

  it('returns ALL PRIVILEGES for admin role', () => {
    const engine = new RbacEngine();
    expect(engine.getRolePermissions('admin')).toEqual(['ALL PRIVILEGES']);
  });

  it('defaults unknown role to SELECT', () => {
    const engine = new RbacEngine();
    expect(engine.getRolePermissions('unknown')).toEqual(['SELECT']);
  });

  it('enforces RBAC and returns result', () => {
    const engine = new RbacEngine();
    const result = engine.enforce({ resource: 'table_a', userId: 'user-1', role: 'analyst' });
    expect(result.applied).toBe(true);
    expect(result.permissions).toContain('SELECT');
    expect(result.permissions).toContain('CREATE VIEW');
  });
});
