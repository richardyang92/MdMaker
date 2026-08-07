import React, { useState, useRef, useEffect } from 'react';
import type { AgentTurn } from '../../hooks/useAgentChat';
import { AgentEventItem } from './AgentEventItem';

interface AgentPanelProps {
  turns: AgentTurn[];
  isRunning: boolean;
  error: string | null;
  /**
   * Submit a directive. The optional `selection` carries any document text the
   * user attached as context for this turn (passed through to the backend as
   * the agent request's `selection` field).
   */
  onSend: (message: string, selection?: string) => void;
  onStop: () => void;
  /** Document text attached as context for the next send, or null if none. */
  attachedContext?: string | null;
  /** Drop the currently attached context (× on the chip). */
  onClearContext?: () => void;
}

/** Agent 交互面板：用户消息气泡 + 活动流时间线 + 输入框。 */
export const AgentPanel: React.FC<AgentPanelProps> = ({
  turns,
  isRunning,
  error,
  onSend,
  onStop,
  attachedContext,
  onClearContext,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新事件时自动滚到底部
  useEffect(() => {
    const el = scrollRef.current;
    // Guard for non-browser/limited-DOM environments (e.g. jsdom): scrollTo
    // may be missing. Optional chaining alone doesn't suffice because the
    // property can exist as `undefined`-typed on the prototype.
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [turns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    onSend(trimmed, attachedContext ?? undefined);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 事件流区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {turns.length === 0 && (
          <div className="mt-8 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            告诉 Agent 你想对文档做什么，例如「在结尾加一段总结」。
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="mb-4">
            {/* 用户消息气泡 */}
            <div className="flex gap-2 mb-2 justify-end">
              <div className="flex flex-col items-end max-w-[85%]">
                <div
                  className="px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-text)',
                    borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  {turn.userMessage}
                </div>
                {/* 历史回显：该轮附带过的文档选区上下文（只读，不可移除） */}
                {turn.selection && (
                  <span
                    className="mt-1 px-2 py-0.5 text-[10px] truncate"
                    title={turn.selection}
                    style={{
                      color: 'var(--text-tertiary)',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      maxWidth: '100%',
                    }}
                  >
                    📎 引用选区 · {turn.selection.length}字
                  </span>
                )}
              </div>
            </div>
            {/* Agent 活动流（时间线） */}
            <div className="codeact-timeline">
              {turn.events.map((evt, i) => (
                <AgentEventItem key={`${turn.id}-${i}`} event={evt} />
              ))}
              {turn.status === 'streaming' && (
                <div className="px-2 py-0.5 text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>
                  …
                </div>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="mt-2 text-xs rounded-md px-2 py-1" style={{ color: 'var(--codeact-failed-text, #dc2626)' }}>
            错误: {error}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <form
        onSubmit={handleSubmit}
        className="border-t p-2 flex flex-col gap-2"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {/* 附加的文档选区上下文 chip */}
        {attachedContext && (
          <div
            className="flex items-center gap-2 px-2 py-1 text-xs"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span className="truncate" title={attachedContext}>
              ✓ 引用选区 · {attachedContext.length}字
            </span>
            <button
              type="button"
              onClick={onClearContext}
              className="ml-auto shrink-0 transition-all duration-fast hover-lift"
              aria-label="移除上下文"
              style={{ color: 'var(--text-tertiary)' }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="对 Agent 下指令…"
            className="flex-1 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
            }}
          />
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="px-3 py-2 text-sm font-medium rounded-md transition-all duration-fast hover-lift"
              style={{ background: 'var(--codeact-failed-text, #dc2626)', color: 'white', borderRadius: 'var(--radius-md)' }}
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              className="px-3 py-2 text-sm font-medium rounded-md transition-all duration-fast hover-lift shadow-sm hover:shadow-md"
              style={{
                background: 'linear-gradient(135deg, var(--ai-accent), var(--ai-hover))',
                color: 'white',
                borderRadius: 'var(--radius-md)',
              }}
            >
              发送
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
