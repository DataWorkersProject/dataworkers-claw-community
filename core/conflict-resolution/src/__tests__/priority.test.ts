import { describe, it, expect } from 'vitest';
import { PriorityResolver, AGENT_PRIORITY } from '../priority.js';

describe('PriorityResolver (REQ-CONFL-002)', () => {
  const resolver = new PriorityResolver();

  it('incidents have highest priority (1)', () => {
    expect(AGENT_PRIORITY['dw-incidents']).toBe(1);
  });

  it('orchestrator has implicit highest priority (0)', () => {
    expect(AGENT_PRIORITY['dw-orchestrator']).toBe(0);
  });

  it('resolves incident vs pipeline — incident wins', () => {
    expect(resolver.resolve('dw-incidents', 'dw-pipelines')).toBe('dw-incidents');
  });

  it('resolves governance vs quality — governance wins', () => {
    expect(resolver.resolve('dw-governance', 'dw-quality')).toBe('dw-governance');
  });

  it('resolves schema vs connectors — schema wins', () => {
    expect(resolver.resolve('dw-schema', 'dw-connectors')).toBe('dw-schema');
  });

  it('resolves same priority — returns first agent', () => {
    expect(resolver.resolve('dw-context-catalog', 'dw-usage-intelligence')).toBe('dw-context-catalog');
  });

  it('unknown agent gets priority 99 (lowest)', () => {
    expect(resolver.getPriority('dw-unknown')).toBe(99);
  });

  it('incidents can preempt pipelines', () => {
    expect(resolver.canPreempt('dw-incidents', 'dw-pipelines')).toBe(true);
  });

  it('pipelines cannot preempt incidents', () => {
    expect(resolver.canPreempt('dw-pipelines', 'dw-incidents')).toBe(false);
  });

  it('same-priority agents cannot preempt each other', () => {
    expect(resolver.canPreempt('dw-context-catalog', 'dw-usage-intelligence')).toBe(false);
  });

  it('full 8-level hierarchy ordering is correct', () => {
    const ordered = Object.entries(AGENT_PRIORITY)
      .sort(([, a], [, b]) => a - b)
      .map(([name]) => name);
    expect(ordered[0]).toBe('dw-orchestrator'); // 0
    expect(ordered[1]).toBe('dw-incidents'); // 1
    expect(ordered[2]).toBe('dw-governance'); // 2
  });

  it('all 8 agents are defined', () => {
    expect(Object.keys(AGENT_PRIORITY)).toHaveLength(8);
  });
});
