import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { AgentTurn } from '../../hooks/useAgentChat';
import type { ContextItem } from '../../services/types/agent';
import {
  applyMention,
  detectMention,
  filterMentionOptions,
  type MentionOption,
  type MentionState,
} from '../../lib/mention';
import { AgentEventItem } from './AgentEventItem';

interface AgentPanelProps {
  turns: AgentTurn[];
  isRunning: boolean;
  error: string | null;
  /**
   * Submit a directive. Attached contexts ride along with the message; the
   * backend expands any `@<ref>` mentions typed in the message.
   */
  onSend: (message: string) => void;
  onStop: () => void;
  /** Document snippets attached as context; referenced via `@<ref>` in the input. */
  attachedContexts: ContextItem[];
  /** Drop an attached context (× on its chip). */
  onClearContext: (ref: string) => void;
}

/** Agent 交互面板：用户消息气泡 + 活动流时间线 + 输入框（支持 @引用）。 */
export const AgentPanel: React.FC<AgentPanelProps> = ({
  turns,
  isRunning,
  error,
  onSend,
  onStop,
  attachedContexts,
  onClearContext,
}) => {
  const [input, setInput] = useState('');
  const [mention, setMention] = useState<MentionState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // 输入时自动增高（1–4 行）
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
    }
  }, [input]);

  // @引用 候选：内建 @document + 已附加的上下文片段
  const mentionOptions: MentionOption[] = useMemo(
    () => [
      { ref: 'document', label: '文档全文' },
      ...attachedContexts.map((c) => ({ ref: c.ref, label: c.label })),
    ],
    [attachedContexts],
  );
  const filteredOptions = useMemo(
    () => (mention ? filterMentionOptions(mentionOptions, mention.query) : []),
    [mention, mentionOptions],
  );

  const closeMention = () => {
    setMention(null);
    setActiveIndex(0);
  };

  const insertMention = (option: MentionOption) => {
    if (!mention) return;
    const el = textareaRef.current;
    const { value, caret: nextCaret } = applyMention(input, mention, option.ref);
    setInput(value);
    closeMention();
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = e.target;
    setInput(value);
    const next = detectMention(value, selectionStart ?? value.length);
    setMention(next);
    setActiveIndex(0);
  };

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    onSend(trimmed);
    setInput('');
    closeMention();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && filteredOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filteredOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filteredOptions.length) % filteredOptions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredOptions[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 事件流区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {turns.length === 0 && (
          <div className="mt-8 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            告诉 Agent 你想对文档做什么，例如「在结尾加一段总结」。
            <br />
            选中文档文字加入上下文后，可在输入框用 @引用它们。
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
                {/* 历史回显：该轮附带过的文档上下文片段（只读，不可移除） */}
                {(turn.contexts ?? []).map((ctx) => (
                  <span
                    key={ctx.ref}
                    className="mt-1 px-2 py-0.5 text-[10px] truncate"
                    title={ctx.content}
                    style={{
                      color: 'var(--text-tertiary)',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      maxWidth: '100%',
                    }}
                  >
                    📎 @{ctx.ref} · {ctx.label}
                  </span>
                ))}
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
      <div
        className="border-t p-2 flex flex-col gap-2"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {/* 已附加的文档上下文片段 chips（可多个，逐个移除） */}
        {attachedContexts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {attachedContexts.map((ctx) => (
              <span
                key={ctx.ref}
                className="flex items-center gap-1 px-2 py-0.5 text-xs"
                title={ctx.content}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span className="max-w-[16rem] truncate">
                  @{ctx.ref} · {ctx.label}
                </span>
                <button
                  type="button"
                  onClick={() => onClearContext(ctx.ref)}
                  className="shrink-0 transition-all duration-fast hover-lift"
                  aria-label={`移除上下文 ${ctx.ref}`}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          {/* `flex items-end` on the wrapper turns the <textarea> into a flex
              item so it no longer rides an inline line-box (which left a ~6px
              descender gap and pushed the input off the button's baseline). */}
          <div className="relative flex flex-1 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={closeMention}
              placeholder="对 Agent 下指令…（输入 @ 引用上下文）"
              rows={1}
              className="w-full resize-none rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
              }}
            />
            {/* @引用 候选列表 */}
            {mention && filteredOptions.length > 0 && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-md py-1 shadow-md z-20"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {filteredOptions.map((option, i) => (
                  <button
                    key={option.ref}
                    type="button"
                    onMouseDown={(e) => {
                      // mousedown 先于 textarea blur 执行，确保点击能插入引用。
                      e.preventDefault();
                      insertMention(option);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                      i === activeIndex ? '' : ''
                    }`}
                    style={{
                      backgroundColor: i === activeIndex ? 'var(--bg-tertiary)' : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span className="font-mono" style={{ color: 'var(--accent-primary)' }}>
                      @{option.ref}
                    </span>
                    <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="px-3 py-2 text-sm leading-6 font-medium rounded-md transition-all duration-fast hover-lift"
              style={{ background: 'var(--codeact-failed-text, #dc2626)', color: 'white', borderRadius: 'var(--radius-md)' }}
            >
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              className="px-3 py-2 text-sm leading-6 font-medium rounded-md transition-all duration-fast hover-lift shadow-sm hover:shadow-md"
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
      </div>
    </div>
  );
};
