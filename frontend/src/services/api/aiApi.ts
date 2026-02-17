/** AI API client. */

import type { ChatChunk, ChatRequest, ConfigStatusResponse, ProvidersResponse } from '../types/ai';
import { API_ENDPOINTS } from './config';

/**
 * Parse Server-Sent Events stream
 */
async function* parseSSEStream(
  response: Response,
): AsyncGenerator<ChatChunk, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (!data) continue;

          if (data === '[DONE]') {
            yield { type: 'done', content: '' };
            return;
          }

          try {
            const chunk = JSON.parse(data) as ChatChunk;
            yield chunk;
          } catch (e) {
            console.error('Failed to parse SSE chunk:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * AI API client
 */
export const aiApi = {
  /**
   * Send chat message with streaming response
   */
  async *chat(request: ChatRequest): AsyncGenerator<ChatChunk, void, unknown> {
    const response = await fetch(API_ENDPOINTS.aiChat(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    yield* parseSSEStream(response);
  },

  /**
   * Get available AI providers
   */
  async getProviders(): Promise<ProvidersResponse> {
    const response = await fetch(API_ENDPOINTS.aiProviders());
    if (!response.ok) {
      throw new Error(`Failed to get providers: ${response.status}`);
    }
    return response.json();
  },

  /**
   * Get current AI configuration status
   */
  async getStatus(): Promise<ConfigStatusResponse> {
    const response = await fetch(API_ENDPOINTS.aiStatus());
    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.status}`);
    }
    return response.json();
  },
};
