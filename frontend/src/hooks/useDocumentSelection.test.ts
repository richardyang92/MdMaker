import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentSelection } from './useDocumentSelection';

/**
 * Build a host element structure: a watched container (where the ref points)
 * with paragraph text inside, plus an unrelated "outside" element. Both are
 * appended to body so window.getSelection() can reach them.
 */
function setupDom() {
  document.body.innerHTML = '';
  const container = document.createElement('div');
  container.innerHTML = '<p>hello inside world</p>';
  document.body.appendChild(container);

  const outside = document.createElement('div');
  outside.innerHTML = '<p>outside text</p>';
  document.body.appendChild(outside);

  return { container, outside };
}

/** Set a DOM Range over [start, end) in `node`'s text and fire selectionchange. */
function setSelectionAndNotify(node: Text, start: number, end: number): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

/** Clear the document selection and notify listeners. */
function clearSelectionAndNotify(): void {
  window.getSelection()?.removeAllRanges();
  document.dispatchEvent(new Event('selectionchange'));
}

describe('useDocumentSelection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  it('reports null when there is no selection on mount', () => {
    const { container } = setupDom();
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSelection(ref));
    expect(result.current.pendingSelection).toBeNull();
  });

  it('reports the selected text when a selection is made inside the container', () => {
    const { container } = setupDom();
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSelection(ref));

    const insideNode = container.querySelector('p')!.firstChild as Text;
    act(() => setSelectionAndNotify(insideNode, 6, 12)); // "inside"
    expect(result.current.pendingSelection).toBe('inside');
  });

  it('reports null when a selection is made outside the container', () => {
    const { container, outside } = setupDom();
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSelection(ref));

    const outsideNode = outside.querySelector('p')!.firstChild as Text;
    act(() => setSelectionAndNotify(outsideNode, 0, 7)); // "outside"
    expect(result.current.pendingSelection).toBeNull();
  });

  it('clear() resets pendingSelection to null', () => {
    const { container } = setupDom();
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSelection(ref));

    const insideNode = container.querySelector('p')!.firstChild as Text;
    act(() => setSelectionAndNotify(insideNode, 0, 5)); // "hello"
    expect(result.current.pendingSelection).toBe('hello');

    act(() => result.current.clear());
    expect(result.current.pendingSelection).toBeNull();
  });

  it('resets to null when an existing selection is cleared', () => {
    const { container } = setupDom();
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSelection(ref));

    const insideNode = container.querySelector('p')!.firstChild as Text;
    act(() => setSelectionAndNotify(insideNode, 0, 5));
    expect(result.current.pendingSelection).toBe('hello');

    act(() => clearSelectionAndNotify());
    expect(result.current.pendingSelection).toBeNull();
  });
});
