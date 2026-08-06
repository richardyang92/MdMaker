import React, { useState } from 'react';
import type { AgentEvent } from '../../services/types/agent';
import { getToolDisplay } from './toolConfig';

interface AgentEventItemProps {
  event: AgentEvent;
}

/** 渲染单个 agent 事件为一行（活动流风格，CSS 变量配色，支持三主题）。 */
export const AgentEventItem: React.FC<AgentEventItemProps> = ({ event }) => {
  const [thoughtOpen, setThoughtOpen] = useState(false);

  switch (event.type) {
    case 'thought':
      // 思考：默认折叠，单行摘要，点击展开全文
      return (
        <button
          type="button"
          onClick={() => setThoughtOpen((v) => !v)}
          className="w-full text-left rounded-md px-2 py-1 text-xs transition-all duration-fast hover-lift"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <span className="inline-flex items-center gap-1">
            <svg
              className={`w-3 h-3 transition-transform duration-fast ${thoughtOpen ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>思考</span>
          </span>
          {thoughtOpen ? (
            <div className="mt-1 whitespace-pre-wrap pl-4" style={{ color: 'var(--text-secondary)' }}>
              {event.content}
            </div>
          ) : (
            <span className="ml-1" style={{ color: 'var(--text-tertiary)' }}>
              {event.content.split('\n')[0].slice(0, 50)}
              {event.content.length > 50 ? '…' : ''}
            </span>
          )}
        </button>
      );

    case 'tool_result':
      // 工具结果：单行紧凑，图标 + 工具名 + 状态
      return <ToolResultRow event={event} />;

    case 'document_patch':
      // 文档更新：琥珀色高亮单行
      return (
        <div
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
          style={{ color: 'var(--codeact-executing-text, #b45309)' }}
        >
          <span>✎</span>
          <span>文档已更新</span>
          <span style={{ color: 'var(--text-tertiary)' }}>· v{event.version}</span>
        </div>
      );

    case 'final':
      // 总结：加粗突出，作为 turn 的收尾
      return (
        <div
          className="mt-1 rounded-md px-2 py-1.5 text-xs font-medium"
          style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          {event.content}
        </div>
      );

    case 'stopped':
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span>■</span>
          <span>已停止</span>
        </div>
      );

    case 'error':
      return (
        <div
          className="flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs"
          style={{ color: 'var(--codeact-failed-text, #dc2626)' }}
        >
          <span>✗</span>
          <span className="flex-1">{event.error}</span>
        </div>
      );

    case 'done':
      return null;

    default:
      return null;
  }
};

/** 工具结果行：图标 + 工具中文名 + ✓/✗ + 结果摘要，单行紧凑。 */
const ToolResultRow: React.FC<{ event: { type: 'tool_result'; name: string; ok: boolean; summary: string } }> = ({ event }) => {
  const display = getToolDisplay(event.name);
  const ok = event.ok;
  const color = ok
    ? 'var(--codeact-success-text, #16a34a)'
    : 'var(--codeact-failed-text, #dc2626)';
  // 结果摘要截断，避免单行过长
  const summary = event.summary.split('\n')[0].slice(0, 60);

  return (
    <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      <span>{display.icon}</span>
      <span style={{ color: 'var(--text-primary)' }}>{display.label}</span>
      <span style={{ color }} title={event.summary}>
        {ok ? '✓' : '✗'} {summary}
        {event.summary.length > 60 ? '…' : ''}
      </span>
    </div>
  );
};
