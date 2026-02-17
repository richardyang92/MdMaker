import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { SettingsPanel, saveConfigToStorage } from './SettingsPanel';
import type { ProviderInfo } from '../../services/types/ai';

// AI配置类型
interface AIConfig {
  model: string;
  provider: string;
  thinkingMode: boolean;
  maxTokens: number;
}

// 对话管理操作类型
interface ConversationActions {
  onClear: () => void;
  onExport: () => void;
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  triggerRef?: React.RefObject<HTMLButtonElement>;
  // 配置相关
  config?: AIConfig;
  onConfigChange?: (config: AIConfig) => void;
  providers?: Record<string, ProviderInfo>;
  // 对话管理
  conversationActions?: ConversationActions;
  messageCount?: number;
  // 初始Tab
  initialTab?: 'chat' | 'settings';
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  children,
  triggerRef,
  config,
  onConfigChange,
  providers,
  conversationActions,
  messageCount = 0,
  initialTab
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ bottom: 92, left: 0 });
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>(initialTab || 'chat');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // 当initialTab改变时更新activeTab
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // 根据按钮位置计算弹出面板位置
  useEffect(() => {
    if (!isOpen || !triggerRef?.current) return;

    const updatePosition = () => {
      const buttonRect = triggerRef.current?.getBoundingClientRect();
      if (!buttonRect) return;

      const panelWidth = 420;
      // 按钮高度 56px (w-14 h-14) + 按钮底部偏移 24px (bottom-6) + 间距 12px
      const fixedBottom = 92;

      // 计算位置：面板在按钮上方居中对齐，bottom固定为92px
      let left = buttonRect.left + (buttonRect.width / 2) - (panelWidth / 2);

      // 边界检查：确保不超出屏幕（只检查left）
      if (left < 16) left = 16;
      if (left + panelWidth > window.innerWidth - 16) left = window.innerWidth - panelWidth - 16;

      setPosition({ bottom: fixedBottom, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen, triggerRef]);

  // 点击外部关闭更多菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (showMoreMenu) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMoreMenu]);

  // 处理配置保存
  const handleConfigSave = () => {
    if (config) {
      saveConfigToStorage(config);
    }
  };

  if (typeof window === 'undefined') return null;
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[420px] max-w-[90vw]"
      style={{
        bottom: `${position.bottom}px`,
        left: `${position.left}px`,
      }}
    >
      {/* AI助手面板 */}
      <div
        className="rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ease-out scale-in"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* 抽屉头部 */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b glass-effect"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {/* Tab切换 */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-fast flex items-center ${
                activeTab === 'chat' ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
              }`}
              style={{
                backgroundColor: activeTab === 'chat' ? 'var(--ai-light)' : 'transparent',
                color: activeTab === 'chat' ? 'var(--ai-accent)' : 'var(--text-secondary)',
                border: activeTab === 'chat' ? '1px solid var(--ai-accent)' : '1px solid transparent'
              }}
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              对话
              {messageCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'var(--ai-accent)', color: 'white' }}>
                  {messageCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-fast flex items-center ${
                activeTab === 'settings' ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
              }`}
              style={{
                backgroundColor: activeTab === 'settings' ? 'var(--accent-light)' : 'transparent',
                color: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: activeTab === 'settings' ? '1px solid var(--accent-primary)' : '1px solid transparent'
              }}
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              设置
            </button>
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex items-center space-x-1">
            {/* 对话管理按钮（仅在对话Tab显示） */}
            {activeTab === 'chat' && conversationActions && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreMenu(!showMoreMenu);
                  }}
                  className="p-1.5 rounded-md hover-lift transition-all"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {/* 更多菜单 */}
                {showMoreMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 py-1 rounded-md shadow-lg z-50 min-w-[120px]"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        conversationActions.onClear();
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-3 py-2 text-xs text-left flex items-center hover:bg-opacity-50 transition-all"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-3.5 h-3.5 mr-2" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      清空对话
                    </button>
                    <button
                      onClick={() => {
                        conversationActions.onExport();
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-3 py-2 text-xs text-left flex items-center hover:bg-opacity-50 transition-all"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      导出对话
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-1 rounded-md hover-lift transition-all"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 抽屉内容 */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {activeTab === 'chat' ? (
            children
          ) : (
            config && onConfigChange && providers && (
              <SettingsPanel
                config={config}
                onConfigChange={onConfigChange}
                providers={providers}
                onSave={handleConfigSave}
              />
            )
          )}
        </div>
      </div>

      {/* 指向按钮的小箭头 */}
      {triggerRef?.current && (
        <div
          className="absolute w-0 h-0"
          style={{
            bottom: '-8px',
            left: '90%',
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `8px solid var(--bg-secondary)`
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default AIAssistantDrawer;
