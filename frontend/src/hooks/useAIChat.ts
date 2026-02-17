/** Hook for AI chat functionality. */

import { useCallback, useState } from 'react';

import type { ChatContext, Message as ChatMessage } from '../services/types/ai';
import { aiApi } from '../services/api/aiApi';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id: string;
  timestamp: Date;
}

export interface UseAIChatProps {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  thinkingMode?: boolean;
}

export interface UseAIChatReturn {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string, context?: ChatContext) => Promise<void>;
  clearMessages: () => void;
  stopStreaming: () => void;
}

export function useAIChat(props: UseAIChatProps): UseAIChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, context?: ChatContext) => {
    // Create user message
    const userMessage: Message = {
      role: 'user',
      content,
      id: `msg-${Date.now()}`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setError(null);

    // Create assistant message placeholder
    const assistantMessageId = `msg-${Date.now() + 1}`;
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '',
        id: assistantMessageId,
        timestamp: new Date(),
      },
    ]);

    // Build messages array
    const chatMessages: ChatMessage[] = [
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: 'user',
        content,
      },
    ];

    let accumulatedContent = '';

    try {
      const stream = aiApi.chat({
        provider: props.provider,
        model: props.model,
        messages: chatMessages,
        context,
        options: {
          temperature: props.temperature ?? 0.7,
          max_tokens: props.maxTokens ?? 4000,
          thinking_mode: props.thinkingMode ?? false,
          stream: true,
        },
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          accumulatedContent += chunk.content;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg,
            ),
          );
        } else if (chunk.type === 'error') {
          setError(chunk.error ?? 'Unknown error');
          break;
        } else if (chunk.type === 'done') {
          break;
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${errorMessage}` }
            : msg,
        ),
      );
    } finally {
      setIsStreaming(false);
      setAbortController(null);
    }
  }, [messages, props]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const stopStreaming = useCallback(() => {
    abortController?.abort();
    setIsStreaming(false);
    setAbortController(null);
  }, [abortController]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    stopStreaming,
  };
}
