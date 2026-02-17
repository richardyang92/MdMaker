/**
 * InlineModeSelector Component
 * Inline card for choosing execution mode (auto/manual) within the timeline
 */

import React from 'react';

export interface InlineModeSelectorProps {
  currentMode: 'auto' | 'manual' | null;
  onModeSelect: (mode: 'auto' | 'manual') => void;
  onConfirm: () => void;
}

export const InlineModeSelector: React.FC<InlineModeSelectorProps> = ({
  currentMode,
  onModeSelect,
  onConfirm
}) => {
  return (
    <div
      className="inline-mode-selector rounded-lg p-4 mb-3"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)'
      }}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚡</span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          选择执行模式
        </span>
      </div>

      {/* 选项 */}
      <div className="flex gap-2 mb-3">
        {/* 自动执行选项 */}
        <button
          onClick={() => onModeSelect('auto')}
          className="flex-1 p-2.5 rounded-lg text-left transition-all"
          style={{
            border: `2px solid ${currentMode === 'auto' ? 'var(--ai-accent)' : 'var(--border-color)'}`,
            backgroundColor: currentMode === 'auto' ? 'var(--ai-light)' : 'var(--bg-tertiary)'
          }}
        >
          <div className="flex items-center gap-2">
            <span>🚀</span>
            <div className="flex-1">
              <div className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>
                自动执行
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                自动执行所有操作
              </div>
            </div>
            {currentMode === 'auto' && (
              <svg className="w-4 h-4" style={{ color: 'var(--ai-accent)' }} fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </button>

        {/* 手动执行选项 */}
        <button
          onClick={() => onModeSelect('manual')}
          className="flex-1 p-2.5 rounded-lg text-left transition-all"
          style={{
            border: `2px solid ${currentMode === 'manual' ? 'var(--ai-accent)' : 'var(--border-color)'}`,
            backgroundColor: currentMode === 'manual' ? 'var(--ai-light)' : 'var(--bg-tertiary)'
          }}
        >
          <div className="flex items-center gap-2">
            <span>👆</span>
            <div className="flex-1">
              <div className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>
                手动确认
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                每次需手动确认
              </div>
            </div>
            {currentMode === 'manual' && (
              <svg className="w-4 h-4" style={{ color: 'var(--ai-accent)' }} fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* 底部操作 */}
      <div className="flex items-center justify-end">
        <button
          onClick={onConfirm}
          disabled={!currentMode}
          className="px-3 py-1.5 text-xs rounded-md font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          确认
        </button>
      </div>
    </div>
  );
};

export default InlineModeSelector;
