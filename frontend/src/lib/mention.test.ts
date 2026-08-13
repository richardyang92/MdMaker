import { describe, it, expect } from 'vitest';
import { applyMention, detectMention, filterMentionOptions } from './mention';

describe('detectMention', () => {
  it('returns null when no @ precedes the caret', () => {
    expect(detectMention('hello world', 11)).toBeNull();
  });

  it('detects a mention query at the caret', () => {
    expect(detectMention('把 @ctx', 6)).toEqual({ start: 2, query: 'ctx' });
  });

  it('detects an empty query right after @', () => {
    expect(detectMention('把 @', 3)).toEqual({ start: 2, query: '' });
  });

  it('detects a mention after whitespace but not inside a word', () => {
    expect(detectMention('abc@ctx-1', 8)).toBeNull();
    expect(detectMention('abc @ctx-1', 10)).toEqual({ start: 4, query: 'ctx-1' });
  });

  it('only looks at the text before the caret', () => {
    expect(detectMention('@ctx-1 后半句', 6)).toEqual({ start: 0, query: 'ctx-1' });
  });
});

describe('applyMention', () => {
  it('replaces the query with @ref plus a trailing space', () => {
    const { value, caret } = applyMention('把 @c改一下', { start: 2, query: 'c' }, 'ctx-1');
    expect(value).toBe('把 @ctx-1 改一下');
    expect(caret).toBe(2 + '@ctx-1 '.length);
  });

  it('handles an empty query', () => {
    const { value } = applyMention('看 @', { start: 2, query: '' }, 'document');
    expect(value).toBe('看 @document ');
  });
});

describe('filterMentionOptions', () => {
  const options = [
    { ref: 'document', label: '文档全文' },
    { ref: 'ctx-1', label: '引言' },
    { ref: 'ctx-2', label: '结论' },
  ];

  it('returns all options for an empty query', () => {
    expect(filterMentionOptions(options, '')).toHaveLength(3);
  });

  it('matches on ref', () => {
    expect(filterMentionOptions(options, 'ctx-2').map((o) => o.ref)).toEqual(['ctx-2']);
  });

  it('matches on label case-insensitively', () => {
    expect(filterMentionOptions(options, '文档').map((o) => o.ref)).toEqual(['document']);
  });
});
