/**
 * RBAC Engine — role-based access control business logic.
 *
 * Rewritten with KV persistence + tenant isolation.
 * Role assignments are persisted per-tenant in the KV store.
 * Falls back to default role map for unassigned users.
 */

import type { IKeyValueStore } from '@data-workers/infrastructure-stubs';
import type { RbacEnforcementResult } from '../types.js';

// Re-export for backward compatibility
export type { RbacEnforcementResult } from '../types.js';

export class RbacEngine {
  private readonly roleMap: Record<string, string[]> = {
    viewer: ['SELECT'],
    analyst: ['SELECT', 'CREATE VIEW'],
    editor: ['SELECT', 'INSERT', 'UPDATE'],
    data_engineer: ['SELECT', 'INSERT', 'UPDATE', 'CREATE', 'ALTER'],
    admin: ['ALL PRIVILEGES'],
  };

  private kvStore: IKeyValueStore | null = null;

  /** Optionally wire a KV store for persistent role assignments. */
  setKvStore(kvStore: IKeyValueStore): void {
    this.kvStore = kvStore;
  }

  getRolePermissions(role: string): string[] {
    return this.roleMap[role] ?? ['SELECT'];
  }

  /**
   * Persist a role assignment for a user+resource scoped to a tenant.
   * Key format: `rbac:{customerId}:{userId}:{resource}`
   */
  async assignRole(params: {
    customerId: string;
    userId: string;
    resource: string;
    role: string;
  }): Promise<void> {
    if (!this.kvStore) return;
    const key = `rbac:${params.customerId}:${params.userId}:${params.resource}`;
    await this.kvStore.set(key, params.role);
  }

  /**
   * Look up a persisted role for user+resource under the given tenant.
   * Returns null if no KV store is wired or no assignment exists.
   */
  async getAssignedRole(customerId: string, userId: string, resource: string): Promise<string | null> {
    if (!this.kvStore) return null;
    const key = `rbac:${customerId}:${userId}:${resource}`;
    return this.kvStore.get(key);
  }

  enforce(params: {
    resource: string;
    userId: string;
    role: string;
    columnRestrictions?: string[];
    customerId?: string;
  }): RbacEnforcementResult {
    const permissions = this.getRolePermissions(params.role);

    return {
      applied: true,
      userId: params.userId,
      resource: params.resource,
      role: params.role,
      permissions,
      columnRestrictions:
        params.columnRestrictions && params.columnRestrictions.length > 0
          ? params.columnRestrictions
          : 'none (full access)',
      appliedAt: Date.now(),
      customerId: params.customerId,
    };
  }
}
