import { describe, it, expect } from 'vitest';
import { ConfidenceCascade } from '../confidence-cascade.js';

describe('ConfidenceCascade (REQ-CONFL-006)', () => {
  it('calculates cumulative confidence for single value', () => {
    const cc = new ConfidenceCascade();
    expect(cc.calculateCumulative([0.9])).toBeCloseTo(0.9);
  });

  it('calculates cumulative confidence for chain of 5', () => {
    const cc = new ConfidenceCascade();
    // 0.9 * 0.8 * 0.7 * 0.85 * 0.95 = 0.40698
    expect(cc.calculateCumulative([0.9, 0.8, 0.7, 0.85, 0.95])).toBeCloseTo(0.40698, 4);
  });

  it('all 1.0 produces 1.0', () => {
    const cc = new ConfidenceCascade();
    expect(cc.calculateCumulative([1.0, 1.0, 1.0])).toBe(1.0);
  });

  it('any 0.0 produces 0.0', () => {
    const cc = new ConfidenceCascade();
    expect(cc.calculateCumulative([0.9, 0.0, 0.8])).toBe(0);
  });

  it('empty chain produces 1.0 (identity)', () => {
    const cc = new ConfidenceCascade();
    expect(cc.calculateCumulative([])).toBe(1.0);
  });

  it('needs human review when below threshold (0.6)', () => {
    const cc = new ConfidenceCascade();
    expect(cc.needsHumanReview(0.59)).toBe(true);
    expect(cc.needsHumanReview(0.6)).toBe(false);
    expect(cc.needsHumanReview(0.61)).toBe(false);
  });

  it('rate limiting triggers after max actions', () => {
    const cc = new ConfidenceCascade(3); // max 3 per hour
    expect(cc.isRateLimited('agent-1')).toBe(false);
    cc.recordAction('agent-1');
    cc.recordAction('agent-1');
    cc.recordAction('agent-1');
    expect(cc.isRateLimited('agent-1')).toBe(true);
  });

  it('rate limiting does not affect other agents', () => {
    const cc = new ConfidenceCascade(2);
    cc.recordAction('agent-1');
    cc.recordAction('agent-1');
    expect(cc.isRateLimited('agent-1')).toBe(true);
    expect(cc.isRateLimited('agent-2')).toBe(false);
  });

  it('getRemainingActions returns correct count', () => {
    const cc = new ConfidenceCascade(5);
    expect(cc.getRemainingActions('agent-1')).toBe(5);
    cc.recordAction('agent-1');
    cc.recordAction('agent-1');
    expect(cc.getRemainingActions('agent-1')).toBe(3);
  });

  it('custom human review threshold works', () => {
    const cc = new ConfidenceCascade(10, 0.8);
    expect(cc.needsHumanReview(0.79)).toBe(true);
    expect(cc.needsHumanReview(0.8)).toBe(false);
  });
});
