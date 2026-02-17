/** AI-related type definitions. */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SelectionContext {
  text: string;
  start: number;
  end: number;
}

export interface ChatContext {
  document?: string;
  selection?: SelectionContext;
  cursor_position?: number;
}

export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  thinking_mode?: boolean;
  stream?: boolean;
}

export interface ChatRequest {
  provider: string;
  model: string;
  messages: Message[];
  context?: ChatContext;
  options?: ChatOptions;
}

export interface ChatChunk {
  type: 'content' | 'error' | 'done';
  content: string;
  error?: string;
}

export interface ProviderInfo {
  name: string;
  models: string[];
  requires_key: boolean;
  supports_thinking_mode: boolean;
}

export interface ProvidersResponse {
  providers: Record<string, ProviderInfo>;
  default_provider: string;
}

export interface ConfigStatusResponse {
  configured: boolean;
  provider: string;
  model: string;
  features: string[];
}

export interface ConfigValidateRequest {
  provider: string;
  base_url: string;
  api_key: string;
  model: string;
}

export interface ConfigValidateResponse {
  valid: boolean;
  message: string;
  provider: string;
}
