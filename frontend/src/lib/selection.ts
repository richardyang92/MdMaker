/**
 * Read the current DOM text selection and return it only when it lies entirely
 * within `container`. Used by the document preview to turn a user's highlighted
 * paragraph into chat context — without leaking selections made elsewhere in
 * the UI (e.g. inputs in the Agent panel) into the capture.
 *
 * `getSelectionRangeWithin` returns the raw DOM Range (or null); callers that
 * render with a source map pass it to `resolveRange` to recover the original
 * Markdown source. `getSelectionWithin` is the legacy text-only variant.
 */

export function getSelectionRangeWithin(container: HTMLElement | null): Range | null {
  if (!container) return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  // Reject selections that extend outside the document preview container.
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  return range;
}

/** Selection text (rendered), trimmed; '' when there is no usable selection. */
export function getSelectionWithin(container: HTMLElement | null): string {
  const range = getSelectionRangeWithin(container);
  if (!range) return '';
  return range.toString().trim();
}
