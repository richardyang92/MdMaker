/**
 * EmptyView Component
 * Displays a welcome message when there are no messages in the conversation
 */

import React from 'react';

export const EmptyView: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-[300px]">
      {/* AI Icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, var(--ai-accent), var(--ai-hover))',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <span className="text-3xl">🤖</span>
      </div>

      {/* Welcome Text */}
      <h3
        className="text-lg font-semibold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        你好，我是 AI 助手
      </h3>
      <p
        className="text-sm mb-4 max-w-[280px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        我可以帮助你编辑和优化 Markdown 文档，有任何问题随时问我！
      </p>

      {/* Quick Tips */}
      <div
        className="w-full max-w-[300px] rounded-lg p-3 text-left"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)'
        }}
      >
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
          快捷提示
        </p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--ai-accent)' }}>•</span>
            <span>选中文字后发送消息，可以针对选区操作</span>
          </li>
          <li className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--ai-accent)' }}>•</span>
            <span>使用 @selection 引用选中内容</span>
          </li>
          <li className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--ai-accent)' }}>•</span>
            <span>让 AI 帮你重写、润色或扩展文档</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default EmptyView;
