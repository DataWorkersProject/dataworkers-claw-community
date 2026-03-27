/**
 * Ephemeral Access Manager — JIT time-limited access grants.
 *
 * Creates access grants that auto-expire after a duration or when a task completes.
 */

import type { AccessLevel, EphemeralAccessGrant } from '../types.js';

export class EphemeralAccessManager {
  private grants: Map<string, EphemeralAccessGrant> = new Map();
  private counter = 0;

  /** Create a time-limited ephemeral access grant. */
  createGrant(params: {
    userId: string;
    resource: string;
    accessLevel: AccessLevel;
    taskId: string;
    durationMs: number;
  }): EphemeralAccessGrant {
    const now = Date.now();
    const id = `eph-${++this.counter}-${now}`;
    const grant: EphemeralAccessGrant = {
      id,
      userId: params.userId,
      resource: params.resource,
      accessLevel: params.accessLevel,
      grantedAt: now,
      expiresAt: now + params.durationMs,
      taskId: params.taskId,
      revoked: false,
    };
    this.grants.set(id, grant);
    return grant;
  }

  /** Check if a grant is currently valid (not expired, not revoked). */
  isValid(grantId: string): boolean {
    const grant = this.grants.get(grantId);
    if (!grant) return false;
    if (grant.revoked) return false;
    if (Date.now() > grant.expiresAt) {
      this.revokeGrant(grantId, 'expired');
      return false;
    }
    return true;
  }

  /** Revoke a grant (on task completion, expiry, or manual). */
  revokeGrant(grantId: string, reason: 'expired' | 'task_complete' | 'manual'): boolean {
    const grant = this.grants.get(grantId);
    if (!grant || grant.revoked) return false;
    grant.revoked = true;
    grant.revokedAt = Date.now();
    grant.revokeReason = reason;
    return true;
  }

  /** Revoke all grants for a given task (task completion trigger). */
  revokeByTask(taskId: string): number {
    let count = 0;
    for (const grant of this.grants.values()) {
      if (grant.taskId === taskId && !grant.revoked) {
        this.revokeGrant(grant.id, 'task_complete');
        count++;
      }
    }
    return count;
  }

  /** Get all active (non-revoked, non-expired) grants for a user. */
  getActiveGrants(userId: string): EphemeralAccessGrant[] {
    const results: EphemeralAccessGrant[] = [];
    const now = Date.now();
    for (const grant of this.grants.values()) {
      if (grant.userId === userId && !grant.revoked && now <= grant.expiresAt) {
        results.push(grant);
      }
    }
    return results;
  }

  /** Get a grant by ID. */
  getGrant(grantId: string): EphemeralAccessGrant | undefined {
    return this.grants.get(grantId);
  }

  /** Expire all grants that have passed their expiresAt. */
  expireStale(): number {
    const now = Date.now();
    let count = 0;
    for (const grant of this.grants.values()) {
      if (!grant.revoked && now > grant.expiresAt) {
        this.revokeGrant(grant.id, 'expired');
        count++;
      }
    }
    return count;
  }
}
