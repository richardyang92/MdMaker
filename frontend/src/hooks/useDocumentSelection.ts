import { useCallback, useEffect, useState } from 'react';
import { getSelectionWithin } from '../lib/selection';

export interface UseDocumentSelectionReturn {
  /** Currently highlighted text inside the container, or null when none. */
  pendingSelection: string | null;
  /** Drop the current pending selection (does not touch the DOM selection). */
  clear: () => void;
}

/**
 * Track the user's text selection *inside* a single container element.
 *
 * Listens to the document-level `selectionchange` event (browsers don't bubble
 * it per-element) and filters via {@link getSelectionWithin} so only selections
 * fully contained in `containerRef.current` surface as `pendingSelection`.
 *
 * Designed for the read-only rendered document preview: highlight a paragraph →
 * `pendingSelection` updates → the caller shows an "Add to context" affordance.
 */
export function useDocumentSelection(
  containerRef: React.RefObject<HTMLElement>,
): UseDocumentSelectionReturn {
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const text = getSelectionWithin(containerRef.current);
      setPendingSelection(text.length > 0 ? text : null);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [containerRef]);

  const clear = useCallback(() => setPendingSelection(null), []);

  return { pendingSelection, clear };
}
