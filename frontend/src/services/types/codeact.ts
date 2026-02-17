/**
 * CodeAct Style Message Types
 * Defines types for Thought-Action-Observation cycle messages
 */

// ==================== Message Types ====================

export interface CodeActMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;

  // 思考阶段
  thought?: ThoughtStage;

  // 动作阶段（可能有多个）
  actions?: ActionStage[];

  // 响应内容
  response?: string;
}

export interface ThoughtStage {
  content: string;
  status: 'streaming' | 'complete';
  version?: string;
}

export interface ActionStage {
  id: string;
  name: string;  // replace_content, append_content, etc.
  displayName: string;
  icon: string;
  arguments: Record<string, any>;
  status: ActionStatus;
  result?: ActionResult;
  timestamp: Date;
}

export type ActionStatus = 'pending' | 'executing' | 'success' | 'failed';

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

// ==================== Action Configuration ====================

export const ACTION_CONFIG: Record<string, {
  displayName: string;
  icon: string;
  description: string;
  category: 'edit' | 'insert' | 'replace';
}> = {
  replace_content: {
    displayName: '替换内容',
    icon: '🔄',
    description: '用新内容替换整个文档',
    category: 'replace'
  },
  append_content: {
    displayName: '追加内容',
    icon: '📎',
    description: '在文档末尾添加内容',
    category: 'insert'
  },
  insert_content: {
    displayName: '插入内容',
    icon: '✏️',
    description: '在光标位置插入内容',
    category: 'insert'
  },
  replace_selection: {
    displayName: '替换选区',
    icon: '🎯',
    description: '替换选中的文本',
    category: 'replace'
  }
};

// ==================== Auto Execute State ====================

export interface AutoExecuteState {
  mode: 'auto' | 'manual' | null;  // null表示未选择
  showChoiceDialog: boolean;
  rememberChoice: boolean;
  isExecuting: boolean;
}

// ==================== Helper Functions ====================

/**
 * Get action configuration by name
 */
export function getActionConfig(name: string): ActionConfig | undefined {
  return ACTION_CONFIG[name];
}

/**
 * Format action arguments for display
 */
export function formatActionArgs(args: Record<string, any>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '{}';

  const formatted = entries.map(([key, value]) => {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    const truncated = strValue.length > 100
      ? strValue.substring(0, 100) + '...'
      : strValue;
    return `${key}: "${truncated}"`;
  });

  return `{ ${formatted.join(', ')} }`;
}

/**
 * Get status color configuration
 */
export function getStatusColors(status: ActionStatus): {
  bg: string;
  text: string;
  border: string;
} {
  const colors = {
    pending: {
      bg: 'var(--codeact-pending-bg)',
      text: 'var(--codeact-pending-text)',
      border: 'var(--border-color)'
    },
    executing: {
      bg: 'var(--codeact-executing-bg)',
      text: 'var(--codeact-executing-text)',
      border: 'var(--codeact-executing-border)'
    },
    success: {
      bg: 'var(--codeact-success-bg)',
      text: 'var(--codeact-success-text)',
      border: 'var(--codeact-success-border)'
    },
    failed: {
      bg: 'var(--codeact-failed-bg)',
      text: 'var(--codeact-failed-text)',
      border: 'var(--codeact-failed-border)'
    }
  };
  return colors[status];
}

/**
 * Get status icon
 */
export function getStatusIcon(status: ActionStatus): string {
  const icons = {
    pending: '⏳',
    executing: '⚡',
    success: '✅',
    failed: '❌'
  };
  return icons[status];
}

/**
 * Get status text
 */
export function getStatusText(status: ActionStatus): string {
  const texts = {
    pending: '等待中',
    executing: '执行中',
    success: '已完成',
    failed: '失败'
  };
  return texts[status];
}

type ActionConfig = typeof ACTION_CONFIG[keyof typeof ACTION_CONFIG];
