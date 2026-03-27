/**
 * /298: Provider Fallback + Circuit Breaker
 *
 * ProviderFallback tries the primary provider, then each fallback in order.
 * CircuitBreaker prevents hammering a down provider by tracking failures
 * and transitioning through closed → open → half-open states.
 */

import type {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
  ProviderUsage,
  CircuitBreakerConfig,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Circuit Breaker                                                    */
/* ------------------------------------------------------------------ */

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  constructor(private readonly config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeMs) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
      } else {
        throw new Error('CircuitBreaker: Circuit is open — provider is unavailable.');
      }
    }

    if (this.state === 'half-open' && this.halfOpenAttempts >= this.config.halfOpenRequests) {
      throw new Error('CircuitBreaker: Half-open request limit reached.');
    }

    try {
      if (this.state === 'half-open') {
        this.halfOpenAttempts++;
      }
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.halfOpenRequests) {
        // Recovered — close the circuit
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
        this.halfOpenAttempts = 0;
      }
    } else {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Failure in half-open → reopen
      this.state = 'open';
      this.successes = 0;
      this.halfOpenAttempts = 0;
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Provider Fallback                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeMs: 30_000,
  halfOpenRequests: 1,
};

export class ProviderFallback implements ILLMProvider {
  readonly name: string;
  readonly supportedModels: string[];

  private readonly primary: ILLMProvider;
  private readonly fallbacks: ILLMProvider[];
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(
    primary: ILLMProvider,
    fallbacks: ILLMProvider[],
    config?: CircuitBreakerConfig,
  ) {
    this.primary = primary;
    this.fallbacks = fallbacks;
    this.name = `fallback(${primary.name})`;

    // Merge supported models from all providers
    const models = new Set<string>();
    for (const m of primary.supportedModels) models.add(m);
    for (const fb of fallbacks) {
      for (const m of fb.supportedModels) models.add(m);
    }
    this.supportedModels = Array.from(models);

    // Create a circuit breaker for each provider
    const cbConfig = config ?? DEFAULT_CIRCUIT_BREAKER_CONFIG;
    this.circuitBreakers.set(primary.name, new CircuitBreaker(cbConfig));
    for (const fb of fallbacks) {
      this.circuitBreakers.set(fb.name, new CircuitBreaker(cbConfig));
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const providers = [this.primary, ...this.fallbacks];
    const errors: Error[] = [];

    for (const provider of providers) {
      const cb = this.circuitBreakers.get(provider.name)!;

      try {
        return await cb.execute(() => provider.complete(request));
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    throw new Error(
      `ProviderFallback: All providers failed.\n` +
      errors.map((e, i) => `  [${providers[i]?.name ?? i}]: ${e.message}`).join('\n'),
    );
  }

  isAvailable(): boolean {
    return this.primary.isAvailable() || this.fallbacks.some((fb) => fb.isAvailable());
  }

  getUsage(): ProviderUsage {
    // Aggregate usage across all providers
    const usage: ProviderUsage = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byModel: {},
    };

    const all = [this.primary, ...this.fallbacks];
    for (const provider of all) {
      const pu = provider.getUsage();
      usage.totalRequests += pu.totalRequests;
      usage.totalTokens += pu.totalTokens;
      usage.totalCost += pu.totalCost;
      for (const [model, stats] of Object.entries(pu.byModel)) {
        if (!usage.byModel[model]) {
          usage.byModel[model] = { requests: 0, tokens: 0, cost: 0 };
        }
        usage.byModel[model].requests += stats.requests;
        usage.byModel[model].tokens += stats.tokens;
        usage.byModel[model].cost += stats.cost;
      }
    }

    return usage;
  }

  reset(): void {
    this.primary.reset();
    for (const fb of this.fallbacks) fb.reset();
    for (const cb of this.circuitBreakers.values()) cb.reset();
  }

  /**
   * Get the circuit breaker for a specific provider.
   */
  getCircuitBreaker(providerName: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(providerName);
  }
}
