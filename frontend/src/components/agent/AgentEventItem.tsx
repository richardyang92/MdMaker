import React, { useMemo, useState } from 'react';
import type { AgentEvent } from '../../services/types/agent';
import { getToolDisplay } from './toolConfig';
import { renderChatMarkdown } from '../../lib/chatMarkdown';

interface AgentEventItemProps {
  event: AgentEvent;
}

/** 渲染单个 agent 事件为一行（活动流风格，CSS 变量配色，支持三主题）。 */
export const AgentEventItem: React.FC<AgentEventItemProps> = ({ event }) => {
  const [thoughtOpen, setThoughtOpen] = useState(false);
  // final 事件内容按 Markdown 渲染（模型输出的总结/回复）。
  const finalHtml = useMemo(
    () => (event.type === 'final' ? renderChatMarkdown(event.content) : ''),
    [event],
  );

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

    case 'tool_call':
      // 工具调用：单行紧凑，图标 + 工具中文名，让用户看到 Agent 正在做什么。
      return <ToolCallRow event={event} />;

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
      // 总结：作为 turn 的收尾，按 Markdown 渲染（标题/列表/代码/公式/表格等）
      return (
        <div
          className="mt-1 rounded-md px-2.5 py-1.5 text-xs chat-markdown"
          style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-tertiary)' }}
          dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
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

/** 工具调用行：图标 + 工具中文名 + 参数摘要，单行紧凑。 */
const ToolCallRow: React.FC<{ event: { type: 'tool_call'; name: string; args: Record<string, unknown> } }> = ({ event }) => {
  const display = getToolDisplay(event.name);
  // 把参数拼成简短摘要（如 replace_document 会带很长的 text，截断即可）。
  const argSummary = Object.entries(event.args)
    .filter(([k]) => k !== 'text') // 写全文类工具的 text 太长，跳过
    .map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v.slice(0, 24)}"` : String(v)}`)
    .join(', ');
  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
      style={{ color: 'var(--text-tertiary)' }}
    >
      <span>{display.icon}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{display.label}</span>
      {argSummary && (
        <span className="truncate" style={{ color: 'var(--text-tertiary)' }}>
          {argSummary}
        </span>
      )}
    </div>
  );
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
