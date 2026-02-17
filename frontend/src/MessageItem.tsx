/**
 * MessageItem Component - CodeAct Style
 * Displays messages with Thought-Action-Observation-Response structure
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { CodeActTimeline } from './components/codeact/CodeActTimeline';
import { useCodeActExecution } from './hooks/useCodeActExecution';
import { ACTION_CONFIG } from './services/types/codeact';
import type { ThoughtStage, ActionStage } from './services/types/codeact';

interface Message {
  role: string;
  content: string;
  id: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface MessageItemProps {
  message: Message;
  onApplyResponse: (content: string, mode: 'replace' | 'append' | 'insert' | 'replace_selection') => void;
  requestParams?: any;
  getDocumentContent?: () => string;
  onUndoFromMessage?: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onApplyResponse,
  requestParams: _requestParams,
  getDocumentContent = () => '',
  onUndoFromMessage
}) => {
  // CodeAct执行Hook
  const codeactExecution = useCodeActExecution();

  // 使用ref追踪已处理的action ID，避免重复添加
  const processedActionIds = useRef<Set<string>>(new Set());

  // 从解析的function_call创建ActionStage
  const createActionFromParsed = (parsed: any, messageId: string): ActionStage | null => {
    if (!parsed.name) return null;

    const config = ACTION_CONFIG[parsed.name];
    if (!config) return null;

    return {
      id: `${messageId}-action-${Date.now()}`,
      name: parsed.name,
      displayName: config.displayName,
      icon: config.icon,
      arguments: parsed.arguments || {},
      status: 'pending',
      timestamp: new Date()
    };
  };

  // 解析XML格式的function_call
  const parseXmlFunctionCall = (xmlContent: string, messageId: string): ActionStage | null => {
    const nameMatch = xmlContent.match(/<name>([\s\S]*?)<\/name>/);
    if (!nameMatch) return null;

    const name = nameMatch[1].trim();
    const config = ACTION_CONFIG[name];
    if (!config) return null;

    // 提取content
    const contentMatch = xmlContent.match(/<content>([\s\S]*?)<\/content>/);

    return {
      id: `${messageId}-action-${Date.now()}`,
      name,
      displayName: config.displayName,
      icon: config.icon,
      arguments: {
        content: contentMatch ? contentMatch[1].trim() : ''
      },
      status: 'pending',
      timestamp: new Date()
    };
  };

  // 解析消息内容为CodeAct结构
  const parseMessageToCodeAct = () => {
    // 1. 解析思考过程
    const thinkMatch = message.content.match(/<think(?:\s+version="(\d+\.\d+)")?>([\s\S]*?)<\/think>/);
    const thought: ThoughtStage | undefined = thinkMatch ? {
      content: thinkMatch[2].trim(),
      status: 'complete',
      version: thinkMatch[1]
    } : undefined;

    // 2. 解析function_call
    const functionCallMatch = message.content.match(/<function_call>([\s\S]*?)<\/function_call>/);
    let actions: ActionStage[] = [];

    if (functionCallMatch) {
      const functionCallContent = functionCallMatch[1].trim();

      // 尝试解析JSON格式
      if (functionCallContent.startsWith('{')) {
        try {
          const parsed = JSON.parse(functionCallContent);
          const action = createActionFromParsed(parsed, message.id);
          if (action) actions.push(action);
        } catch {
          // JSON解析失败，尝试XML格式
        }
      }

      // 尝试解析XML格式
      if (actions.length === 0) {
        const action = parseXmlFunctionCall(functionCallContent, message.id);
        if (action) actions.push(action);
      }
    }

    // 3. 提取响应内容（移除所有标记后的内容）
    let response = message.content
      .replace(/<think(?:\s+version="\d+\.\d+")?>[\s\S]*?<\/think>/, '')
      .replace(/<context>[\s\S]*?<\/context>/g, '')
      .replace(/<suggestion>[\s\S]*?<\/suggestion>/g, '')
      .replace(/<error>[\s\S]*?<\/error>/g, '')
      .replace(/<\/?function_call[^>]*>/g, '')
      .replace(/> \[选区引用\][\s\S]*?(?=\n\n|$)/g, '')
      .replace(/> \[光标位置上下文\][\s\S]*?(?=\n\n|$)/g, '')
      .replace(/> \[完整文档\][\s\S]*?(?=\n\n|$)/g, '')
      .trim();

    // 处理XML格式的function_call中的content
    const xmlFunctionCallMatch = message.content.match(/<function_call>([\s\S]*?)<\/function_call>/);
    if (xmlFunctionCallMatch) {
      const contentMatch = xmlFunctionCallMatch[1].match(/<content>([\s\S]*?)<\/content>/);
      if (contentMatch) {
        response = contentMatch[1].trim();
      }
    }

    return { thought, actions, response };
  };

  // 使用useMemo缓存解析结果
  const parsedCodeAct = useMemo(() => parseMessageToCodeAct(), [message.content]);

  const { thought, actions, response } = parsedCodeAct;

  // 当检测到function_call时，添加到执行队列
  useEffect(() => {
    if (actions.length > 0) {
      actions.forEach(action => {
        // 只添加未处理过的action
        if (!processedActionIds.current.has(action.id)) {
          codeactExecution.addToQueue(action);
          processedActionIds.current.add(action.id);
        }
      });

      // 如果尚未选择执行模式，显示对话框（只显示一次）
      if (!codeactExecution.autoExecuteState.mode && !codeactExecution.autoExecuteState.showChoiceDialog) {
        codeactExecution.setShowDialog(true);
      }
    }
  // 只在消息内容变化时触发，使用message.content作为依赖而不是actions数组
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.content]);

  // 处理对话框确认 - 触发自动执行
  const handleDialogConfirm = React.useCallback(async () => {
    await codeactExecution.confirmAndExecute({
      onApplyResponse,
      getDocumentContent
    });
  }, [codeactExecution, onApplyResponse, getDocumentContent]);

  // 检查是否是流式响应消息
  const isStreaming = message.id.startsWith('stream-');
  const isStreamingComplete = !isStreaming || (isStreaming && message.content.length > 0 && !message.content.endsWith('\n'));

  const isUser = message.role === 'user';

  // 用户消息的简单渲染
  if (isUser) {
    return (
      <div className="flex gap-2 mb-4 animate-message-enter group relative">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm"
          style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))',
            border: '2px solid var(--border-color)'
          }}
        >
          U
        </div>
        <div className="relative max-w-[600px]">
          <div
            className="px-4 py-2 rounded-2xl"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {message.content}
          </div>

          {/* 撤销图标 - 悬停时显示在右上角 */}
          {onUndoFromMessage && (
            <button
              onClick={() => onUndoFromMessage(message.id)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full
                         flex items-center justify-center
                         opacity-0 group-hover:opacity-100
                         transition-opacity duration-200
                         bg-white dark:bg-gray-800
                         shadow-md border border-gray-200 dark:border-gray-600
                         hover:bg-gray-100 dark:hover:bg-gray-700
                         z-10"
              title="撤回此消息及之后的对话"
            >
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // AI消息 - 使用CodeAct结构
  return (
    <div className="flex gap-2 mb-4 animate-message-enter">
      {/* AI头像 */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
        style={{
          background: 'linear-gradient(135deg, var(--ai-accent), var(--ai-hover))',
          border: '2px solid var(--border-color)',
          fontSize: '18px'
        }}
      >
        🤖
      </div>

      {/* CodeAct时间线 */}
      <CodeActTimeline
        thought={thought}
        actions={codeactExecution.executeQueue}
        response={response}
        isStreaming={isStreaming}
        isStreamingComplete={isStreamingComplete}
        showModeSelector={codeactExecution.autoExecuteState.showChoiceDialog}
        autoExecuteMode={codeactExecution.autoExecuteState.mode}
        onModeSelect={codeactExecution.setAutoExecuteMode}
        onModeConfirm={handleDialogConfirm}
        onExecuteAction={(actionId) => {
          const action = codeactExecution.executeQueue.find(a => a.id === actionId);
          if (action) {
            codeactExecution.executeAction({
              action,
              onApplyResponse,
              getDocumentContent
            });
          }
        }}
        onDismissAction={(actionId) => {
          codeactExecution.cancelExecution(actionId);
        }}
        onCancelAction={(actionId) => {
          codeactExecution.cancelExecution(actionId);
        }}
        onRetryAction={(actionId) => {
          const action = codeactExecution.executeQueue.find(a => a.id === actionId);
          if (action) {
            codeactExecution.retryAction({
              action,
              onApplyResponse,
              getDocumentContent
            });
          }
        }}
        onViewInEditor={() => {
          // 滚动到编辑器或高亮更改
        }}
        onCopyResult={() => {
          // 复制结果到剪贴板
        }}
      />
    </div>
  );
};

export default MessageItem;
