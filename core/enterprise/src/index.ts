/**
 * OSS shim for @data-workers/enterprise
 *
 * In the open-source edition, enterprise middleware (PII scanning,
 * tamper-evident audit logging) is not available. This module
 * exports no-op stubs so agents compile and run without changes.
 */

/** No-op middleware wrapper — returns the handler unchanged. */
export function withMiddleware<T extends (...args: any[]) => any>(_agentId: string, _toolName: string, handler: T): T {
  return handler;
}

/** No-op PII middleware stub. */
export function getPIIMiddleware() {
  return { scan: () => [] };
}

/** No-op audit log stub. */
export function getAuditLog() {
  return { append: async () => {} };
}

/** No-op reset. */
export function resetMiddleware(): void {}

/** Minimal Span type for tracing stubs. */
export interface Span {
  name: string;
  attributes: Record<string, string>;
  status: string;
}

/** No-op OTel integration stub. */
export class OTelIntegration {
  constructor(_opts?: { serviceName?: string }) {}

  startSpan(name: string, attributes?: Record<string, string>): Span {
    return { name, attributes: attributes ?? {}, status: 'ok' };
  }

  endSpan(_span: Span, _status?: string): void {}
}

/** Operation type for autonomy governance. */
export type OperationType = 'read' | 'write' | 'execute' | 'admin';

/** No-op hardened autonomy controller stub. */
export class HardenedAutonomyController {
  constructor(_mode?: string) {}

  checkPermission(_agentId: string, _operation: OperationType): { allowed: boolean; requiresApproval: boolean; reason: string; mode: string } {
    return { allowed: true, requiresApproval: false, reason: 'OSS mode — all operations permitted', mode: 'autonomous' };
  }

  requestApproval(_agentId: string, _operation: OperationType, _description: string): { id: string; status: string } {
    return { id: `approval-${Date.now()}`, status: 'auto-approved' };
  }
}

/** No-op hardened rollback manager stub. */
export class HardenedRollbackManager {
  recordOperation(_op: { agentId: string; kind: string; description: string; params: Record<string, unknown>; reversible: boolean }): string {
    return `op-${Date.now()}`;
  }

  rollback(_operationId: string): { success: boolean; message: string } {
    return { success: false, message: 'Rollback not available in OSS edition' };
  }
}
