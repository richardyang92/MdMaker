/** Hook for AI configuration management. */

import { useEffect, useState } from 'react';

import type { ConfigStatusResponse, ProviderInfo } from '../services/types/ai';
import { aiApi } from '../services/api/aiApi';

export interface AIConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  thinkingMode: boolean;
}

export interface UseAIConfigReturn {
  config: AIConfig;
  setConfig: (config: Partial<AIConfig>) => void;
  providers: Record<string, ProviderInfo>;
  status: ConfigStatusResponse | null;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'ollama',
  model: 'qwen2.5:7b',
  temperature: 0.7,
  maxTokens: 4000,
  thinkingMode: false,
};

export function useAIConfig(): UseAIConfigReturn {
  const [config, setConfigState] = useState<AIConfig>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('ai-config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [status, setStatus] = useState<ConfigStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load providers and status on mount
  useEffect(() => {
    loadProviders();
    loadStatus();
  }, []);

  const loadProviders = async () => {
    try {
      const data = await aiApi.getProviders();
      setProviders(data.providers);
    } catch (e) {
      console.error('Failed to load providers:', e);
      setError('Failed to load AI providers');
    }
  };

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      const data = await aiApi.getStatus();
      setStatus(data);
    } catch (e) {
      console.error('Failed to load status:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const setConfig = (updates: Partial<AIConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfigState(newConfig);
    localStorage.setItem('ai-config', JSON.stringify(newConfig));
  };

  return {
    config,
    setConfig,
    providers,
    status,
    isLoading,
    error,
    refreshStatus: loadStatus,
  };
}
