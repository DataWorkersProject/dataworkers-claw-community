import { describe, it, expect } from 'vitest';
import { InMemoryLLMClient } from '../llm-client-stub.js';

describe('InMemoryLLMClient', () => {
  it('complete returns response for default prompt', async () => {
    const llm = new InMemoryLLMClient();
    const response = await llm.complete('Hello, can you help?');
    expect(response.content).toContain('data pipeline');
    expect(response.tokensUsed.input).toBeGreaterThan(0);
    expect(response.tokensUsed.output).toBeGreaterThan(0);
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('complete returns pipeline parse JSON for pipeline prompts', async () => {
    const llm = new InMemoryLLMClient();
    const response = await llm.complete('Parse pipeline description for ETL');
    const parsed = JSON.parse(response.content);
    expect(parsed.pipelineName).toBe('llm_parsed_pipeline');
    expect(parsed.pattern).toBe('etl');
    expect(parsed.confidence).toBe(0.95);
  });

  it('complete returns SQL for generate prompts', async () => {
    const llm = new InMemoryLLMClient();
    const response = await llm.complete('Generate a query for orders');
    expect(response.content).toContain('SELECT');
    expect(response.content).toContain('source_table');
  });

  it('getTotalSpend tracks cumulative spend', async () => {
    const llm = new InMemoryLLMClient();
    expect(await llm.getTotalSpend()).toBe(0);
    await llm.complete('first call');
    const spendAfterOne = await llm.getTotalSpend();
    expect(spendAfterOne).toBeGreaterThan(0);
    await llm.complete('second call');
    expect(await llm.getTotalSpend()).toBeGreaterThan(spendAfterOne);
  });

  it('getCallCount tracks call count', async () => {
    const llm = new InMemoryLLMClient();
    expect(await llm.getCallCount()).toBe(0);
    await llm.complete('one');
    await llm.complete('two');
    await llm.complete('three');
    expect(await llm.getCallCount()).toBe(3);
  });

  it('reset clears spend and count', async () => {
    const llm = new InMemoryLLMClient();
    await llm.complete('a call');
    expect(await llm.getCallCount()).toBe(1);
    expect(await llm.getTotalSpend()).toBeGreaterThan(0);
    await llm.reset();
    expect(await llm.getCallCount()).toBe(0);
    expect(await llm.getTotalSpend()).toBe(0);
  });
});
