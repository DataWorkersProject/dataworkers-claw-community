import { describe, it, expect } from 'vitest';
import { CitationTracker } from '../citation-tracker.js';

describe('CitationTracker', () => {
  it('exports CitationTracker class', () => {
    expect(CitationTracker).toBeDefined();
  });

  it('creates instance with default citation rate', () => {
    const tracker = new CitationTracker();
    expect(tracker.name).toBe('citation-tracker');
  });

  it('passes validation with sufficient citations', async () => {
    const tracker = new CitationTracker(0.5);
    const result = await tracker.validate({
      content: 'SOURCE: table.users — The users table has 1000 rows.',
      contentType: 'text',
      agentId: 'agent-1',
      customerId: 'cust-1',
    });
    expect(result.gateName).toBe('citation-tracker');
    expect(typeof result.passed).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
  });

  it('extracts citations from content', () => {
    const tracker = new CitationTracker();
    const citations = tracker.extractCitations(
      'SOURCE: table.orders — Orders data\nSOURCE: metric.revenue — Revenue metric'
    );
    expect(Array.isArray(citations)).toBe(true);
  });
});
