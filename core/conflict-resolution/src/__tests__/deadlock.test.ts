import { describe, it, expect } from 'vitest';
import { DeadlockDetector } from '../deadlock.js';

describe('DeadlockDetector (REQ-CONFL-004)', () => {
  it('detects simple 2-node cycle', () => {
    const dd = new DeadlockDetector();
    dd.addWait('A', 'B', 'resource1');
    dd.addWait('B', 'A', 'resource2');
    const cycle = dd.detectCycle();
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(2);
  });

  it('detects 3-node cycle', () => {
    const dd = new DeadlockDetector();
    dd.addWait('A', 'B', 'r1');
    dd.addWait('B', 'C', 'r2');
    dd.addWait('C', 'A', 'r3');
    const cycle = dd.detectCycle();
    expect(cycle).not.toBeNull();
  });

  it('returns null for acyclic graph', () => {
    const dd = new DeadlockDetector();
    dd.addWait('A', 'B', 'r1');
    dd.addWait('B', 'C', 'r2');
    const cycle = dd.detectCycle();
    expect(cycle).toBeNull();
  });

  it('returns null for empty graph', () => {
    const dd = new DeadlockDetector();
    expect(dd.detectCycle()).toBeNull();
  });

  it('selectVictim picks lowest priority (highest number)', () => {
    const dd = new DeadlockDetector();
    const priorities = { 'dw-incidents': 1, 'dw-pipelines': 5, 'dw-cost': 7 };
    expect(dd.selectVictim(['dw-incidents', 'dw-pipelines', 'dw-cost'], priorities)).toBe('dw-cost');
  });

  it('selectVictim handles unknown agents as priority 99', () => {
    const dd = new DeadlockDetector();
    const priorities = { 'dw-incidents': 1 };
    expect(dd.selectVictim(['dw-incidents', 'unknown-agent'], priorities)).toBe('unknown-agent');
  });

  it('removeWait clears the edge', () => {
    const dd = new DeadlockDetector();
    dd.addWait('A', 'B', 'r1');
    dd.removeWait('A', 'r1');
    expect(dd.getWaitGraph()).toHaveLength(0);
  });

  it('getWaitGraph returns a copy', () => {
    const dd = new DeadlockDetector();
    dd.addWait('A', 'B', 'r1');
    const graph = dd.getWaitGraph();
    graph.pop();
    expect(dd.getWaitGraph()).toHaveLength(1);
  });

  it('default check interval is 5000ms', () => {
    const dd = new DeadlockDetector();
    expect(dd.getCheckInterval()).toBe(5_000);
  });

  it('custom check interval is respected', () => {
    const dd = new DeadlockDetector(10_000);
    expect(dd.getCheckInterval()).toBe(10_000);
  });
});
