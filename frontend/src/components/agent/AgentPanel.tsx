import React, { useState, useRef, useEffect } from 'react';
import type { AgentTurn } from '../../hooks/useAgentChat';
import { AgentEventItem } from './AgentEventItem';

interface AgentPanelProps {
  turns: AgentTurn[];
  isRunning: boolean;
  error: string | null;
  onSend: (message: string) => void;
  onStop: () => void;
}

/** Agent 交互面板：用户消息气泡 + 活动流时间线 + 输入框。 */
export const AgentPanel: React.FC<AgentPanelProps> = ({ turns, isRunning, error, onSend, onStop }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新事件时自动滚到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    onSend(trimmed);
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
              <div
                className="max-w-[85%] px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-text)',
                  borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                {turn.userMessage}
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
        className="border-t p-2 flex gap-2"
        style={{ borderColor: 'var(--border-color)' }}
      >
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
      </form>
    </div>
  );
};
