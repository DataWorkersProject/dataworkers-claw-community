/**
 * Intelligent Model Router
 *
 * Routes LLM requests to the best provider/model based on:
 * 1. Explicit model in the request
 * 2. Routing rules (pattern-match on prompt)
 * 3. Cost constraints
 * 4. Default model fallback
 */

import type { ILLMProvider, LLMRequest, LLMResponse, RoutingRule } from './types.js';

export class ModelRouter {
  private rules: RoutingRule[] = [];
  private providers: Map<string, ILLMProvider> = new Map();
  private defaultProvider: ILLMProvider | undefined;
  private defaultModel: string | undefined;

  /**
   * Register a provider. The first registered provider becomes the default.
   */
  registerProvider(provider: ILLMProvider): void {
    this.providers.set(provider.name, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = provider;
      this.defaultModel = provider.supportedModels[0];
    }
  }

  /**
   * Set the default provider/model explicitly.
   */
  setDefault(providerName: string, model?: string): void {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`ModelRouter: Provider '${providerName}' is not registered.`);
    }
    this.defaultProvider = provider;
    this.defaultModel = model ?? provider.supportedModels[0];
  }

  /**
   * Add a routing rule. Rules are evaluated in order; first match wins.
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
  }

  /**
   * Route a request to the best provider and model.
   */
  route(request: LLMRequest): { provider: ILLMProvider; model: string } {
    // 1. Explicit model in request — find the provider that supports it
    if (request.model) {
      for (const provider of this.providers.values()) {
        if (provider.supportedModels.includes(request.model) && provider.isAvailable()) {
          return { provider, model: request.model };
        }
      }
      // If no available provider supports the explicit model, fall through
    }

    // 2. Routing rules — pattern match on prompt
    const lower = request.prompt.toLowerCase();
    for (const rule of this.rules) {
      const matches =
        rule.pattern instanceof RegExp
          ? rule.pattern.test(lower)
          : lower.includes(rule.pattern.toLowerCase());

      if (matches) {
        const result = this.findProviderForModel(rule.preferredModel);
        if (result) return result;

        // Try fallback model from rule
        if (rule.fallbackModel) {
          const fallback = this.findProviderForModel(rule.fallbackModel);
          if (fallback) return fallback;
        }
      }
    }

    // 3. Default
    if (this.defaultProvider) {
      return { provider: this.defaultProvider, model: this.defaultModel ?? this.defaultProvider.supportedModels[0] };
    }

    throw new Error('ModelRouter: No providers registered.');
  }

  /**
   * Route and execute a completion request.
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const { provider, model } = this.route(request);
    return provider.complete({ ...request, model });
  }

  /**
   * Get all registered provider names.
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all registered routing rules.
   */
  getRules(): RoutingRule[] {
    return [...this.rules];
  }

  /**
   * Seed with sensible default routing rules for data engineering use cases.
   */
  seed(): void {
    this.rules = [];

    // Code generation → prefer powerful models
    this.addRule({
      pattern: /generate|code|pipeline|sql|script/i,
      preferredModel: 'claude-sonnet-4-6',
      fallbackModel: 'gpt-4o',
    });

    // Simple classification → prefer cost-efficient models
    this.addRule({
      pattern: /classify|categorize|label|tag/i,
      preferredModel: 'claude-haiku-4-5',
      fallbackModel: 'gpt-4o-mini',
      maxCostPerRequest: 0.01,
    });

    // SQL-specific
    this.addRule({
      pattern: /translate sql|sql migration|sql query/i,
      preferredModel: 'claude-sonnet-4-6',
      fallbackModel: 'gpt-4o',
    });

    // Data quality & schema
    this.addRule({
      pattern: /quality|schema|validation|drift/i,
      preferredModel: 'claude-sonnet-4-6',
      fallbackModel: 'gpt-4o',
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Private helpers                                                   */
  /* ---------------------------------------------------------------- */

  private findProviderForModel(model: string): { provider: ILLMProvider; model: string } | undefined {
    for (const provider of this.providers.values()) {
      if (provider.supportedModels.includes(model) && provider.isAvailable()) {
        return { provider, model };
      }
    }
    return undefined;
  }
}
