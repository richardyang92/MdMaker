/**
 * Read the current text selection and return it only when it lies entirely
 * within `container`. Used by the document preview to turn a user's highlighted
 * paragraph into chat context — without leaking selections made elsewhere in
 * the UI (e.g. inputs in the Agent panel) into the capture.
 *
 * Returns the trimmed selection string, or '' when there is no usable selection,
 * when `container` is null, or when the selection straddles the container edge.
 */
export function getSelectionWithin(container: HTMLElement | null): string {
  if (!container) return '';

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return '';
  }

  const range = selection.getRangeAt(0);
  // Reject selections that extend outside the document preview container.
  if (!container.contains(range.commonAncestorContainer)) {
    return '';
  }

  return selection.toString().trim();
}
