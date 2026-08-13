import React from 'react';

export interface SelectionAnchor {
  /** Viewport-relative coordinates (px) the button floats above. */
  top: number;
  left: number;
}

interface AddToContextButtonProps {
  /** Currently highlighted text; null/empty hides the button. */
  pendingSelection: string | null;
  /** Where to anchor the floating button; null hides the button. */
  anchor: SelectionAnchor | null;
  /** Invoked with the selected text when the user clicks "add to context". */
  onAdd: (text: string) => void;
}

/**
 * Floating "＋ 加入上下文" affordance that appears over a highlighted document
 * selection. Visibility is fully controlled by the parent (via
 * `pendingSelection` + `anchor`) so the parent owns selection lifecycle — the
 * button itself is presentational.
 *
 * Rendered inside a `position: fixed` container so it can use viewport coords
 * from `Range.getBoundingClientRect()` directly, regardless of how the document
 * preview itself is scrolled/positioned.
 */
export const AddToContextButton: React.FC<AddToContextButtonProps> = ({
  pendingSelection,
  anchor,
  onAdd,
}) => {
  const text = pendingSelection?.trim() ?? '';
  if (!text || !anchor) return null;

  return (
    <button
      type="button"
      onClick={() => onAdd(text)}
      className="fixed z-50 px-2 py-1 text-xs font-medium shadow-md transition-all duration-fast hover-lift"
      style={{
        top: anchor.top,
        left: anchor.left,
        transform: 'translateY(-100%)',
        backgroundColor: 'var(--accent-primary)',
        color: 'var(--accent-text)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        whiteSpace: 'nowrap',
      }}
      title="将选中范围对应的 Markdown 源文本加入聊天上下文"
    >
      ＋ 加入上下文 · {text.length}字
    </button>
  );
};
