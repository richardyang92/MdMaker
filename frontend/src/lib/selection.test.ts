import { describe, it, expect, beforeEach } from 'vitest';
import { getSelectionWithin } from './selection';

/**
 * Helper: build a container with inner text nodes and set a DOM Range covering
 * a substring of `inner`. We use real DOM Ranges instead of user-event selection
 * simulation because jsdom's selection API is flaky; Range manipulation is stable.
 */
function makeContainerWithText(inner: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = inner;
  document.body.appendChild(container);
  return container;
}

/** Set the document selection to span [start, end) inside `node`'s text content. */
function selectRangeInText(node: Text, start: number, end: number): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe('getSelectionWithin', () => {
  beforeEach(() => {
    // Clear DOM + selection between tests.
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  it('returns empty string when nothing is selected', () => {
    const container = makeContainerWithText('<p>hello world</p>');
    expect(getSelectionWithin(container)).toBe('');
  });

  it('returns empty string when container is null', () => {
    expect(getSelectionWithin(null)).toBe('');
  });

  it('returns trimmed selected text when selection is inside the container', () => {
    const container = makeContainerWithText('<p>hello world</p>');
    const textNode = container.querySelector('p')!.firstChild as Text;
    selectRangeInText(textNode, 2, 7); // "llo w"
    expect(getSelectionWithin(container)).toBe('llo w');
  });

  it('returns empty string when selection is entirely outside the container', () => {
    const container = makeContainerWithText('<p>inside text</p>');
    // An "outside" element holding its own selectable text.
    const outside = document.createElement('div');
    outside.innerHTML = '<p>outside text</p>';
    document.body.appendChild(outside);
    const outsideNode = outside.querySelector('p')!.firstChild as Text;
    selectRangeInText(outsideNode, 0, 7);
    expect(getSelectionWithin(container)).toBe('');
  });

  it('returns empty string when selection crosses the container boundary', () => {
    const container = makeContainerWithText('<p>inside text</p>');
    const outside = document.createElement('div');
    outside.innerHTML = '<p>outside text</p>';
    document.body.appendChild(outside);

    const insideNode = container.querySelector('p')!.firstChild as Text;
    const outsideNode = outside.querySelector('p')!.firstChild as Text;
    // Range from inside-container node to outside-container node.
    const range = document.createRange();
    range.setStart(insideNode, 0);
    range.setEnd(outsideNode, 5);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    expect(getSelectionWithin(container)).toBe('');
  });
});
