/**
 * @data-workers/medallion — RBAC & Audit
 *
 * Role-based access control and promotion audit logging.
 */

import type { MedallionLayer, AuditEntry, RBACPermission } from './types.js';

export class AuditLog {
  private entries: AuditEntry[] = [];

  /** Log an audit entry. */
  log(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  /** Retrieve audit entries with optional filtering. */
  getEntries(filter?: {
    layer?: MedallionLayer;
    action?: string;
    since?: number;
  }): AuditEntry[] {
    if (!filter) return [...this.entries];

    return this.entries.filter((entry) => {
      if (filter.layer && entry.sourceLayer !== filter.layer) return false;
      if (filter.action && entry.action !== filter.action) return false;
      if (filter.since && entry.timestamp < filter.since) return false;
      return true;
    });
  }

  /** Clear all audit entries (for testing). */
  clear(): void {
    this.entries = [];
  }
}

export class RBACEnforcer {
  private permissions: RBACPermission[] = [];

  /** Add a permission grant. */
  addPermission(perm: RBACPermission): void {
    this.permissions.push(perm);
  }

  /** Check whether a role has a specific action on a layer. */
  checkAccess(role: string, layer: MedallionLayer, action: string): boolean {
    return this.permissions.some(
      (p) =>
        p.role === role &&
        p.layer === layer &&
        p.actions.includes(action as RBACPermission['actions'][number])
    );
  }

  /** Get all permissions for a role. */
  getPermissions(role: string): RBACPermission[] {
    return this.permissions.filter((p) => p.role === role);
  }

  /** Seed with default roles: admin, engineer, analyst, viewer. */
  seed(): void {
    const allActions: RBACPermission['actions'] = [
      'read',
      'write',
      'promote',
      'rollback',
      'admin',
    ];
    const layers: MedallionLayer[] = ['bronze', 'silver', 'gold'];

    // Admin: full access everywhere
    for (const layer of layers) {
      this.addPermission({ role: 'admin', layer, actions: [...allActions] });
    }

    // Engineer: read/write/promote on all layers, rollback on bronze/silver
    for (const layer of layers) {
      const actions: RBACPermission['actions'] =
        layer === 'gold'
          ? ['read', 'write', 'promote']
          : ['read', 'write', 'promote', 'rollback'];
      this.addPermission({ role: 'engineer', layer, actions });
    }

    // Analyst: read on all layers, write on gold only
    for (const layer of layers) {
      const actions: RBACPermission['actions'] =
        layer === 'gold' ? ['read', 'write'] : ['read'];
      this.addPermission({ role: 'analyst', layer, actions });
    }

    // Viewer: read-only everywhere
    for (const layer of layers) {
      this.addPermission({ role: 'viewer', layer, actions: ['read'] });
    }
  }
}
