import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import logo from '/logo.svg';
import type { ProviderInfo } from '../../services/types/ai';

export type Theme = 'light' | 'dark' | 'eye-protect';

interface AIConfig {
  provider: string;
  model: string;
  thinkingMode: boolean;
  maxTokens: number;
}

interface AppHeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  aiConfig: AIConfig;
  providers: Record<string, ProviderInfo>;
  onOpenConfig: () => void;
  onNew: () => void;
  onOpenFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}

/**
 * 自定义主题下拉组件（从 App.tsx 原样搬移，仅服务于 Header）。
 */
const CustomThemeDropdown: React.FC<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}> = ({ theme, setTheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

  const themeOptions = [
    { value: 'light', label: '默认主题' },
    { value: 'dark', label: '深色主题' },
    { value: 'eye-protect', label: '护眼主题' },
  ];

  const currentThemeLabel = themeOptions.find(option => option.value === theme)?.label || '默认主题';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedInButton = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
      const clickedInMenu = dropdownMenuRef.current && dropdownMenuRef.current.contains(event.target as Node);

      if (!clickedInButton && !clickedInMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="w-full px-4 py-1 text-xs rounded-md shadow-sm flex items-center justify-center hover-lift transition-all duration-fast ease-out"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)'
        }}
        onClick={() => {
          if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setDropdownPosition({
              top: rect.bottom,
              left: rect.left,
              width: rect.width
            });
          }
          setIsOpen(!isOpen);
        }}
      >
        <div className="flex items-center">
          <span className="mr-2">{currentThemeLabel}</span>
          <svg className={`fill-current h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={dropdownMenuRef}
          className="dropdown-menu shadow-lg"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 9999,
            pointerEvents: 'auto'
          }}>
          <div className="py-1" style={{ borderRadius: 'var(--radius-md)' }}>
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="w-full px-4 py-2 text-xs text-center transition-all duration-fast ease-out dropdown-item first:rounded-t-md last:rounded-b-md"
                style={{
                  backgroundColor: theme === option.value ? 'var(--accent-primary)' : 'transparent',
                  color: theme === option.value ? 'var(--accent-text)' : 'var(--text-primary)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setTheme(option.value as Theme);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/**
 * 顶部应用工具栏：Logo / 当前配置 / AI 设置 / 新建 / 打开 / 保存 / 主题。
 * 原撤回/重做按钮组已随源码编辑器一并移除。
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  theme,
  setTheme,
  aiConfig,
  providers,
  onOpenConfig,
  onNew,
  onOpenFile,
  onSave,
}) => {
  const getCurrentConfigSource = () => {
    const providerLabel = providers[aiConfig.provider]?.name || aiConfig.provider;
    return `${providerLabel} - ${aiConfig.model}`;
  };

  return (
    <header
      className="glass-effect shadow-md border-b transition-all duration-fast ease-out"
      style={{ height: 'var(--header-height)', borderColor: 'var(--border-color)' }}
    >
      <div className="px-6">
        <div className="flex justify-between items-center" style={{ height: 'var(--header-height)' }}>
          <h1 className="text-lg font-bold flex items-center">
            <img
              src={logo}
              alt="Logo"
              className="h-8 w-8 mr-3 hover-lift"
              style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
            />
            <span className="text-gradient font-semibold tracking-tight" style={{ fontSize: 'var(--text-xl)' }}>
              智写助手
            </span>
          </h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenConfig}
              className="text-xs hidden lg:flex items-center gap-1 hover-lift transition-all duration-fast ease-out"
              style={{ color: 'var(--text-tertiary)' }}
              title="点击修改 AI 配置"
            >
              当前配置: {getCurrentConfigSource()}
            </button>
            <button
              onClick={onOpenConfig}
              className="px-3 py-1.5 text-xs font-medium rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md flex items-center gap-1"
              style={{
                backgroundColor: 'var(--ai-light)',
                color: 'var(--ai-accent)',
                border: '1px solid var(--ai-accent)'
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              AI 设置
            </button>
            <button
              onClick={onNew}
              className="px-3 py-1.5 text-xs font-medium rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
            >
              新建
            </button>
            <input
              type="file"
              accept=".md,.txt"
              onChange={onOpenFile}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="px-3 py-1.5 text-xs font-medium rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
            >
              打开
            </label>
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-xs font-medium text-white rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))'
              }}
            >
              保存
            </button>
            <div className="flex items-center space-x-1 border-l pl-2" style={{ borderColor: 'var(--border-color)' }}>
              <div className="relative">
                <CustomThemeDropdown theme={theme} setTheme={setTheme} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
