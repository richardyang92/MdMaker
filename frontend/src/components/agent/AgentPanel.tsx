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

/** Main agent interaction surface: event stream + input + stop button. */
export const AgentPanel: React.FC<AgentPanelProps> = ({ turns, isRunning, error, onSend, onStop }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
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
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {turns.length === 0 && (
          <div className="mt-8 text-center text-sm text-slate-400">
            告诉 Agent 你想对文档做什么，例如「在结尾加一段总结」。
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="mb-4">
            {turn.events.map((evt, i) => (
              <AgentEventItem key={`${turn.id}-${i}`} event={evt} />
            ))}
            {turn.status === 'streaming' && (
              <div className="ml-1 text-xs text-slate-400">…</div>
            )}
          </div>
        ))}
        {error && <div className="mt-2 text-sm text-red-600">错误: {error}</div>}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-2 dark:border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="对 Agent 下指令…"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="rounded bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              发送
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
