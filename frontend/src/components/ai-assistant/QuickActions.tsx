import React, { useState } from 'react';

// 快捷指令定义
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  requireSelection?: boolean;  // 是否需要选区才显示
  category?: 'format' | 'content' | 'translate';
}

// 预设快捷指令
export const quickActions: QuickAction[] = [
  {
    id: 'format',
    label: '格式化',
    icon: '✨',
    prompt: '请帮我格式化这段Markdown内容，使其结构更清晰、排版更美观，但不要改变原始内容的意思。',
    category: 'format'
  },
  {
    id: 'optimize',
    label: '优化排版',
    icon: '📐',
    prompt: '请优化这段内容的排版，包括：标题层级、列表缩进、段落间距等，使阅读体验更好。',
    category: 'format'
  },
  {
    id: 'toc',
    label: '生成目录',
    icon: '📋',
    prompt: '请根据当前文档的内容，生成一个完整的目录结构（使用Markdown列表格式）。',
    category: 'content'
  },
  {
    id: 'summary',
    label: '生成摘要',
    icon: '📝',
    prompt: '请为这段内容生成一个简洁的摘要，突出主要观点。',
    category: 'content'
  },
  {
    id: 'translate-selection',
    label: '翻译选区',
    icon: '🌐',
    prompt: '请将选中的内容翻译成英文，保持原有的Markdown格式。',
    requireSelection: true,
    category: 'translate'
  },
  {
    id: 'translate-document',
    label: '翻译全文',
    icon: '🌍',
    prompt: '请将整个文档翻译成英文，保持原有的Markdown格式和结构。',
    category: 'translate'
  },
  {
    id: 'fix-grammar',
    label: '修正语法',
    icon: '🔧',
    prompt: '请检查并修正这段内容中的语法错误、拼写错误和表达不当之处。',
    category: 'content'
  },
  {
    id: 'expand',
    label: '扩展内容',
    icon: '📖',
    prompt: '请在保持原有风格的基础上，扩展这段内容，添加更多细节和例子。',
    category: 'content'
  },
  {
    id: 'latex-check',
    label: 'LaTeX检查',
    icon: '∑',
    prompt: '请检查文档中的LaTeX数学公式是否正确，如有错误请指出并提供修正后的版本。',
    category: 'format'
  },
  {
    id: 'table-generate',
    label: '生成表格',
    icon: '📊',
    prompt: '请根据文档内容，生成一个合适的Markdown表格来展示数据。',
    category: 'content'
  }
];

interface QuickActionsProps {
  onActionClick: (action: QuickAction) => void;
  hasSelection: boolean;
  disabled?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onActionClick,
  hasSelection,
  disabled = false
}) => {
  const [showAll, setShowAll] = useState(false);

  // 根据是否有选区过滤显示的指令
  const visibleActions = quickActions.filter(action => {
    if (action.requireSelection && !hasSelection) {
      return false;
    }
    return true;
  });

  // 默认显示的指令（前4个）
  const defaultActions = visibleActions.slice(0, 4);
  const moreActions = visibleActions.slice(4);

  return (
    <div className="quick-actions py-2 px-1">
      <div className="flex items-center flex-wrap gap-1.5">
        {/* 默认显示的指令 */}
        {defaultActions.map((action) => (
          <button
            key={action.id}
            onClick={() => onActionClick(action)}
            disabled={disabled}
            className={`px-2.5 py-1 text-xs rounded-md transition-all duration-fast flex items-center ${
              disabled ? 'cursor-not-allowed opacity-50' : 'hover-lift'
            }`}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)'
            }}
            title={action.prompt}
          >
            <span className="mr-1">{action.icon}</span>
            {action.label}
          </button>
        ))}

        {/* 更多指令按钮 */}
        {moreActions.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            disabled={disabled}
            className={`px-2.5 py-1 text-xs rounded-md transition-all duration-fast flex items-center ${
              disabled ? 'cursor-not-allowed opacity-50' : 'hover-lift'
            }`}
            style={{
              backgroundColor: showAll ? 'var(--ai-light)' : 'var(--bg-tertiary)',
              color: showAll ? 'var(--ai-accent)' : 'var(--text-secondary)',
              border: showAll ? '1px solid var(--ai-accent)' : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <span className="mr-1">{showAll ? '▲' : '▼'}</span>
            更多
          </button>
        )}
      </div>

      {/* 展开的更多指令 */}
      {showAll && moreActions.length > 0 && (
        <div className="mt-2 pt-2 border-t flex items-center flex-wrap gap-1.5" style={{ borderColor: 'var(--border-color)' }}>
          {moreActions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                onActionClick(action);
                setShowAll(false);
              }}
              disabled={disabled}
              className={`px-2.5 py-1 text-xs rounded-md transition-all duration-fast flex items-center ${
                disabled ? 'cursor-not-allowed opacity-50' : 'hover-lift'
              }`}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)'
              }}
              title={action.prompt}
            >
              <span className="mr-1">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* 选区提示 */}
      {hasSelection && (
        <div className="mt-2 text-xs flex items-center" style={{ color: 'var(--ai-accent)' }}>
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          已选中内容，可以使用"翻译选区"功能
        </div>
      )}
    </div>
  );
};

export default QuickActions;
