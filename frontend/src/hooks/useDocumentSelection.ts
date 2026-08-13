import { useCallback, useEffect, useState } from 'react';
import { getSelectionRangeWithin } from '../lib/selection';

export interface UseDocumentSelectionReturn {
  /** Currently selected text inside the container (source-resolved when a
   * resolver is provided), or null when none. */
  pendingSelection: string | null;
  /** Drop the current pending selection (does not touch the DOM selection). */
  clear: () => void;
}

/**
 * Track the user's text selection *inside* a single container element.
 *
 * Listens to the document-level `selectionchange` event (browsers don't bubble
 * it per-element) and filters via {@link getSelectionRangeWithin} so only
 * selections fully contained in `containerRef.current` surface as
 * `pendingSelection`.
 *
 * When `resolve` is provided it maps the DOM Range back to the original
 * Markdown source (see `lib/markdownSourceMap`), so the pending selection
 * carries raw source syntax; otherwise it falls back to the rendered text.
 */
export function useDocumentSelection(
  containerRef: React.RefObject<HTMLElement>,
  resolve?: (range: Range) => string,
): UseDocumentSelectionReturn {
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const range = getSelectionRangeWithin(containerRef.current);
      if (!range) {
        setPendingSelection(null);
        return;
      }
      const text = (resolve ? resolve(range) : range.toString()).trim();
      setPendingSelection(text.length > 0 ? text : null);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [containerRef, resolve]);

  const clear = useCallback(() => setPendingSelection(null), []);

  return { pendingSelection, clear };
}
