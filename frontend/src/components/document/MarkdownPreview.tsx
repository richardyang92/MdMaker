import { forwardRef, useMemo, useImperativeHandle, useRef, useState } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import { useDocumentSelection } from '../../hooks/useDocumentSelection';
import { AddToContextButton, type SelectionAnchor } from './AddToContextButton';

/**
 * 将 Markdown 文本渲染为 HTML。
 *
 * 处理顺序与原 App.tsx 中的实现保持一致：先行内公式 `$...$`，再块级公式
 * `$$...$$`，最后交给 marked 解析剩余 Markdown 语法（GFM + 软换行）。
 * KaTeX 渲染失败时原样保留源文本。
 */
function renderMarkdown(text: string): string {
  let processedText = text;

  // 行内公式 $...$
  processedText = processedText.replace(/\$([^$\n]+)\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula, { displayMode: false });
    } catch {
      return match;
    }
  });

  // 块级公式 $$...$$
  processedText = processedText.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula, { displayMode: true });
    } catch {
      return match;
    }
  });

  marked.setOptions({ breaks: true, gfm: true });
  // marked.parse 的类型签名是 string | Promise<string>（异步选项打开时），
  // 这里未启用异步，实际始终返回 string，故断言为 string。
  return marked.parse(processedText) as string;
}

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
   * 用户在渲染稿中选中文字并点击「加入上下文」后触发，传入选中的纯文本。
   * 不传则不启用「选区加入上下文」交互。
   */
  onAddContext?: (text: string) => void;
}

/**
 * 左栏渲染视图：把 Markdown 源文本渲染为带 KaTeX 公式的 HTML，
 * 视觉与原"实时预览"区保持一致（`.prose` + 卡片样式）。
 *
 * 同时承载「选中文本 → 加入聊天上下文」交互：内部追踪落在内容区内的
 * 文本选区，并在选区上方浮出 `AddToContextButton`。选区坐标在 mouseup 时
 * 从当前 Range 的视口矩形读取，确保按钮跟随可见选区。
 */
export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  ({ content, className, onAddContext }, ref) => {
    const html = useMemo(() => renderMarkdown(content), [content]);
    const contentRef = useRef<HTMLDivElement>(null);
    const { pendingSelection, clear } = useDocumentSelection(contentRef);
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
            <div dangerouslySetInnerHTML={{ __html: html }} />
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
