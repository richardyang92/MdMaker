/**
 * Hook for managing CodeAct style execution
 * Handles auto-execute mode, action queue, execution control, and undo functionality
 */

import { useCallback, useRef, useState } from 'react';
import type {
  ActionStage,
  ActionResult,
  AutoExecuteState
} from '../services/types/codeact';

export interface ExecuteActionParams {
  action: ActionStage;
  onApplyResponse: (content: string, mode: 'replace' | 'append' | 'insert' | 'replace_selection') => void;
  getDocumentContent: () => string;
}

// 用于 confirmAndExecute 的参数类型（不需要 action，因为会从队列中获取）
export interface ExecuteQueueParams {
  onApplyResponse: (content: string, mode: 'replace' | 'append' | 'insert' | 'replace_selection') => void;
  getDocumentContent: () => string;
}

export interface UseCodeActExecutionReturn {
  // 自动执行模式状态
  autoExecuteState: AutoExecuteState;
  setAutoExecuteMode: (mode: 'auto' | 'manual') => void;
  setRememberChoice: (remember: boolean) => void;
  setShowDialog: (show: boolean) => void;
  confirmAndExecute: (params: ExecuteQueueParams) => Promise<void>;  // 确认对话框并执行队列

  // 执行队列管理
  executeQueue: ActionStage[];
  addToQueue: (action: ActionStage) => void;
  clearQueue: () => void;
  processQueue: (params: ExecuteActionParams) => Promise<void>;

  // 执行控制
  executeAction: (params: ExecuteActionParams) => Promise<ActionResult>;
  cancelExecution: (actionId: string) => void;
  retryAction: (params: ExecuteActionParams) => Promise<ActionResult>;

  // 更新action状态
  updateActionStatus: (actionId: string, status: ActionStage['status'], result?: ActionResult) => void;
  actions: Map<string, ActionStage>;
}

export function useCodeActExecution(): UseCodeActExecutionReturn {
  // 执行模式只在会话期间记住，不持久化到 localStorage
  const [autoExecuteState, setAutoExecuteState] = useState<AutoExecuteState>({
    mode: null,
    showChoiceDialog: false,
    rememberChoice: true, // 默认记住（会话期间）
    isExecuting: false
  });

  const [executeQueue, setExecuteQueue] = useState<ActionStage[]>([]);
  const actionsRef = useRef<Map<string, ActionStage>>(new Map());

  // 设置自动执行模式（只在会话期间记住）
  const setAutoExecuteMode = useCallback((mode: 'auto' | 'manual') => {
    setAutoExecuteState(prev => ({ ...prev, mode }));
  }, []);

  // 设置对话框显示状态
  const setShowDialog = useCallback((show: boolean) => {
    setAutoExecuteState(prev => ({ ...prev, showChoiceDialog: show }));
  }, []);

  // 设置记住选择
  const setRememberChoice = useCallback((remember: boolean) => {
    setAutoExecuteState(prev => ({ ...prev, rememberChoice: remember }));
  }, []);

  // 添加action到队列
  const addToQueue = useCallback((action: ActionStage) => {
    setExecuteQueue(prev => [...prev, action]);
    actionsRef.current.set(action.id, action);
  }, []);

  // 清空队列
  const clearQueue = useCallback(() => {
    setExecuteQueue([]);
  }, []);

  // 更新action状态
  const updateActionStatus = useCallback((
    actionId: string,
    status: ActionStage['status'],
    result?: ActionResult
  ) => {
    setExecuteQueue(prev =>
      prev.map(action =>
        action.id === actionId
          ? { ...action, status, result: result || action.result }
          : action
      )
    );

    const existing = actionsRef.current.get(actionId);
    if (existing) {
      actionsRef.current.set(actionId, {
        ...existing,
        status,
        result: result || existing.result
      });
    }
  }, []);

  // 执行单个action
  const executeAction = useCallback(async ({
    action,
    onApplyResponse,
    getDocumentContent
  }: ExecuteActionParams): Promise<ActionResult> => {
    // 记录执行前的文档内容
    const previousContent = getDocumentContent();

    try {
      // 更新状态为executing
      updateActionStatus(action.id, 'executing');
      setAutoExecuteState(prev => ({ ...prev, isExecuting: true }));

      // 根据action名称决定执行模式
      let mode: 'replace' | 'append' | 'insert' | 'replace_selection' = 'append';
      switch (action.name) {
        case 'replace_content':
          mode = 'replace';
          break;
        case 'append_content':
          mode = 'append';
          break;
        case 'insert_content':
          mode = 'insert';
          break;
        case 'replace_selection':
          mode = 'replace_selection';
          break;
      }

      // 执行操作
      const contentToApply = action.arguments.content || '';
      onApplyResponse(contentToApply, mode);

      // 等待编辑器更新
      await new Promise(resolve => setTimeout(resolve, 100));

      // 计算变化的字符数
      const charDiff = getDocumentContent().length - previousContent.length;
      const message = `操作成功！${charDiff > 0 ? `已添加 ${charDiff}` : charDiff < 0 ? `已删除 ${Math.abs(charDiff)}` : '已修改'} 个字符`;

      const result: ActionResult = {
        success: true,
        message,
        data: {
          previousLength: previousContent.length,
          newLength: getDocumentContent().length,
          charDiff,
          mode
        }
      };

      // 更新状态为success
      updateActionStatus(action.id, 'success', result);
      setAutoExecuteState(prev => ({ ...prev, isExecuting: false }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const result: ActionResult = {
        success: false,
        message: `操作失败：${errorMessage}`
      };

      updateActionStatus(action.id, 'failed', result);
      setAutoExecuteState(prev => ({ ...prev, isExecuting: false }));

      return result;
    }
  }, [updateActionStatus]);

  // 处理执行队列（自动模式）
  const processQueue = useCallback(async (params: ExecuteActionParams) => {
    if (autoExecuteState.mode !== 'auto' || executeQueue.length === 0) {
      return;
    }

    for (const actionItem of executeQueue) {
      if (actionItem.status !== 'pending') {
        continue;
      }

      await executeAction({
        action: actionItem,
        onApplyResponse: params.onApplyResponse,
        getDocumentContent: params.getDocumentContent
      });
    }
  }, [autoExecuteState.mode, executeQueue, executeAction]);

  // 确认对话框并执行（auto模式下自动执行队列）
  const confirmAndExecute = useCallback(async (params: ExecuteQueueParams) => {
    // 关闭对话框
    setAutoExecuteState(prev => ({ ...prev, showChoiceDialog: false }));

    // 如果是自动执行模式，执行队列中的所有pending actions
    if (autoExecuteState.mode === 'auto') {
      // 获取当前队列中的pending actions
      const pendingActions = executeQueue.filter(a => a.status === 'pending');

      for (const action of pendingActions) {
        await executeAction({
          action,
          onApplyResponse: params.onApplyResponse,
          getDocumentContent: params.getDocumentContent
        });
      }
    }
  }, [autoExecuteState.mode, executeQueue, executeAction]);

  // 取消执行
  const cancelExecution = useCallback((actionId: string) => {
    updateActionStatus(actionId, 'pending');
    setAutoExecuteState(prev => ({ ...prev, isExecuting: false }));
  }, [updateActionStatus]);

  // 重试action
  const retryAction = useCallback(async (params: ExecuteActionParams): Promise<ActionResult> => {
    return executeAction(params);
  }, [executeAction]);

  return {
    autoExecuteState,
    setAutoExecuteMode,
    setRememberChoice,
    setShowDialog,
    confirmAndExecute,

    executeQueue,
    addToQueue,
    clearQueue,
    processQueue,

    executeAction,
    cancelExecution,
    retryAction,

    updateActionStatus,
    actions: actionsRef.current
  };
}
