import React from 'react';
import { AgentPanel } from './AgentPanel';
import type { UseAgentChatReturn } from '../../hooks/useAgentChat';
import type { ContextItem } from '../../services/types/agent';

interface AgentSidebarProps {
  /** 来自 useAgentChat 的聚合状态与动作。 */
  agentChat: UseAgentChatReturn;
  /** 向 Agent 发送一条指令；附带的上下文由聊天框内的 @引用 决定。 */
  onSend: (message: string) => void;
  /** 建立会话（sessionId 为空时点击触发）。 */
  onEnsureSession: () => void;
  /** 收起右栏。 */
  onCollapse: () => void;
  /** 已附加的文档上下文片段（来自文档选区「加入上下文」），可多个并存。 */
  attachedContexts: ContextItem[];
  /** 移除指定引用名的上下文片段。 */
  onClearContext: (ref: string) => void;
}

/**
 * 右栏常驻的 Agent 侧边栏。
 *
 * 取代了原 fixed 浮层（底部气泡按钮 + 弹出面板），改为与文档同处一个 Grid
 * 的常驻栏：顶部条（建立会话 / 收起）+ AgentPanel 主体。不再使用 z-index 浮层。
 */
export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agentChat,
  onSend,
  onEnsureSession,
  onCollapse,
  attachedContexts,
  onClearContext,
}) => {
  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Agent
        </span>
        <div className="flex items-center gap-2">
          {!agentChat.sessionId && (
            <button
              onClick={onEnsureSession}
              className="rounded px-2 py-1 text-xs transition-all duration-fast hover-lift"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              建立会话
            </button>
          )}
          <button
            onClick={onCollapse}
            className="rounded p-1 transition-all duration-fast hover-lift"
            style={{ color: 'var(--text-tertiary)' }}
            title="收起 Agent"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <AgentPanel
          turns={agentChat.turns}
          isRunning={agentChat.isRunning}
          error={agentChat.error}
          onSend={onSend}
          onStop={agentChat.stop}
          attachedContexts={attachedContexts}
          onClearContext={onClearContext}
        />
      </div>
    </div>
  );
};
