/** API configuration. */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_BASE = API_BASE_URL;

export const API_ENDPOINTS = {
  // AI endpoints
  aiChat: () => `${API_BASE}/api/v1/ai/chat`,
  aiProviders: () => `${API_BASE}/api/v1/ai/providers`,
  aiStatus: () => `${API_BASE}/api/v1/ai/status`,

  // Config endpoints
  configValidate: () => `${API_BASE}/api/v1/config/validate`,

  // Document endpoints
  documents: () => `${API_BASE}/api/v1/documents`,
  document: (id: string) => `${API_BASE}/api/v1/documents/${id}`,
} as const;
