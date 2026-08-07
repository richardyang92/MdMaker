import React from 'react';
import { MarkdownPreview } from './MarkdownPreview';

interface DocumentViewProps {
  /** 待渲染的 Markdown 源文本。 */
  content: string;
  /**
   * 用户在渲染稿中选中文字并点击「加入上下文」后触发。
   * 传入则启用选区加入上下文交互；不传则纯展示。
   */
  onAddContext?: (text: string) => void;
}

/**
 * 左栏：渲染后的文档视图。
 *
 * 顶部为栏标题，主体是可滚动的 Markdown 渲染区。
 * 取代了原"编辑器 + 预览"双栏中的两个区域——现在文档以渲染形态呈现，
 * 文本修改统一通过右栏 Agent 完成。
 */
export const DocumentView: React.FC<DocumentViewProps> = ({ content, onAddContext }) => {
  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <div
        className="px-6 py-4 border-b glass-effect"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <h2 className="text-base font-semibold flex items-center" style={{ color: 'var(--text-secondary)' }}>
          <svg
            className="w-5 h-5 mr-2"
            style={{ color: 'var(--accent-primary)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          文档
        </h2>
      </div>
      <MarkdownPreview content={content} onAddContext={onAddContext} />
    </div>
  );
};
