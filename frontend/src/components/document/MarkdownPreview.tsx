import { forwardRef, useMemo, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { useDocumentSelection } from '../../hooks/useDocumentSelection';
import { AddToContextButton, type SelectionAnchor } from './AddToContextButton';
import {
  renderMarkdownWithSourceMap,
  type SourceMappedRender,
} from '../../lib/markdownSourceMap';

export interface MarkdownPreviewHandle {
  /** The scrollable element holding the rendered HTML. */
  contentEl: HTMLDivElement | null;
}

interface MarkdownPreviewProps {
  /** 待渲染的 Markdown 源文本。 */
  content: string;
  /** 可选的额外类名（追加到滚动容器）。 */
  className?: string;
  /**
   * 用户在渲染稿中选中文字并点击「加入上下文」后触发，传入选中范围对应的
   * **原始 Markdown 源文本**（含 `#`、列表标记、表格管道符、公式源码等）。
   * 不传则不启用「选区加入上下文」交互。
   */
  onAddContext?: (text: string) => void;
}

/**
 * 左栏渲染视图：把 Markdown 源文本渲染为带 KaTeX 公式的 HTML，
 * 视觉与原"实时预览"区保持一致（`.prose` + 卡片样式）。
 *
 * 同时承载「选中文本 → 加入聊天上下文」交互：内部追踪落在内容区内的
 * 文本选区，并借助源映射（data-mdx 注解）把 DOM 选区还原为原始 Markdown
 * 源文本，而不是渲染后的网页文本。选区坐标在 mouseup 时从当前 Range 的
 * 视口矩形读取，确保按钮跟随可见选区。
 */
export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  ({ content, className, onAddContext }, ref) => {
    const rendered: SourceMappedRender = useMemo(() => renderMarkdownWithSourceMap(content), [content]);
    const contentRef = useRef<HTMLDivElement>(null);
    // Keep the latest source-map resolver available to the selection listener
    // without re-subscribing on every content change.
    const renderedRef = useRef(rendered);
    renderedRef.current = rendered;

    const resolveRange = useCallback((range: Range) => {
      // The listener only fires while the element is mounted, so the ref is set.
      const root = contentRef.current;
      return root ? renderedRef.current.resolveRange(root, range) : '';
    }, []);
    const { pendingSelection, clear } = useDocumentSelection(contentRef, resolveRange);
    // Button anchor in viewport coords; recomputed on mouseup so it tracks the
    // selection the user just finished dragging.
    const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);

    useImperativeHandle(ref, () => ({ contentEl: contentRef.current }), []);

    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setAnchor(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      // jsdom yields zero-size rects; only anchor when we have a real position.
      if (rect.width === 0 && rect.height === 0) {
        setAnchor(null);
        return;
      }
      // Float just above the top-left of the selection.
      setAnchor({ top: rect.top, left: rect.left });
    };

    const handleAdd = (text: string) => {
      onAddContext?.(text);
      // Consume the pending selection: clear both the chip source and the DOM
      // selection so the float doesn't linger after attaching.
      clear();
      setAnchor(null);
      window.getSelection()?.removeAllRanges();
    };

    return (
      <div
        className={`flex-1 overflow-y-auto p-6 preview-scrollbar-hide ${className ?? ''}`}
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="prose prose-sm max-w-none">
          <div
            ref={contentRef}
            onMouseUp={handleMouseUp}
            className="rounded-md shadow-sm p-6 min-h-full backdrop-blur-sm transition-all duration-200 hover:shadow-md"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
          </div>
        </div>
        {onAddContext && (
          <AddToContextButton
            pendingSelection={pendingSelection}
            anchor={anchor}
            onAdd={handleAdd}
          />
        )}
      </div>
    );
  },
);

MarkdownPreview.displayName = 'MarkdownPreview';
