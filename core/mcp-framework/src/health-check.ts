/**
 * Health check utility for Data Workers MCP agents.
 *
 * Agents can register named health checks (e.g. "database", "redis",
 * "llm-provider") and then call `getHealthStatus()` to obtain a
 * summary that includes per-check results, overall status, and uptime.
 *
 * This module is opt-in — agents that don't need health checks are
 * unaffected.
 */

// ── Types ──

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type OverallStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  name: string;
  status: CheckStatus;
  message?: string;
}

export interface HealthStatus {
  agent: string;
  status: OverallStatus;
  tools: number;
  uptime: number;
  checks: HealthCheck[];
  timestamp: string;
}

export type HealthCheckFn = () => Promise<HealthCheck> | HealthCheck;

// ── HealthChecker ──

/**
 * Collects and runs named health checks, then computes an overall status.
 *
 * Rules:
 * - If **any** check is `fail` → `unhealthy`
 * - Else if **any** check is `warn` → `degraded`
 * - Otherwise → `healthy`
 */
export class HealthChecker {
  private agentName: string;
  private startedAt: number;
  private checks = new Map<string, HealthCheckFn>();
  private toolCount: number;

  constructor(agentName: string, toolCount: number) {
    this.agentName = agentName;
    this.toolCount = toolCount;
    this.startedAt = Date.now();
  }

  /**
   * Register a named health check function.
   * If a check with the same name exists it is replaced.
   */
  register(name: string, fn: HealthCheckFn): void {
    this.checks.set(name, fn);
  }

  /**
   * Remove a previously registered health check.
   */
  unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  /**
   * Update the reported tool count (e.g. after dynamic tool registration).
   */
  setToolCount(count: number): void {
    this.toolCount = count;
  }

  /**
   * Run all registered checks concurrently and return a `HealthStatus`.
   * Individual checks that throw are reported as `fail`.
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const results: HealthCheck[] = [];

    const entries = Array.from(this.checks.entries());
    const settled = await Promise.allSettled(
      entries.map(async ([name, fn]) => {
        try {
          return await fn();
        } catch (err) {
          return {
            name,
            status: 'fail' as const,
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        // Promise.allSettled rejection — shouldn't happen given inner try/catch,
        // but handle defensively.
        results.push({
          name: 'unknown',
          status: 'fail',
          message: String(outcome.reason),
        });
      }
    }

    const overall = computeOverallStatus(results);

    return {
      agent: this.agentName,
      status: overall,
      tools: this.toolCount,
      uptime: Date.now() - this.startedAt,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }
}

// ── Helpers ──

function computeOverallStatus(checks: HealthCheck[]): OverallStatus {
  if (checks.length === 0) return 'healthy';
  if (checks.some((c) => c.status === 'fail')) return 'unhealthy';
  if (checks.some((c) => c.status === 'warn')) return 'degraded';
  return 'healthy';
}
