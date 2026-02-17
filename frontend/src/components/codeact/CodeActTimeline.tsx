/**
 * CodeActTimeline Component
 * Container component that manages all CodeAct stage cards
 * Displays Thought, Action, Observation, and Response cards with timeline connection
 */

import React from 'react';
import { ACTION_CONFIG } from '../../services/types/codeact';
import type { ActionStage, ThoughtStage } from '../../services/types/codeact';
import { ThoughtCard } from './ThoughtCard';
import { ActionCard } from './ActionCard';
import { ObservationCard } from './ObservationCard';
import { ResponseCard } from './ResponseCard';
import { InlineModeSelector } from './InlineModeSelector';

export interface CodeActTimelineProps {
  // 消息内容
  thought?: ThoughtStage;
  actions?: ActionStage[];
  response?: string;

  // 流式状态
  isStreaming?: boolean;
  isStreamingComplete?: boolean;

  // 执行模式选择（内联）
  showModeSelector?: boolean;
  autoExecuteMode: 'auto' | 'manual' | null;
  onModeSelect: (mode: 'auto' | 'manual') => void;
  onModeConfirm: () => void;

  // Action操作回调
  onExecuteAction: (actionId: string) => void;
  onDismissAction: (actionId: string) => void;
  onCancelAction: (actionId: string) => void;
  onRetryAction: (actionId: string) => void;

  // 编辑器回调
  onViewInEditor?: () => void;
  onCopyResult?: () => void;
  onApplyResponse?: (content: string, mode: 'replace' | 'append' | 'insert' | 'replace_selection') => void;
  getDocumentContent?: () => string;
}

export const CodeActTimeline: React.FC<CodeActTimelineProps> = ({
  thought,
  actions = [],
  response,
  isStreaming = false,
  isStreamingComplete = true,
  showModeSelector = false,
  autoExecuteMode,
  onModeSelect,
  onModeConfirm,
  onExecuteAction,
  onDismissAction,
  onCancelAction,
  onRetryAction,
  onViewInEditor,
  onCopyResult
}) => {
  const [showRaw, setShowRaw] = React.useState(false);

  // 检查是否有各阶段内容
  const hasThought = !!thought && thought.content.length > 0;
  const hasActions = actions && actions.length > 0;
  const hasResponse = !!response && response.length > 0;

  // 没有任何内容时不渲染
  if (!hasThought && !hasActions && !hasResponse) {
    return null;
  }

  const isAutoMode = autoExecuteMode === 'auto';

  return (
    <div className="codeact-timeline">
      {/* 执行模式选择器 - 内联显示 */}
      {showModeSelector && (
        <InlineModeSelector
          currentMode={autoExecuteMode}
          onModeSelect={onModeSelect}
          onConfirm={onModeConfirm}
        />
      )}

      {/* 响应卡片 - 放在顶部，有ACTION/OBSERVATION时默认折叠 */}
      {hasResponse && (
        <ResponseCard
          content={response}
          isStreaming={isStreaming}
          isStreamingComplete={isStreamingComplete}
          showRaw={showRaw}
          onToggleRaw={() => setShowRaw(!showRaw)}
          defaultCollapsed={hasActions}
        />
      )}

      {/* 思考卡片 */}
      {hasThought && (
        <ThoughtCard
          content={thought.content}
          status={thought.status}
          version={thought.version}
        />
      )}

      {/* 动作卡片 */}
      {hasActions && actions.map((action, index) => {
        // 获取动作配置
        const config = ACTION_CONFIG[action.name] || {
          displayName: action.name,
          icon: '⚙️',
          description: '',
          category: 'replace' as const
        };

        const enrichedAction: ActionStage = {
          ...action,
          displayName: config.displayName,
          icon: config.icon
        };

        // 计算队列位置（从1开始）
        const queuePosition = index + 1;

        return (
          <ActionCard
            key={action.id}
            action={enrichedAction}
            autoExecuteMode={isAutoMode}
            queuePosition={queuePosition}
            onExecute={() => onExecuteAction(action.id)}
            onDismiss={() => onDismissAction(action.id)}
            onCancel={() => onCancelAction(action.id)}
            onRetry={() => onRetryAction(action.id)}
          />
        );
      })}

      {/* 观察卡片 - 显示已成功执行的action的结果 */}
      {hasActions && actions.filter(a => a.result).map(action => (
        <ObservationCard
          key={`observation-${action.id}`}
          success={action.result!.success}
          message={action.result!.message}
          timestamp={action.timestamp}
          data={action.result!.data}
          onViewInEditor={onViewInEditor}
          onCopyResult={onCopyResult}
        />
      ))}
    </div>
  );
};

export default CodeActTimeline;
