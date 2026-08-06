import { useMemo } from 'react';
import { marked } from 'marked';
import katex from 'katex';

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

interface MarkdownPreviewProps {
  /** 待渲染的 Markdown 源文本。 */
  content: string;
  /** 可选的额外类名（追加到滚动容器）。 */
  className?: string;
}

/**
 * 左栏渲染视图：把 Markdown 源文本渲染为带 KaTeX 公式的 HTML，
 * 视觉与原"实时预览"区保持一致（`.prose` + 卡片样式）。
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className }) => {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className={`flex-1 overflow-y-auto p-6 preview-scrollbar-hide ${className ?? ''}`}
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="prose prose-sm max-w-none">
        <div
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
    </div>
  );
};
