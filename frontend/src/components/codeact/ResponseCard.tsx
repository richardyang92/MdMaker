/**
 * ResponseCard Component
 * Displays the main AI response content with Markdown rendering
 * Separated from Action/Observation cards
 * Collapsible with default collapsed state
 */

import React from 'react';

export interface ResponseCardProps {
  content: string;
  isStreaming?: boolean;
  isStreamingComplete?: boolean;
  showRaw?: boolean;
  onToggleRaw?: () => void;
  defaultCollapsed?: boolean;
}

export const ResponseCard: React.FC<ResponseCardProps> = ({
  content,
  isStreaming = false,
  isStreamingComplete = true,
  showRaw = false,
  onToggleRaw,
  defaultCollapsed = true
}) => {
  const [isExpanded, setIsExpanded] = React.useState(!defaultCollapsed || (isStreaming && !isStreamingComplete));
  const contentRef = React.useRef<HTMLDivElement>(null);

  // 流式响应时自动展开，流式完成后根据defaultCollapsed决定是否折叠
  React.useEffect(() => {
    if (isStreaming && !isStreamingComplete) {
      // 流式中：展开
      setIsExpanded(true);
    } else if (isStreamingComplete && defaultCollapsed) {
      // 流式完成且需要折叠：折叠
      setIsExpanded(false);
    }
  }, [isStreaming, isStreamingComplete, defaultCollapsed]);

  // 流式更新时自动滚动到底部
  React.useEffect(() => {
    if (isStreaming && !isStreamingComplete && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming, isStreamingComplete]);

  // 渲染Markdown内容
  const renderMarkdown = (text: string) => {
    return text
      .replace(/^### (.*$)/gm, '<span style="color: var(--ai-accent); font-weight: 600;">### $1</span>')
      .replace(/^## (.*$)/gm, '<span style="color: var(--ai-accent); font-weight: 600;">## $1</span>')
      .replace(/^# (.*$)/gm, '<span style="color: var(--ai-accent); font-weight: 700;"># $1</span>')
      .replace(/^(\s*)([-*]) (\[x\])/gim, '$1<span style="color: #10b981;">✓</span>')
      .replace(/^(\s*)([-*]) (\[ \])/gim, '$1<span style="color: var(--text-tertiary);">□</span>')
      .replace(/^(\s*)([-*]) /gim, '$1<span style="color: var(--accent-primary);">•</span> ')
      .replace(/^\d+\. /gm, '<span style="color: var(--accent-primary);">$&</span>')
      .replace(/^\> /gm, '<span style="color: var(--text-secondary); font-style: italic;">› </span>')
      .replace(/\$\$([\s\S]*?)\$\$/g, '<span style="background: var(--accent-light); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono);">$$\n$1\n$$</span>')
      .replace(/\$([^$]+)\$/g, '<span style="background: var(--accent-light); padding: 2px 4px; border-radius: 3px; font-family: var(--font-mono); font-style: italic;">$$1</span>')
      .replace(/`([^`]+)`/g, '<span style="background: var(--bg-secondary); padding: 2px 4px; border-radius: 3px; font-family: var(--font-mono);">`$1`</span>')
      .replace(/```(\w*)([\s\S]*?)```/g, '<pre style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0;"><code>``$2```</code></pre>');
  };

  // 内容预览（折叠时显示）
  const getPreviewText = () => {
    const firstLine = content.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  };

  return (
    <div
      className="codeact-response-card mb-3 rounded-lg codeact-card"
      style={{
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}
    >
      <details
        open={isExpanded}
        onToggle={(e) => setIsExpanded(e.currentTarget.open)}
      >
        <summary
          className="flex items-center justify-between px-3 py-2 cursor-pointer list-none"
          style={{ borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              RESPONSE
            </span>
            {/* 折叠时显示预览 */}
            {!isExpanded && content && (
              <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                {getPreviewText()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 流式指示器 */}
            {isStreaming && !isStreamingComplete && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-ping"
                style={{ backgroundColor: 'var(--ai-accent)' }}
              />
            )}
            {onToggleRaw && isExpanded && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleRaw();
                }}
                className="p-1 rounded hover:bg-opacity-80 transition-all duration-fast"
                style={{ color: 'var(--text-tertiary)' }}
                title={showRaw ? '显示渲染' : '显示原始'}
              >
                {showRaw ? '👁️' : '📝'}
              </button>
            )}
            {/* 折叠指示器 */}
            <svg
              className="w-4 h-4 transition-transform duration-fast"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </summary>

        {/* 内容区 */}
        <div ref={contentRef} className="p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {showRaw ? (
            <pre
              className="text-xs p-3 rounded-lg font-mono overflow-x-auto whitespace-pre-wrap"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)'
              }}
            >
              {content}
            </pre>
          ) : (
            <>
              <div
                className="p-3 rounded-lg whitespace-pre-wrap overflow-x-auto"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px dashed var(--border-color)'
                }}
              >
                <div
                  className="leading-relaxed"
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
                {/* 流式光标 */}
                {isStreaming && !isStreamingComplete && (
                  <span
                    className="inline-block w-1.5 h-4 ml-1 align-middle rounded-full animate-pulse"
                    style={{ backgroundColor: 'var(--ai-accent)' }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  );
};

export default ResponseCard;
