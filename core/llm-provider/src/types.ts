/**
 * LLM Provider Abstraction — Type Definitions
 *
 * Core interfaces and types for the multi-provider LLM abstraction layer.
 * All providers implement ILLMProvider for a unified API surface.
 */

/* ------------------------------------------------------------------ */
/*  Request / Response                                                 */
/* ------------------------------------------------------------------ */

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  tools?: LLMTool[];
  responseFormat?: 'text' | 'json';
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs: number;
  cost?: { inputCost: number; outputCost: number; totalCost: number };
  finishReason: 'stop' | 'length' | 'tool_call' | 'error';
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Provider Interface                                                 */
/* ------------------------------------------------------------------ */

export interface ILLMProvider {
  readonly name: string;
  readonly supportedModels: string[];

  complete(request: LLMRequest): Promise<LLMResponse>;
  isAvailable(): boolean;
  getUsage(): ProviderUsage;
  reset(): void;
}

/* ------------------------------------------------------------------ */
/*  Usage / Cost                                                       */
/* ------------------------------------------------------------------ */

export interface ProviderUsage {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
}

/* ------------------------------------------------------------------ */
/*  Model Configuration                                                */
/* ------------------------------------------------------------------ */

export interface ModelConfig {
  modelId: string;
  provider: string;
  costPer1kInput: number;
  costPer1kOutput: number;
  maxTokens: number;
  contextWindow: number;
  capabilities: ('text' | 'code' | 'reasoning' | 'vision' | 'tools')[];
}

/* ------------------------------------------------------------------ */
/*  Routing                                                            */
/* ------------------------------------------------------------------ */

export interface RoutingRule {
  pattern: RegExp | string;
  preferredModel: string;
  fallbackModel?: string;
  maxCostPerRequest?: number;
}

/* ------------------------------------------------------------------ */
/*  Circuit Breaker                                                    */
/* ------------------------------------------------------------------ */

export interface CircuitBreakerConfig {
  failureThreshold: number;   // failures before opening
  resetTimeMs: number;        // time before half-open
  halfOpenRequests: number;   // requests to try in half-open
}
