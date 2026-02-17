import React, { useState, useEffect } from 'react';
import type { ProviderInfo } from '../../services/types/ai';

interface AIConfig {
  model: string;
  provider: string;
  thinkingMode: boolean;
  maxTokens: number;
}

interface SettingsPanelProps {
  config: AIConfig;
  onConfigChange: (config: AIConfig) => void;
  onSave?: () => void;
  providers: Record<string, ProviderInfo>;
}

// 本地存储键名
const STORAGE_KEY = 'ai-assistant-config';

// 从localStorage加载配置
export const loadConfigFromStorage = (): Partial<AIConfig> | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载配置失败:', e);
  }
  return null;
};

// 保存配置到localStorage
export const saveConfigToStorage = (config: AIConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('保存配置失败:', e);
  }
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config,
  onConfigChange,
  onSave,
  providers
}) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 获取当前Provider信息
  const currentProvider = providers[config.provider];

  // 获取所有Provider列表
  const providerList = Object.entries(providers).map(([key, value]) => ({
    key,
    name: value.name,
    requiresKey: value.requires_key
  }));

  // 当Provider改变时，自动更新model
  useEffect(() => {
    const provider = providers[config.provider];
    if (provider) {
      // 检查当前model是否在新Provider的模型列表中
      const modelExists = provider.models.includes(config.model);
      onConfigChange({
        ...config,
        model: modelExists ? config.model : provider.models[0],
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.provider]);

  // 处理保存
  const handleSave = async () => {
    setSaveStatus('saving');

    // 保存到localStorage
    saveConfigToStorage(config);

    // 调用外部保存回调
    if (onSave) {
      try {
        await onSave();
        setSaveStatus('saved');
      } catch (e) {
        setSaveStatus('error');
      }
    } else {
      setSaveStatus('saved');
    }

    // 3秒后重置状态
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  // 检查配置是否有效
  const isConfigValid = () => {
    if (!config.model) return false;
    return true;
  };

  return (
    <div className="settings-panel relative p-4 pb-16" style={{ backgroundColor: 'var(--bg-primary)', minHeight: '500px' }}>
      {/* Provider选择 */}
      <div className="space-y-2">
        <label className="text-xs font-medium flex items-center" style={{ color: 'var(--text-secondary)' }}>
          <svg className="w-4 h-4 mr-2" style={{ color: 'var(--ai-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          AI 提供商
        </label>
        <select
          value={config.provider}
          onChange={(e) => onConfigChange({ ...config, provider: e.target.value })}
          className="w-full px-3 py-2 rounded-md text-sm transition-all duration-fast focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {providerList.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 模型选择 */}
      <div className="space-y-2">
        <label className="text-xs font-medium flex items-center" style={{ color: 'var(--text-secondary)' }}>
          <svg className="w-4 h-4 mr-2" style={{ color: 'var(--ai-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          模型
        </label>
        <select
          value={config.model}
          onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
          className="w-full px-3 py-2 rounded-md text-sm transition-all duration-fast focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {currentProvider?.models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* 高级设置 */}
      <div className="pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              高级设置
            </span>
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="mt-4 space-y-4">
            {/* maxTokens滑块 */}
            <div className="space-y-2">
              <label className="text-xs font-medium flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                <span>最大输出长度 (tokens)</span>
                <span style={{ color: 'var(--ai-accent)' }}>{config.maxTokens === -1 ? '无限制' : config.maxTokens}</span>
              </label>
              <input
                type="range"
                min="-1"
                max="4096"
                step="256"
                value={config.maxTokens}
                onChange={(e) => onConfigChange({ ...config, maxTokens: parseInt(e.target.value) })}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-tertiary)'
                }}
              />
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span>无限制</span>
                <span>4096</span>
              </div>
            </div>

            {/* 思考模式开关 */}
            {currentProvider?.supports_thinking_mode && (
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center" style={{ color: 'var(--text-secondary)' }}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  思考模式
                </label>
                <button
                  type="button"
                  onClick={() => onConfigChange({ ...config, thinkingMode: !config.thinkingMode })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-fast ${
                    config.thinkingMode ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-fast ${
                      config.thinkingMode ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* 保存按钮 - 固定在底部 */}
      <button
        onClick={handleSave}
        disabled={!isConfigValid() || saveStatus === 'saving'}
        className={`absolute left-4 right-4 py-2.5 rounded-md text-sm font-medium transition-all duration-fast flex items-center justify-center ${
          !isConfigValid() ? 'cursor-not-allowed opacity-50' : 'hover-lift shadow-md hover:shadow-lg'
        }`}
        style={{
          bottom: '16px',
          background: saveStatus === 'saved'
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))',
          color: 'white',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {saveStatus === 'saving' && (
          <>
            <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            保存中...
          </>
        )}
        {saveStatus === 'saved' && (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            已保存
          </>
        )}
        {saveStatus === 'error' && (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            保存失败
          </>
        )}
        {saveStatus === 'idle' && '保存配置'}
      </button>
    </div>
  );
};

export default SettingsPanel;
