/**
 * ActionCard Component
 * Displays function call actions with status-driven UI
 * Supports queue display for auto-execute mode
 */

import React from 'react';
import { formatActionArgs, getStatusColors, getStatusIcon, getStatusText } from '../../services/types/codeact';
import type { ActionStage } from '../../services/types/codeact';

export interface ActionCardProps {
  action: ActionStage;
  autoExecuteMode: boolean;
  queuePosition?: number; // 在队列中的位置（从1开始）
  onExecute: () => void;
  onDismiss: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  autoExecuteMode,
  queuePosition,
  onExecute,
  onDismiss,
  onCancel,
  onRetry
}) => {
  // 手动模式下默认展开，自动模式下只在 executing 或 failed 时展开
  const [isExpanded, setIsExpanded] = React.useState(
    !autoExecuteMode || action.status === 'executing' || action.status === 'failed'
  );

  const statusColors = getStatusColors(action.status);

  const getActionBgColor = () => {
    if (action.status === 'executing') return 'var(--codeact-executing-bg)';
    if (action.status === 'success') return 'var(--codeact-success-bg)';
    if (action.status === 'failed') return 'var(--codeact-failed-bg)';
    return 'var(--codeact-pending-bg)';
  };

  const getActionTextColor = () => {
    return statusColors.text;
  };

  return (
    <div
      className="codeact-action-card mb-3 rounded-lg overflow-hidden codeact-card"
      style={{
        border: `1px solid ${statusColors.border}`,
        backgroundColor: 'var(--bg-secondary)',
        transition: 'all 0.2s ease'
      }}
    >
      <details
        open={isExpanded}
        onToggle={(e) => setIsExpanded(e.currentTarget.open)}
      >
        <summary
          className="flex items-center justify-between px-3 py-2 cursor-pointer list-none"
          style={{ backgroundColor: getActionBgColor() }}
        >
          {/* 左侧：图标和名称 */}
          <div className="flex items-center gap-2">
            <span className="text-base">{action.icon}</span>
            <span className="text-sm font-medium" style={{ color: getActionTextColor() }}>
              ACTION · {action.displayName}
            </span>
            {/* 自动模式下显示队列指示 */}
            {autoExecuteMode && action.status === 'pending' && queuePosition && queuePosition > 1 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--ai-light)', color: 'var(--ai-accent)' }}>
                队列中 #{queuePosition}
              </span>
            )}
          </div>

          {/* 右侧：状态和操作 */}
          <div className="flex items-center gap-2">
            {/* 状态指示器 */}
            <span
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                action.status === 'executing' ? 'animate-pulse' : ''
              }`}
              style={{
                backgroundColor: statusColors.bg,
                color: statusColors.text
              }}
            >
              {getStatusIcon(action.status)}
              {getStatusText(action.status)}
            </span>

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

        {/* 动作详情 */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
          {/* 参数预览 */}
          <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            参数：
          </div>
          <div
            className="p-2 rounded mb-3 font-mono text-xs overflow-x-auto"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)'
            }}
          >
            {formatActionArgs(action.arguments)}
          </div>

          {/* 操作按钮 - 根据模式和状态显示 */}
          <div className="flex items-center gap-2">
            {/* 自动模式下：pending状态显示"准备执行" */}
            {autoExecuteMode && action.status === 'pending' && (
              <span className="text-xs flex items-center gap-1.5"
                style={{ color: 'var(--ai-accent)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                等待执行...
              </span>
            )}

            {/* 手动模式下：pending状态显示执行按钮 */}
            {!autoExecuteMode && action.status === 'pending' && (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onExecute();
                  }}
                  className="px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white'
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  执行
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onDismiss();
                  }}
                  className="px-3 py-1.5 text-xs rounded-md"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                  忽略
                </button>
              </>
            )}

            {/* executing状态：显示取消按钮 */}
            {action.status === 'executing' && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onCancel();
                }}
                className="px-3 py-1.5 text-xs rounded-md"
                style={{ backgroundColor: '#fbbf24', color: 'white' }}
              >
                取消执行
              </button>
            )}

            {/* failed状态：显示重试按钮 */}
            {action.status === 'failed' && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onRetry();
                }}
                className="px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--ai-accent)', color: 'white' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                重试
              </button>
            )}
          </div>
        </div>
      </details>
    </div>
  );
};

export default ActionCard;
