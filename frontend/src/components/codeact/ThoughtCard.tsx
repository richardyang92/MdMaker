/**
 * ThoughtCard Component
 * Displays AI thinking process in a collapsible card (default collapsed)
 */

import React from 'react';

export interface ThoughtCardProps {
  content: string;
  status?: 'streaming' | 'complete';
  version?: string;
}

export const ThoughtCard: React.FC<ThoughtCardProps> = ({
  content,
  status = 'complete',
  version
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const isThinking = status === 'streaming';

  return (
    <details
      className="codeact-thought-card mb-3 rounded-lg overflow-hidden codeact-card"
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary
        className="flex items-center gap-2 px-3 py-2 cursor-pointer list-none"
        style={{
          border: '1px solid var(--codeact-thought-border)',
          backgroundColor: 'var(--codeact-thought-bg)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <span className="text-base">💭</span>
        <span className="text-sm font-medium" style={{ color: 'var(--ai-accent)' }}>
          THOUGHT
        </span>
        {version && (
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: 'var(--ai-accent)' }}>
            v{version}
          </span>
        )}
        {isThinking && (
          <span className="ml-auto flex items-center gap-1.5 text-xs animate-pulse"
            style={{ color: 'var(--ai-accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            思考中...
          </span>
        )}
        <svg
          className="w-3.5 h-3.5 ml-auto transition-transform duration-fast"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </summary>

      {/* 思考内容 - 展开时显示 */}
      <div
        className="p-3 text-sm leading-relaxed whitespace-pre-wrap animate-thought-expand"
        style={{
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--ai-light)',
          borderTop: '1px solid rgba(139, 92, 246, 0.1)'
        }}
      >
        {content}
        {isThinking && (
          <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse" />
        )}
      </div>
    </details>
  );
};

export default ThoughtCard;
