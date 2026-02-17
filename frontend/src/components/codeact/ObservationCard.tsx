/**
 * ObservationCard Component
 * Displays the result of an executed action
 * Shows success/failure status with detailed feedback
 */

import React from 'react';
import TreeRenderer from '../../TreeRenderer';

export interface ObservationCardProps {
  success: boolean;
  message: string;
  timestamp: Date;
  data?: any;
  onViewInEditor?: () => void;
  onCopyResult?: () => void;
}

export const ObservationCard: React.FC<ObservationCardProps> = ({
  success,
  message,
  timestamp,
  data,
  onViewInEditor,
  onCopyResult
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const borderColor = success ? '#10b981' : '#ef4444';
  const bgColor = success ? '#ecfdf5' : '#fef2f2';
  const headerBg = success ? 'bg-green-50' : 'bg-red-50';
  const headerText = success ? 'text-green-700' : 'text-red-700';
  const icon = success ? '✅' : '❌';

  return (
    <div
      className="codeact-observation-card mb-3 rounded-lg overflow-hidden animate-observation-enter codeact-card"
      style={{
        border: `1px solid ${borderColor}`,
        backgroundColor: bgColor
      }}
    >
      {/* 标题栏 */}
      <div className={`flex items-center gap-2 px-3 py-2 ${headerBg}`}>
        <span className="text-base">{icon}</span>
        <span className={`text-sm font-medium ${headerText}`}>
          OBSERVATION
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {formatTime(timestamp)}
        </span>
      </div>

      {/* 结果内容 */}
      <div className="p-3">
        {/* 结果消息 */}
        <div className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
          {message}
        </div>

        {/* 数据展示（如果有） */}
        {data && (
          <details className="group/result">
            <summary
              className="flex items-center gap-2 cursor-pointer text-xs mb-2 list-none"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span>📊</span>
              <span>详细信息</span>
              <svg
                className="w-3 h-3 transition-transform group-open/result:rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </summary>
            <div
              className="p-2 rounded mt-2"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)'
              }}
            >
              <TreeRenderer data={data} />
            </div>
          </details>
        )}

        {/* 快捷操作 */}
        {success && (
          <div
            className="flex items-center gap-2 mt-3 pt-3 border-t"
            style={{ borderColor: 'rgba(0,0,0,0.05)' }}
          >
            {onViewInEditor && (
              <button
                onClick={onViewInEditor}
                className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1"
                style={{ backgroundColor: 'white', color: '#059669', border: '1px solid #10b981' }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                在编辑器中查看
              </button>
            )}
            {onCopyResult && (
              <button
                onClick={onCopyResult}
                className="text-xs px-2.5 py-1 rounded-md"
                style={{ backgroundColor: 'white', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
              >
                复制结果
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ObservationCard;
