import { describe, it, expect } from 'vitest';
import { CapabilityTracker } from '../capability-tracker.js';

describe('CapabilityTracker', () => {
  it('captures initial manifest', () => {
    const tracker = new CapabilityTracker();
    const manifest = tracker.capture(
      'test-server', '1.0.0', '2024-11-05',
      ['tool_a', 'tool_b'], ['res://a'], ['prompt_x'],
    );
    expect(manifest.serverName).toBe('test-server');
    expect(manifest.tools).toEqual(['tool_a', 'tool_b']);
    expect(manifest.resources).toEqual(['res://a']);
    expect(manifest.prompts).toEqual(['prompt_x']);
  });

  it('detects no changes when capabilities unchanged', () => {
    const tracker = new CapabilityTracker();
    tracker.capture('srv', '1.0', '2024-11-05', ['a', 'b'], [], []);
    const diff = tracker.diff('srv', ['a', 'b'], [], []);
    expect(diff.hasChanges).toBe(false);
    expect(diff.addedTools).toEqual([]);
    expect(diff.removedTools).toEqual([]);
  });

  it('detects tool removal (REQ-MCP-007)', () => {
    const tracker = new CapabilityTracker();
    tracker.capture('srv', '1.0', '2024-11-05', ['a', 'b', 'c'], [], []);
    const diff = tracker.diff('srv', ['a', 'c'], [], []);
    expect(diff.hasChanges).toBe(true);
    expect(diff.removedTools).toEqual(['b']);
    expect(diff.addedTools).toEqual([]);
  });

  it('detects tool addition', () => {
    const tracker = new CapabilityTracker();
    tracker.capture('srv', '1.0', '2024-11-05', ['a'], [], []);
    const diff = tracker.diff('srv', ['a', 'b'], [], []);
    expect(diff.hasChanges).toBe(true);
    expect(diff.addedTools).toEqual(['b']);
  });

  it('detects resource changes', () => {
    const tracker = new CapabilityTracker();
    tracker.capture('srv', '1.0', '2024-11-05', [], ['res://a', 'res://b'], []);
    const diff = tracker.diff('srv', [], ['res://b', 'res://c'], []);
    expect(diff.removedResources).toEqual(['res://a']);
    expect(diff.addedResources).toEqual(['res://c']);
  });

  it('fires onChange listener', () => {
    const tracker = new CapabilityTracker();
    tracker.capture('srv', '1.0', '2024-11-05', ['a'], [], []);

    let called = false;
    tracker.onChange((name, diff) => {
      called = true;
      expect(name).toBe('srv');
      expect(diff.removedTools).toEqual(['a']);
    });

    tracker.diff('srv', [], [], []);
    expect(called).toBe(true);
  });

  it('does not fire listener when no changes', () => {
    const tracker = new CapabilityTracker();
    tracker.capture('srv', '1.0', '2024-11-05', ['a'], [], []);

    let called = false;
    tracker.onChange(() => { called = true; });

    tracker.diff('srv', ['a'], [], []);
    expect(called).toBe(false);
  });

  it('hasToolAvailable checks manifest', () => {
    const tracker = new CapabilityTracker();
    tracker.capture('srv', '1.0', '2024-11-05', ['tool_a', 'tool_b'], [], []);
    expect(tracker.hasToolAvailable('srv', 'tool_a')).toBe(true);
    expect(tracker.hasToolAvailable('srv', 'tool_c')).toBe(false);
    expect(tracker.hasToolAvailable('unknown', 'tool_a')).toBe(false);
  });

  it('returns first-time diff without previous manifest', () => {
    const tracker = new CapabilityTracker();
    const diff = tracker.diff('new-srv', ['a', 'b'], ['r://1'], ['p1']);
    expect(diff.hasChanges).toBe(false);
    expect(diff.addedTools).toEqual(['a', 'b']);
    expect(diff.removedTools).toEqual([]);
  });
});
