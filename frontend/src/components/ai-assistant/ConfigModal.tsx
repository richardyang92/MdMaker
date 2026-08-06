import React, { useEffect } from 'react';
import { SettingsPanel } from './SettingsPanel';
import type { ProviderInfo } from '../../services/types/ai';

interface AIConfig {
  model: string;
  provider: string;
  thinkingMode: boolean;
  maxTokens: number;
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onConfigChange: (config: AIConfig) => void;
  providers: Record<string, ProviderInfo>;
}

/**
 * 独立的 AI 配置弹窗 —— 全应用唯一的 provider/model 切换入口。
 * 内容复用 SettingsPanel（provider/model/maxTokens/思考模式），
 * 外层提供居中模态 + ESC/遮罩关闭。
 */
export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  providers,
}) => {
  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg shadow-xl animate-scale-in"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            AI 设置
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 transition-all duration-fast hover-lift"
            style={{ color: 'var(--text-tertiary)' }}
            title="关闭"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容：复用 SettingsPanel */}
        <SettingsPanel
          config={config}
          onConfigChange={onConfigChange}
          providers={providers}
          onSave={onClose}
        />
      </div>
    </div>
  );
};
